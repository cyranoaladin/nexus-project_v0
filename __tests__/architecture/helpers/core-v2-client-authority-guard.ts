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
        const kind = isRequireCall ? 'require' : 'dynamic-import';
        const label = isRequireCall ? 'require' : 'dynamic import';
        if (argument) {
          // A no-substitution template literal (backtick string, no
          // `${...}`) is a distinct AST node kind from a plain string
          // literal, but is semantically identical at runtime AND to
          // bundlers' static dependency-graph resolution — treated the
          // same as a string literal (Review B, final round: confirmed
          // working, zero-effort bypass when only isStringLiteral was
          // checked).
          if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
            if (resolvesToGeneratedClient(argument.text, fileAbsDir, repoRoot)) {
              violations.push({
                file: fileRelPath,
                line: lineOf(sourceFile, node),
                kind,
                detail: `${label} of "${argument.text}"`,
              });
            }
          } else {
            // The argument is neither literal form — built by
            // concatenation, held in a variable, or otherwise computed.
            // Its target cannot be resolved statically at all, so it
            // cannot be positively ruled out as unrelated either. Fail
            // closed: flag it as suspicious rather than silently passing
            // an unanalyzable reference through unguarded. False positives
            // on a genuinely unrelated computed require are an acceptable
            // cost in this narrow, Core-v2-only scan scope; a silent
            // bypass of the client-authority boundary is not.
            violations.push({
              file: fileRelPath,
              line: lineOf(sourceFile, node),
              kind,
              detail: `${label} with a non-literal argument that cannot be statically ruled out as unrelated to the generated Core v2 client module`,
            });
          }
        }
      }
    }

    node.forEachChild(visit);
  };

  visit(sourceFile);
  return violations;
}

/**
 * Shared with __tests__/architecture/core-v2-legacy-guards.test.ts and
 * __tests__/core-v2/rag-independence.test.ts, which import this rather than
 * keeping their own copies. A first consolidation pass (Review C, prior
 * round) collapsed the two __tests__/architecture/ copies but missed this
 * third, differently-shaped one in __tests__/core-v2/ (it also matched
 * `.prisma` files, hence the `extensions` parameter below) — found
 * independently by Review B and Review C in the same final round, now
 * closed. A fourth copy lives in the separately-owned
 * __tests__/architecture/aria-boundary-helpers.ts, out of scope for this PR
 * to touch (different module, different ownership, not this duplication).
 *
 * `generated` is excluded by PATH (must end in `core-v2/generated`), not by
 * bare directory name (Review B, final round): this walker is also reused
 * by core-v2-legacy-guards.test.ts's listLiveRuntimeFiles(), which scans the
 * entire app/, lib/, components/, scripts/ trees for CORE_V2_MUST_NOT_BE_
 * IMPORTED_BY_LIVE_RUNTIME. A bare `entry.name === 'generated'` match would
 * silently skip ANY directory named "generated" anywhere in that broad
 * scan (e.g. a future codegen tool's output under app/**\/generated/ or
 * lib/**\/generated/) — exactly the accidental-live-bundle-coupling this
 * guard exists to catch. Scoping to the real Prisma output path keeps this
 * walker's own narrow scan (app/api/v2, lib/core-v2, scripts/core-v2, none
 * of which contain any other "generated" dir) behaving identically.
 */
export function listFilesRecursive(dir: string, extensions: readonly string[] = ['.ts', '.tsx']): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  const coreV2GeneratedSuffix = join('core-v2', 'generated');
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.name === 'generated' && full.endsWith(coreV2GeneratedSuffix)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(full, extensions));
    } else if (extensions.includes(extname(entry.name))) {
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
  const files = scanDirs.flatMap((dir) => listFilesRecursive(dir)).filter((f) => f !== excludedFile);

  const violations: ClientAuthorityViolation[] = [];
  for (const absFile of files) {
    const relFile = relative(repoRoot, absFile);
    const text = readFileSync(absFile, 'utf8');
    violations.push(...analyzeSourceForClientAuthorityViolations(relFile, text, repoRoot));
  }
  return violations;
}
