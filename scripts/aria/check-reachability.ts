import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sh'] as const;
const NEXT_ENTRYPOINT = /(?:^|\/)(?:page|route|layout|template|default|loading|error|global-error|not-found|sitemap|robots|manifest)\.(?:ts|tsx|js|jsx)$/;

function hasOnlyTypeOnlyElements(
  elements: readonly { readonly isTypeOnly: boolean }[],
): boolean {
  return elements.length > 0 && elements.every((element) => element.isTypeOnly);
}

export function sourceFilesUnder(repositoryRoot: string, path: string): readonly string[] {
  const absoluteRoot = resolve(repositoryRoot, path);
  const files: string[] = [];
  const visit = (absolute: string): void => {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      const child = join(absolute, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`ARIA_REACHABILITY_SOURCE_ENTRY_INVALID:${relative(repositoryRoot, child)}`);
      }
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
  if (extname(path) === '.sh') {
    const dependencies: string[] = [];
    const collect = (pattern: RegExp): void => {
      for (const match of text.matchAll(pattern)) {
        const dependency = match[1] ?? match[2] ?? match[3];
        if (dependency && !dependency.includes('$')) dependencies.push(dependency);
      }
    };
    for (const match of text.matchAll(
      /^\s*(?:source|\.)\s+"\$\(dirname "\$0"\)\/([^"]+)"/gm,
    )) {
      if (match[1]) dependencies.push(`./${match[1]}`);
    }
    collect(/^\s*(?:source|\.)\s+(?:"([^"]+)"|'([^']+)'|([^\s;]+))/gm);
    collect(/(?:^|[;&|]\s*|\n\s*)(?:bash|node|tsx)\s+(?:"([^"]+)"|'([^']+)'|([^\s;]+))/g);
    return dependencies;
  }
  const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const typeOnlyNamedImport = !clause?.name
        && clause?.namedBindings
        && ts.isNamedImports(clause.namedBindings)
        && hasOnlyTypeOnlyElements(clause.namedBindings.elements);
      if (!clause?.isTypeOnly && !typeOnlyNamedImport) imports.push(node.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(node)
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)) {
      const typeOnlyNamedExport = node.exportClause
        && ts.isNamedExports(node.exportClause)
        && hasOnlyTypeOnlyElements(node.exportClause.elements);
      if (!node.isTypeOnly && !typeOnlyNamedExport) imports.push(node.moduleSpecifier.text);
    }
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
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

function resolveLocalImport(repositoryRoot: string, importer: string, specifier: string): string | null {
  let candidate: string;
  if (specifier.startsWith('@/')) candidate = resolve(repositoryRoot, specifier.slice(2));
  else if (specifier.startsWith('.')) candidate = resolve(repositoryRoot, dirname(importer), specifier);
  else if (specifier.startsWith('scripts/')) candidate = resolve(repositoryRoot, specifier);
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
  const pattern = /(?:^|[;&|]\s*|\s)(?:npx\s+)?(?:tsx|node|bash)\s+(scripts\/[^\s'";|&]+\.(?:ts|js|mjs|sh))/g;
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
  return sourceFilesUnder(repositoryRoot, path).filter(
    (file) => !reachable.has(file) && !isPureTypeModule(repositoryRoot, file),
  );
}

function isPureTypeModule(repositoryRoot: string, path: string): boolean {
  if (extname(path) === '.sh') return false;
  const text = readFileSync(resolve(repositoryRoot, path), 'utf8');
  const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  return ast.statements.every((statement) => {
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
      || ts.isEmptyStatement(statement)) return true;
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      return clause?.isTypeOnly === true
        || Boolean(!clause?.name
          && clause?.namedBindings
          && ts.isNamedImports(clause.namedBindings)
          && hasOnlyTypeOnlyElements(clause.namedBindings.elements));
    }
    if (ts.isExportDeclaration(statement)) {
      return statement.isTypeOnly
        || Boolean(statement.exportClause
          && ts.isNamedExports(statement.exportClause)
          && hasOnlyTypeOnlyElements(statement.exportClause.elements));
    }
    return false;
  });
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
