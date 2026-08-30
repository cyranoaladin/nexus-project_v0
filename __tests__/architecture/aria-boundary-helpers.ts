import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

export const repositoryRoot = process.cwd();

export function source(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

export function sourceFilesUnder(...roots: string[]): readonly string[] {
  const files: string[] = [];
  const visit = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      const absolute = join(path, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (['.ts', '.tsx', '.js', '.mjs'].includes(extname(entry.name))) {
        files.push(relative(repositoryRoot, absolute));
      }
    }
  };
  for (const root of roots) visit(resolve(repositoryRoot, root));
  return files.sort();
}

export function importsOf(path: string): readonly string[] {
  const text = source(path);
  const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) imports.push(argument.text);
    }
    node.forEachChild(visit);
  };
  visit(ast);
  return imports;
}
