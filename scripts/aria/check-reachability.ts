import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;
const NEXT_ENTRYPOINT = /(?:^|\/)(?:page|route|layout|template|default|loading|error|not-found)\.(?:ts|tsx|js|jsx)$/;

function sourceFilesUnder(repositoryRoot: string, path: string): readonly string[] {
  const absoluteRoot = resolve(repositoryRoot, path);
  const files: string[] = [];
  const visit = (absolute: string): void => {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      const child = join(absolute, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (SOURCE_EXTENSIONS.includes(extname(entry.name) as typeof SOURCE_EXTENSIONS[number])) {
        files.push(relative(repositoryRoot, child));
      }
    }
  };
  visit(absoluteRoot);
  return files.sort();
}

function importsOf(repositoryRoot: string, path: string): readonly string[] {
  const text = readFileSync(resolve(repositoryRoot, path), 'utf8');
  const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
    ) imports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node)) {
      const argument = node.arguments[0];
      if (
        argument
        && ts.isStringLiteral(argument)
        && (node.expression.kind === ts.SyntaxKind.ImportKeyword
          || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      ) imports.push(argument.text);
    }
    node.forEachChild(visit);
  };
  visit(ast);
  return imports;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function resolveLocalImport(repositoryRoot: string, importer: string, specifier: string): string | null {
  let candidate: string;
  if (specifier.startsWith('@/')) candidate = resolve(repositoryRoot, specifier.slice(2));
  else if (specifier.startsWith('.')) candidate = resolve(repositoryRoot, dirname(importer), specifier);
  else return null;

  const candidates = [
    candidate,
    ...SOURCE_EXTENSIONS.map((extension) => `${candidate}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => join(candidate, `index${extension}`)),
  ];
  const found = candidates.find(isFile);
  return found ? relative(repositoryRoot, found) : null;
}

function packageScriptEntrypoints(repositoryRoot: string): readonly string[] {
  const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const entrypoints = new Set<string>();
  const pattern = /(?:^|[;&|]\s*|\s)(?:npx\s+)?(?:tsx|node)\s+(scripts\/aria\/[^\s'";|&]+\.(?:ts|js|mjs))/g;
  for (const command of Object.values(packageJson.scripts ?? {})) {
    for (const match of command.matchAll(pattern)) {
      if (isFile(resolve(repositoryRoot, match[1]))) entrypoints.add(match[1]);
    }
  }
  return [...entrypoints].sort();
}

function runtimeEntrypoints(repositoryRoot: string): readonly string[] {
  const appEntrypoints = sourceFilesUnder(repositoryRoot, 'app').filter((path) => NEXT_ENTRYPOINT.test(path));
  const conventional = ['middleware.ts', 'instrumentation.ts', 'instrumentation-client.ts']
    .filter((path) => isFile(resolve(repositoryRoot, path)));
  return [...appEntrypoints, ...conventional, ...packageScriptEntrypoints(repositoryRoot)];
}

function reachableFrom(repositoryRoot: string, entrypoints: readonly string[]): ReadonlySet<string> {
  const reachable = new Set<string>();
  const pending = [...entrypoints];
  while (pending.length > 0) {
    const path = pending.pop();
    if (!path || reachable.has(path)) continue;
    reachable.add(path);
    for (const specifier of importsOf(repositoryRoot, path)) {
      const dependency = resolveLocalImport(repositoryRoot, path, specifier);
      if (dependency && !reachable.has(dependency)) pending.push(dependency);
    }
  }
  return reachable;
}

function unreachableUnder(
  repositoryRoot: string,
  path: string,
  reachable: ReadonlySet<string>,
): readonly string[] {
  return sourceFilesUnder(repositoryRoot, path).filter((file) => !reachable.has(file));
}

export interface AriaReachabilityReport {
  readonly deadCode: readonly string[];
  readonly orphans: readonly string[];
  readonly zombies: readonly string[];
  readonly violationCount: number;
}

export function inspectAriaReachability(repositoryRoot: string): AriaReachabilityReport {
  const reachable = reachableFrom(repositoryRoot, runtimeEntrypoints(repositoryRoot));
  const deadCode = unreachableUnder(repositoryRoot, 'lib/aria', reachable);
  const orphans = unreachableUnder(repositoryRoot, 'components/aria', reachable);
  const zombies = unreachableUnder(repositoryRoot, 'scripts/aria', reachable);
  return Object.freeze({
    deadCode: Object.freeze(deadCode),
    orphans: Object.freeze(orphans),
    zombies: Object.freeze(zombies),
    violationCount: deadCode.length + orphans.length + zombies.length,
  });
}

export function renderAriaReachabilityReport(
  value: AriaReachabilityReport,
  write: (chunk: string) => void = (chunk) => process.stdout.write(chunk),
): void {
  const report = (label: string, paths: readonly string[]): void => {
    write(`${label}=${paths.length}\n`);
    for (const path of paths) write(`${label}_FILE=${path}\n`);
  };
  report('ARIA_DEAD_CODE', value.deadCode);
  report('ARIA_ORPHANS', value.orphans);
  report('ARIA_ZOMBIES', value.zombies);
}

export function runAriaReachabilityCheck(repositoryRoot = process.cwd()): number {
  const report = inspectAriaReachability(repositoryRoot);
  renderAriaReachabilityReport(report);
  return report.violationCount > 0 ? 1 : 0;
}

if (require.main === module) process.exitCode = runAriaReachabilityCheck();
