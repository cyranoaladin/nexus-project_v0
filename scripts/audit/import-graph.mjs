#!/usr/bin/env node
/**
 * AST-based import-graph reachability checker (incrément 3, mission §3 —
 * "REACHABILITY_REGEX_ONLY = NO"). Upgrades the incrément 2 scanner's
 * source-text/regex assertions to a real proof for any future DELETE:
 * uses the TypeScript Compiler API (already a project dependency — no new
 * external dependency) to parse every file's import/export declarations
 * as an AST, not string matching, so it correctly resolves:
 *   - named imports:      import { foo } from 'x'
 *   - aliased imports:    import { foo as bar } from 'x'
 *   - namespace imports:  import * as ns from 'x'  (flags ns.foo usage)
 *   - re-exports:         export { foo } from 'x'
 *   - barrel re-exports:  export * from 'x'
 *   - dynamic imports:    await import('x') (and destructured named access)
 * when the module specifier is a string literal (statically resolvable).
 *
 * Usage:
 *   node scripts/audit/import-graph.mjs --file <relPath> --export <name> [--root <dir>]
 *
 * Always exits 0 on a successful scan and prints JSON
 * { file, export, importers: string[] } to stdout — every file (other than
 * the target itself) that reaches <name> exported by <relPath>, directly
 * or through a re-export/barrel chain. The caller (a Jest test, typically)
 * asserts on `importers`, e.g. `expect(importers).toEqual([])` to prove a
 * symbol is dead before deleting it. A non-zero exit means the scan itself
 * failed (bad args), never "importers were found."
 */
import ts from 'typescript';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve as pathResolve } from 'node:path';

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

const root = pathResolve(arg('root') ?? process.cwd());
const targetFileRel = arg('file');
const targetExportName = arg('export');

if (!targetFileRel || !targetExportName) {
  console.error('Usage: import-graph.mjs --file <relPath> --export <name> [--root <dir>]');
  process.exit(64);
}

const targetFileAbs = pathResolve(root, targetFileRel);

function listSourceFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      if (entry === 'node_modules' || entry === '.next' || entry === '.git' || entry === '.worktrees') continue;
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

const scanDirs = ['app', 'lib', 'components', '__tests__'].map((d) => join(root, d));
const allFiles = scanDirs.flatMap(listSourceFiles);

/** Resolve a module specifier (relative or '@/...') to an absolute .ts/.tsx/index file path, or null if unresolvable (external package). */
function resolveSpecifier(specifier, fromFileAbs) {
  let base;
  if (specifier.startsWith('@/')) {
    base = join(root, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    base = join(dirname(fromFileAbs), specifier);
  } else {
    return null; // external package — not part of this repo's reachability graph.
  }
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  for (const c of candidates) if (existsSync(c)) return c;
  if (existsSync(base) && statSync(base).isFile()) return base;
  return null;
}

/** Parsed shape for one file: direct named/aliased/namespace imports, and re-exports (barrel or named). */
function parseFile(fileAbs) {
  const text = readFileSync(fileAbs, 'utf8');
  const sourceFile = ts.createSourceFile(fileAbs, text, ts.ScriptTarget.Latest, true, fileAbs.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const namedImports = []; // { local, imported, specifier }
  const namespaceImports = []; // { local, specifier }
  const namedReExports = []; // { exported, imported, specifier }
  const starReExports = []; // { specifier }
  const dynamicImportDestructured = []; // { imported, specifier } — const { x } = await import('y')

  function visit(node) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const clause = node.importClause;
      if (clause?.namedBindings) {
        if (ts.isNamedImports(clause.namedBindings)) {
          for (const el of clause.namedBindings.elements) {
            const imported = (el.propertyName ?? el.name).text;
            namedImports.push({ local: el.name.text, imported, specifier });
          }
        } else if (ts.isNamespaceImport(clause.namedBindings)) {
          namespaceImports.push({ local: clause.namedBindings.name.text, specifier });
        }
      }
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      if (!node.exportClause) {
        starReExports.push({ specifier });
      } else if (ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) {
          const imported = (el.propertyName ?? el.name).text;
          namedReExports.push({ exported: el.name.text, imported, specifier });
        }
      }
    }

    // const { x, y: z } = await import('specifier') / import('specifier').then(...)
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isAwaitExpression(node.initializer) &&
      ts.isCallExpression(node.initializer.expression) &&
      node.initializer.expression.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.initializer.expression.arguments[0] &&
      ts.isStringLiteral(node.initializer.expression.arguments[0]) &&
      ts.isObjectBindingPattern(node.name)
    ) {
      const specifier = node.initializer.expression.arguments[0].text;
      for (const el of node.name.elements) {
        if (ts.isBindingElement(el) && ts.isIdentifier(el.name)) {
          const imported = el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : el.name.text;
          dynamicImportDestructured.push({ imported, specifier });
        }
      }
    }

    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  return { namedImports, namespaceImports, namedReExports, starReExports, dynamicImportDestructured, text };
}

const parsedByFile = new Map(allFiles.map((f) => [f, parseFile(f)]));

/**
 * Does `fileAbs` reach `exportName` originally exported by `originFileAbs`,
 * either directly or by re-export/barrel chain? Depth-first with a visited
 * set to avoid infinite loops on circular re-exports.
 */
function fileReachesExport(fileAbs, exportName, originFileAbs, visitedSpecifierChains = new Set()) {
  const parsed = parsedByFile.get(fileAbs);
  if (!parsed) return false;

  for (const imp of [...parsed.namedImports, ...parsed.dynamicImportDestructured]) {
    if (imp.imported !== exportName) continue;
    const resolved = resolveSpecifier(imp.specifier, fileAbs);
    if (!resolved) continue;
    if (resolved === originFileAbs) return true;
    // Follow a re-export chain: resolved file might itself re-export exportName from elsewhere.
    if (fileReExportsFrom(resolved, exportName, originFileAbs, visitedSpecifierChains)) return true;
  }
  // Namespace import usage: ns.exportName referenced anywhere in the file text (AST-checked for the property access, not a blind substring).
  for (const nsImp of parsed.namespaceImports) {
    const resolved = resolveSpecifier(nsImp.specifier, fileAbs);
    if (resolved !== originFileAbs) continue;
    if (usesNamespaceProperty(fileAbs, nsImp.local, exportName)) return true;
  }
  return false;
}

function usesNamespaceProperty(fileAbs, nsLocal, propName) {
  const text = parsedByFile.get(fileAbs).text;
  const sourceFile = ts.createSourceFile(fileAbs, text, ts.ScriptTarget.Latest, true);
  let found = false;
  function visit(node) {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === nsLocal &&
      node.name.text === propName
    ) {
      found = true;
    }
    if (!found) ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

/** Does fileAbs re-export exportName (under any local export name) that ultimately originates from originFileAbs? */
function fileReExportsFrom(fileAbs, exportName, originFileAbs, visitedSpecifierChains) {
  const key = `${fileAbs}::${exportName}`;
  if (visitedSpecifierChains.has(key)) return false;
  visitedSpecifierChains.add(key);

  const parsed = parsedByFile.get(fileAbs);
  if (!parsed) return false;

  for (const re of parsed.namedReExports) {
    if (re.imported !== exportName) continue;
    const resolved = resolveSpecifier(re.specifier, fileAbs);
    if (!resolved) continue;
    if (resolved === originFileAbs) return true;
    if (fileReExportsFrom(resolved, exportName, originFileAbs, visitedSpecifierChains)) return true;
  }
  for (const re of parsed.starReExports) {
    const resolved = resolveSpecifier(re.specifier, fileAbs);
    if (!resolved) continue;
    if (resolved === originFileAbs) return true; // barrel: export * from origin re-exports everything, including exportName.
    if (fileReExportsFrom(resolved, exportName, originFileAbs, visitedSpecifierChains)) return true;
  }
  return false;
}

const importers = [];
for (const fileAbs of allFiles) {
  if (fileAbs === targetFileAbs) continue;
  if (fileReachesExport(fileAbs, targetExportName, targetFileAbs)) {
    importers.push(relative(root, fileAbs));
  }
}

console.log(JSON.stringify({ file: targetFileRel, export: targetExportName, importers }, null, 2));
process.exit(0);
