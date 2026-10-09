import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root = process.cwd();
function dependencies(file: string): string[] {
  const seen = new Set<string>();
  function visit(filename: string) {
    if (seen.has(filename)) return;
    seen.add(filename);
    const source = ts.createSourceFile(filename, fs.readFileSync(path.join(root, filename), 'utf8'), ts.ScriptTarget.Latest, true);
    function walk(node: ts.Node) {
      if ((ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly)
        || (ts.isExportDeclaration(node) && !node.isTypeOnly)) {
        const specifier = node.moduleSpecifier;
        if (specifier && ts.isStringLiteral(specifier)) {
          const value = specifier.text;
          const relative = value.startsWith('@/') ? value.slice(2)
            : value.startsWith('.') ? path.posix.join(path.posix.dirname(filename), value) : null;
          if (relative) {
            const candidate = [relative, relative + '.ts', relative + '.tsx', relative + '/index.ts'].find(p => {
              try { return fs.statSync(path.join(root, p)).isFile(); } catch { return false; }
            });
            if (candidate) visit(candidate);
          }
        }
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  visit(file);
  return [...seen];
}
it.each(['app/dashboard/admin/facturation/page.tsx', 'app/dashboard/assistante/paiements/page.tsx'])('%s never imports the server RBAC module', entry => {
  expect(dependencies(entry)).not.toContain('lib/rbac.ts');
});
it('the canonical client permission map contains no runtime import or dynamic server dependency', () => {
  const source = fs.readFileSync(path.join(root, 'lib/rbac/permissions.ts'), 'utf8');
  const parsed = ts.createSourceFile('permissions.ts', source, ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  function walk(node: ts.Node) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) imports.push(node.moduleSpecifier.getText(parsed));
    if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier) imports.push('runtime export');
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) imports.push('dynamic import');
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') imports.push('require');
    ts.forEachChild(node, walk);
  }
  walk(parsed);
  expect(imports).toEqual([]);
});
