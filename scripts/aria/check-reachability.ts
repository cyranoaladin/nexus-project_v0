import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;
const NEXT_ENTRYPOINT = /(?:^|\/)(?:page|route|layout|template|default|loading|error|not-found)\.(?:ts|tsx|js|jsx)$/;

function sourceFilesUnder(path: string): readonly string[] {
  const absoluteRoot = resolve(ROOT, path);
  const files: string[] = [];
  const visit = (absolute: string): void => {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      const child = join(absolute, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (SOURCE_EXTENSIONS.includes(extname(entry.name) as typeof SOURCE_EXTENSIONS[number])) {
        files.push(relative(ROOT, child));
      }
    }
  };
  visit(absoluteRoot);
  return files.sort();
}

function importsOf(path: string): readonly string[] {
  const text = readFileSync(resolve(ROOT, path), 'utf8');
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

function resolveLocalImport(importer: string, specifier: string): string | null {
  let candidate: string;
  if (specifier.startsWith('@/')) candidate = resolve(ROOT, specifier.slice(2));
  else if (specifier.startsWith('.')) candidate = resolve(ROOT, dirname(importer), specifier);
  else return null;

  const candidates = [
    candidate,
    ...SOURCE_EXTENSIONS.map((extension) => `${candidate}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => join(candidate, `index${extension}`)),
  ];
  const found = candidates.find(isFile);
  return found ? relative(ROOT, found) : null;
}

function packageScriptEntrypoints(): readonly string[] {
  const packageJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const entrypoints = new Set<string>();
  const pattern = /(?:^|[;&|]\s*|\s)(?:npx\s+)?(?:tsx|node)\s+(scripts\/aria\/[^\s'";|&]+\.(?:ts|js|mjs))/g;
  for (const command of Object.values(packageJson.scripts ?? {})) {
    for (const match of command.matchAll(pattern)) {
      if (isFile(resolve(ROOT, match[1]))) entrypoints.add(match[1]);
    }
  }
  return [...entrypoints].sort();
}

function runtimeEntrypoints(): readonly string[] {
  const appEntrypoints = sourceFilesUnder('app').filter((path) => NEXT_ENTRYPOINT.test(path));
  const conventional = ['middleware.ts', 'instrumentation.ts', 'instrumentation-client.ts']
    .filter((path) => isFile(resolve(ROOT, path)));
  return [...appEntrypoints, ...conventional, ...packageScriptEntrypoints()];
}

function reachableFrom(entrypoints: readonly string[]): ReadonlySet<string> {
  const reachable = new Set<string>();
  const pending = [...entrypoints];
  while (pending.length > 0) {
    const path = pending.pop();
    if (!path || reachable.has(path)) continue;
    reachable.add(path);
    for (const specifier of importsOf(path)) {
      const dependency = resolveLocalImport(path, specifier);
      if (dependency && !reachable.has(dependency)) pending.push(dependency);
    }
  }
  return reachable;
}

function unreachableUnder(path: string, reachable: ReadonlySet<string>): readonly string[] {
  return sourceFilesUnder(path).filter((file) => !reachable.has(file));
}

function report(label: string, paths: readonly string[]): void {
  process.stdout.write(`${label}=${paths.length}\n`);
  for (const path of paths) process.stdout.write(`${label}_FILE=${path}\n`);
}

const reachable = reachableFrom(runtimeEntrypoints());
const deadCode = unreachableUnder('lib/aria', reachable);
const orphans = unreachableUnder('components/aria', reachable);
const zombies = unreachableUnder('scripts/aria', reachable);

report('ARIA_DEAD_CODE', deadCode);
report('ARIA_ORPHANS', orphans);
report('ARIA_ZOMBIES', zombies);

if (deadCode.length + orphans.length + zombies.length > 0) process.exitCode = 1;
