import { readFileSync, readdirSync, type Dirent } from 'node:fs';
import { extname, join, normalize, relative, resolve } from 'node:path';
import ts from 'typescript';

/**
 * CORE_V2_ONLY_CLIENT_TS_MAY_CONSTRUCT_A_CLIENT (foundation hardening,
 * DATABASE_COLLISION_GUARD_WEAKNESS) — AST-based, not regex-based.
 *
 * The previous guard matched `/\bnew\s+(?:Core[Vv]2)?PrismaClient\b/` against
 * raw file text. Real gaps: an aliased import (`import { PrismaClient as X }
 * ...; new X()`), a namespace import (`new ns.PrismaClient()`), a variable
 * holding the constructor (`const Ctor = PrismaClient; new Ctor()`), a
 * CommonJS `require(...)`, a dynamic `import(...)`, or an indirect re-export
 * from another Core v2 file would all evade a construction-site regex.
 *
 * This guard sidesteps all of that by moving the boundary one step earlier:
 * it is not legal for ANY file other than lib/core-v2/client.ts to even hold
 * a VALUE reference to the generated Core v2 Prisma module at all — no
 * matter how the reference is obtained (import, aliased import, namespace
 * import, CommonJS require, dynamic import, or re-export) or what it's
 * later used for. Type-only imports (`import type { PrismaClient } from
 * '...'`, or an inline `import { type PrismaClient }` specifier) are
 * exempt: they are erased at compile time, cannot be used as a value, and
 * TypeScript itself refuses to compile a `new` expression on one — no
 * runtime construction is possible through a type-only binding. This is why
 * every repository's `import type { ..., PrismaClient } from
 * '@/core-v2/generated/client'` (type annotations only) is legitimate and
 * must not be flagged, while ANY non-type-only reference is a violation
 * regardless of downstream usage — denying value-level access categorically
 * closes the aliasing/reassignment/re-export evasion space in one rule,
 * rather than trying to enumerate every way an obtained reference could
 * later be used to construct an instance.
 */

export interface ClientAuthorityViolation {
  readonly file: string;
  readonly line: number;
  readonly kind: 'import' | 'reexport' | 'require' | 'dynamic-import';
  readonly detail: string;
}

const TARGET_SEGMENT = '/core-v2/generated/client';

function resolvesToGeneratedClient(
  specifier: string,
  importingFileAbsDir: string,
  repoRoot: string,
): boolean {
  let resolvedDir: string;
  if (specifier.startsWith('@/')) {
    resolvedDir = join(repoRoot, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    resolvedDir = resolve(importingFileAbsDir, specifier);
  } else {
    return false; // bare package specifier — cannot be this in-repo module
  }
  const normalized = normalize(resolvedDir).split('\\').join('/');
  return normalized === repoRoot.split('\\').join('/') + TARGET_SEGMENT
    || normalized.startsWith(repoRoot.split('\\').join('/') + TARGET_SEGMENT + '/');
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/**
 * Pure analysis over already-loaded source text — the unit-testable core,
 * independent of the real filesystem. `fileRelPath` only needs to be
 * accurate enough for relative-specifier resolution and for the reported
 * `file` field; it does not need to exist on disk.
 */
export function analyzeSourceForClientAuthorityViolations(
  fileRelPath: string,
  sourceText: string,
  repoRoot: string,
): ClientAuthorityViolation[] {
  const violations: ClientAuthorityViolation[] = [];
  const fileAbsDir = resolve(repoRoot, fileRelPath, '..');
  const sourceFile = ts.createSourceFile(
    fileRelPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileRelPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      if (resolvesToGeneratedClient(specifier, fileAbsDir, repoRoot)) {
        const clause = node.importClause;
        const isTypeOnlyDeclaration = clause?.isTypeOnly === true;
        // A non-type-only import clause can still carry per-specifier
        // `type` modifiers (`import { type PrismaClient, Prisma } from
        // '...'`) — only flag if at least one binding is a real value
        // binding.
        let hasValueBinding = false;
        if (!isTypeOnlyDeclaration) {
          if (clause?.name) hasValueBinding = true; // default import
          const bindings = clause?.namedBindings;
          if (bindings && ts.isNamespaceImport(bindings)) hasValueBinding = true;
          if (bindings && ts.isNamedImports(bindings)) {
            hasValueBinding = hasValueBinding || bindings.elements.some((el) => !el.isTypeOnly);
          }
        }
        if (hasValueBinding) {
          violations.push({
            file: fileRelPath,
            line: lineOf(sourceFile, node),
            kind: 'import',
            detail: `non-type-only import of "${specifier}"`,
          });
        }
      }
    }

    if (
      ts.isExportDeclaration(node)
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
      && !node.isTypeOnly
    ) {
      const specifier = node.moduleSpecifier.text;
      if (resolvesToGeneratedClient(specifier, fileAbsDir, repoRoot)) {
        const clause = node.exportClause;
        const hasValueBinding =
          !clause || !ts.isNamedExports(clause) || clause.elements.some((el) => !el.isTypeOnly);
        if (hasValueBinding) {
          violations.push({
            file: fileRelPath,
            line: lineOf(sourceFile, node),
            kind: 'reexport',
            detail: `non-type-only re-export of "${specifier}"`,
          });
        }
      }
    }

    if (ts.isCallExpression(node)) {
      const isRequireCall =
        ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const isDynamicImportCall = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      if (isRequireCall || isDynamicImportCall) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument) && resolvesToGeneratedClient(argument.text, fileAbsDir, repoRoot)) {
          violations.push({
            file: fileRelPath,
            line: lineOf(sourceFile, node),
            kind: isRequireCall ? 'require' : 'dynamic-import',
            detail: `${isRequireCall ? 'require' : 'dynamic import'} of "${argument.text}"`,
          });
        }
      }
    }

    node.forEachChild(visit);
  };

  visit(sourceFile);
  return violations;
}

function listFilesRecursive(dir: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git' || entry.name === 'generated') {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(full));
    } else if (['.ts', '.tsx'].includes(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Production entry point: scans the real runtime-reachable Core v2
 * directories (app/api/v2, lib/core-v2, scripts/core-v2) — NOT
 * __tests__/core-v2/**, which has its own legitimate reasons to hold value
 * references to the generated client (e.g. `jest.spyOn(...prototype...)`
 * in the connection-leak regression tests) that are not construction
 * bypasses. lib/core-v2/client.ts itself is the one authorized file and is
 * excluded from scanning.
 */
export function findCoreV2ClientAuthorityViolations(repoRoot: string = process.cwd()): ClientAuthorityViolation[] {
  const scanDirs = ['app/api/v2', 'lib/core-v2', 'scripts/core-v2'].map((d) => join(repoRoot, d));
  const excludedFile = join(repoRoot, 'lib/core-v2/client.ts');
  const files = scanDirs.flatMap(listFilesRecursive).filter((f) => f !== excludedFile);

  const violations: ClientAuthorityViolation[] = [];
  for (const absFile of files) {
    const relFile = relative(repoRoot, absFile);
    const text = readFileSync(absFile, 'utf8');
    violations.push(...analyzeSourceForClientAuthorityViolations(relFile, text, repoRoot));
  }
  return violations;
}
