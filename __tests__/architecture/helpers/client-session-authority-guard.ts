import ts from 'typescript';

const owner = 'components/auth/SessionRecoveryProvider.tsx';
const allowed: Record<string, readonly string[]> = {
  [owner]: ['useSession', 'getSession', 'signOut'],
  'components/providers.tsx': ['SessionProvider'],
  'app/auth/signin/SignInForm.tsx': ['getSession', 'signIn'],
  'app/auth/activate/page.tsx': ['signIn'],
};

/** All runtime modules are scanned, including barrels. Aliasing never grants capabilities. */
export function clientSessionAuthorityViolations(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: string[] = [];
  const bindings = new Map<string, ts.Expression[]>();
  const canonicalHooks = new Set<string>();
  const projectionMembers = { data: new Set<string>(), status: new Set<string>() };
  const destructured: ts.VariableDeclaration[] = [];
  file.statements.forEach(node => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteralLike(node.moduleSpecifier)
      || !['@/components/auth/SessionRecoveryProvider', '@/hooks/use-verified-session'].includes(node.moduleSpecifier.text)) return;
    const names = node.importClause?.namedBindings;
    if (names && ts.isNamedImports(names)) names.elements.forEach(element => {
      if (['useCanonicalSession', 'useVerifiedSession'].includes((element.propertyName ?? element.name).text)) canonicalHooks.add(element.name.text);
    });
  });
  const collect = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      bindings.set(node.name.text, [...(bindings.get(node.name.text) ?? []), node.initializer]);
    }
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer) destructured.push(node);
    ts.forEachChild(node, collect);
  };
  collect(file);
  const strings = (node: ts.Node | undefined, seen = new Set<string>()): string[] => {
    if (!node) return [];
    if (ts.isStringLiteralLike(node)) return [node.text];
    if (ts.isParenthesizedExpression(node)) return strings(node.expression, seen);
    if (ts.isIdentifier(node) && !seen.has(node.text)) {
      return (bindings.get(node.text) ?? []).flatMap(value => strings(value, new Set([...seen, node.text])));
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return strings(node.left, seen).flatMap(left => strings(node.right, seen).map(right => left + right));
    }
    if (ts.isTemplateExpression(node)) {
      return node.templateSpans.reduce((prefixes, span) => prefixes.flatMap(prefix =>
        strings(span.expression, seen).map(value => prefix + value + span.literal.text)), [node.head.text]);
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL') return strings(node.arguments?.[0], seen);
    return [];
  };
  const unwrap = (node: ts.Expression): ts.Expression => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  // Resolve ordinary projection/member aliases without requiring destructuring.
  // All these hooks expose the same canonical observation; a positive status
  // from that observation may guard its data through either spelling.
  const canonicalProjection = (node: ts.Expression, seen = new Set<string>()): boolean => {
    node = unwrap(node);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) return canonicalHooks.has(node.expression.text);
    if (ts.isIdentifier(node) && !seen.has(node.text)) {
      return (bindings.get(node.text) ?? []).some(value => canonicalProjection(value, new Set([...seen, node.text])));
    }
    return false;
  };
  for (const declaration of destructured) {
    if (!ts.isObjectBindingPattern(declaration.name) || !canonicalProjection(declaration.initializer!)) continue;
    for (const binding of declaration.name.elements) {
      const member = (binding.propertyName ?? binding.name).getText(file);
      if ((member === 'data' || member === 'status') && ts.isIdentifier(binding.name)) projectionMembers[member].add(binding.name.text);
    }
  }
  const canonicalMember = (node: ts.Expression, member: 'data' | 'status', seen = new Set<string>()): boolean => {
    node = unwrap(node);
    if (ts.isPropertyAccessExpression(node)) return node.name.text === member && canonicalProjection(node.expression);
    if (ts.isElementAccessExpression(node)) return strings(node.argumentExpression).includes(member) && canonicalProjection(node.expression);
    if (ts.isIdentifier(node) && !seen.has(node.text)) {
      return projectionMembers[member].has(node.text)
        || (bindings.get(node.text) ?? []).some(value => canonicalMember(value, member, new Set([...seen, node.text])));
    }
    return false;
  };
  const absentProjection = (node: ts.Expression): boolean => {
    node = unwrap(node);
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
      const operand = unwrap(node.operand);
      if (canonicalMember(operand, 'data')) return true;
    }
    if (ts.isBinaryExpression(node)) {
      if ([ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken].includes(node.operatorToken.kind)) {
        for (const [value, empty] of [[node.left, node.right], [node.right, node.left]]) {
          if (canonicalMember(value, 'data')
            && (empty.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(empty) && empty.text === 'undefined'))) return true;
        }
      }
      if ([ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(node.operatorToken.kind)) {
        return absentProjection(node.left) || absentProjection(node.right);
      }
    }
    return false;
  };
  // Whether taking this condition's true branch rules out canonical LOADING.
  // OR needs proof on both sides; AND needs proof on either side.
  const excludesLoading = (node: ts.Expression): boolean => {
    node = unwrap(node);
    if (!ts.isBinaryExpression(node)) return false;
    const operator = node.operatorToken.kind;
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken) return excludesLoading(node.left) || excludesLoading(node.right);
    if (operator === ts.SyntaxKind.BarBarToken) return excludesLoading(node.left) && excludesLoading(node.right);
    for (const [value, state] of [[node.left, node.right], [node.right, node.left]]) {
      if (!canonicalMember(value, 'status') || !ts.isStringLiteralLike(state)) continue;
      if ([ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken].includes(operator)) return ['authenticated', 'unauthenticated'].includes(state.text);
      if ([ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(operator)) return state.text === 'loading';
    }
    return false;
  };
  const returns = (node: ts.Statement): boolean => ts.isReturnStatement(node) || ts.isThrowStatement(node)
    || (ts.isBlock(node) && node.statements.some(statement => ts.isReturnStatement(statement) || ts.isThrowStatement(statement)));
  const loadingReturns = (node: ts.Statement): boolean => {
    if (!ts.isIfStatement(node) || !returns(node.thenStatement)) return false;
    const condition = unwrap(node.expression);
    if (!ts.isBinaryExpression(condition) || ![ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken].includes(condition.operatorToken.kind)) return false;
    return [[condition.left, condition.right], [condition.right, condition.left]].some(([value, state]) =>
      canonicalMember(value, 'status') && ts.isStringLiteralLike(state) && state.text === 'loading');
  };
  const verifiedBefore = (node: ts.Node): boolean => {
    let child = node;
    for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
      if (ts.isIfStatement(parent) && child === parent.thenStatement && excludesLoading(parent.expression)) return true;
      if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        && child === parent.right && excludesLoading(parent.left)) return true;
      if (ts.isBlock(parent) && parent.statements.some(statement => statement.end <= child.pos && loadingReturns(statement))) return true;
      if (ts.isFunctionLike(parent)) break;
    }
    return false;
  };
  const report = (node: ts.Node) => violations.push(`${path}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`);
  const isAuthClient = (node: ts.Node | undefined) => !!node && ts.isStringLiteralLike(node) && node.text === 'next-auth/react';
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && isAuthClient(node.moduleSpecifier)) {
      const clause = node.importClause;
      if (clause?.isTypeOnly) return;
      const bindings = clause?.namedBindings;
      if (!clause || clause.name || !bindings || !ts.isNamedImports(bindings)) report(node);
      else for (const imported of bindings.elements) {
        if (!imported.isTypeOnly && !allowed[path]?.includes((imported.propertyName ?? imported.name).text)) report(imported);
      }
    }
    if (ts.isExportDeclaration(node) && !node.isTypeOnly && isAuthClient(node.moduleSpecifier)) report(node);
    if (ts.isCallExpression(node)) {
      const argumentsText = node.arguments.flatMap(argument => strings(argument));
      if (argumentsText.includes('next-auth/react')) report(node);
      if (argumentsText.some(value => /^(?:https?:\/\/[^/]+)?\/api\/auth\/session(?:[/?#]|$)/.test(value))
        && ![owner, 'lib/auth/static-session-recovery.ts'].includes(path)) report(node);
      if (argumentsText.some(value => /^\/auth\/signin(?:[/?#]|$)/.test(value))) {
        for (let ancestor: ts.Node = node; ancestor.parent && !ts.isFunctionLike(ancestor.parent); ancestor = ancestor.parent) {
          const parent = ancestor.parent;
          const condition = ts.isIfStatement(parent) && parent.thenStatement === ancestor ? parent.expression
            : ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
              && parent.right === ancestor ? parent.left : undefined;
          if (condition && absentProjection(condition) && !verifiedBefore(node)) { report(node); break; }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return violations;
}
