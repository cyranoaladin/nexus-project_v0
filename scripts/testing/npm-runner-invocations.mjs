import ts from 'typescript';

const executableCalls = new Set(['spawnSync', 'spawn', 'execFileSync', 'execFile']);
const fullLaneOptions = new Set(['--', '--ci', '--json', '--silent', '--runInBand', '--coverage', '--verbose']);
/** Discover only statically literal, unrestricted npm subprocesses; never evaluate wrapper source. */
export function discoverRunnerNpmScripts(source, format = 'typescript') {
  if (format === 'shell') {
    return [...new Set([...source.matchAll(/(?:^|[;&|\n])\s*npm run ([\w:.-]+)/g)].map(match => match[1]))];
  }
  const ast = ts.createSourceFile('runner.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length > 0) return [];
  const found = new Set();
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && executableCalls.has(node.expression.text)) {
      const [executable, argumentList] = node.arguments;
      if (executable && ts.isStringLiteralLike(executable) && executable.text === 'npm' && argumentList && ts.isArrayLiteralExpression(argumentList) && argumentList.elements.every(ts.isStringLiteralLike)) {
        const args = argumentList.elements.map(argument => argument.text);
        if (args[0] === 'run' && /^[\w:.-]+$/.test(args[1] || '') && args.slice(2).every(argument => fullLaneOptions.has(argument))) found.add(args[1]);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return [...found];
}
