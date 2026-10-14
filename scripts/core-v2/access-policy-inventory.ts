/** Observed source inventory only. It NEVER writes the normative access policy
 * and does not claim to execute HTTP requests or prove contextual authority. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

interface Location { file: string; line: number; start: number }
export interface ObservedGate { kind: 'CAPABILITY' | 'ROLE_SELF_SERVICE' | 'ROLE_STAFF' | 'CREDENTIAL_AUTHORITY_IS_V1' | 'BOUNDARY_AUTH' | 'BOUNDARY_CORE' | 'BOUNDARY_HANDLER' | 'BOUNDARY_SELF_METADATA' | 'BOUNDARY_PRIVATE_V1' | 'BOUNDARY_V1_LEASE' | 'BOUNDARY_V1_RELEASE' | 'BOUNDARY_FRESH_CORE';
  value: string; source: string; line: number; declaration: Location; callSite: Location }
export interface ObservedCall { name: string; source: string; line: number; declaration: Location; callSite: Location }
export interface ObservedHandler { id: string; method: string; file: string; wrapper: string | null;
  gatePaths: ObservedGate[][]; guards: ObservedGate[]; unguardedPath: boolean; unresolved: string[]; calls: ObservedCall[];
  boundaryPaths: ObservedGate[][];
  recursiveVoidCalls: string[];
  bodyRange: { file: string; start: number; end: number } | null }
type States = ObservedGate[][];
interface Flow { active: States; returned: States; breaks: States; continues: States }
type Callable = ts.FunctionDeclaration | ts.MethodDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.ConstructorDeclaration;
interface CallFrame {
  id: string;
  owner?: Callable;
  parent?: CallFrame;
  bindings: Map<ts.Symbol, Reference>;
  instance?: Reference;
}
type Reference =
  | { kind: 'value'; node: ts.Node; frame: CallFrame; awaited: boolean }
  | { kind: 'projection'; base: Reference; property: string; frame: CallFrame }
  | { kind: 'request' | 'transaction'; key: string; frame: CallFrame }
  | { kind: 'unknown'; frame: CallFrame; definitelyUndefined?: boolean };
interface PrivateOrigin { capture: string; authentication: string; request: string }
function filesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().flatMap(name => {
    const full = join(dir, name); if (['node_modules', '.next', 'generated'].includes(name)) return [];
    return statSync(full).isDirectory() ? filesIn(full) : /\.ts$/.test(name) ? [full] : [];
  });
}
function uniquePaths(paths: States): States {
  const unique = new Map<string, ObservedGate[]>();
  for (const path of paths) {
    const last = new Map(path.filter(gate=>!gate.kind.startsWith('BOUNDARY_')).map(gate=>[`${gate.kind}:${gate.value}`,gate]));
    const gates=path.filter(gate=>gate.kind.startsWith('BOUNDARY_')||last.get(`${gate.kind}:${gate.value}`)===gate);
    const roles=gates.filter(gate=>!gate.kind.startsWith('BOUNDARY_')).map(gate=>`${gate.kind}:${gate.value}`).sort().join('|');
    const boundaries=gates.filter(gate=>gate.kind.startsWith('BOUNDARY_')).map(gate=>`${gate.kind}:${gate.value}`).join('→');
    unique.set(`${roles}#${boundaries}`, gates);
  }
  return [...unique.values()];
}
export function createAccessInventory(root: string) {
  root = resolve(root);
  const localFiles = [...filesIn(join(root, 'app/api/v2')), ...filesIn(join(root, 'lib/core-v2')),
    ...['lib/guards.ts', 'lib/csrf.ts', 'lib/rate-limit/sensitive.ts', 'lib/rate-limit/runtime.ts',
      'lib/http/bounded-request-body.ts', 'lib/auth/v1-invitation-authority.ts',
      'lib/auth/v1-account-invitation.ts', 'lib/auth/private-v1-session.ts', 'lib/auth/v1-session-authority.ts', 'lib/email/outbox-worker.ts',
      'lib/email/account-invitation-authority.ts'].map(file => join(root, file)).filter(existsSync)];
  const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
  if (config.error) throw new Error('ACCESS_INVENTORY_CONFIG_INVALID');
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const es5Library = join(dirname(ts.getDefaultLibFilePath(parsed.options)), 'lib.es5.d.ts');
  if (!existsSync(es5Library)) throw new Error('ACCESS_INVENTORY_STANDARD_LIBRARY_MISSING');
  const program = ts.createProgram([...localFiles, es5Library], { ...parsed.options, noResolve: true, noLib: true,
    types: [], noEmit: true, incremental: false });
  const checker = program.getTypeChecker();
  function symbolOf(node: ts.Node): ts.Symbol | undefined {
    let symbol = ts.isShorthandPropertyAssignment(node.parent)
      ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return symbol;
  }
  const sourceOf = (node: ts.Node) => relative(root, node.getSourceFile().fileName).split('\\').join('/');
  const lineOf = (node: ts.Node) => node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const locationOf = (node: ts.Node): Location => ({ file: sourceOf(node), line: lineOf(node), start: node.getStart() });
  const declarationOf = (node: ts.Node) => symbolOf(node)?.valueDeclaration ?? symbolOf(node)?.declarations?.[0];
  const canonical = (node: ts.Node, file: string, name: string): boolean => {
    const declaration = declarationOf(node);
    return declaration !== undefined && sourceOf(declaration) === file && symbolOf(node)?.name === name;
  };
  function callableOf(declaration: ts.Node | undefined,seen=new Set<ts.Node>()):Callable|undefined {
    if (!declaration||seen.has(declaration)) return undefined;seen.add(declaration);
    if (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration) || ts.isFunctionExpression(declaration)
      || ts.isArrowFunction(declaration) || ts.isConstructorDeclaration(declaration)) return declaration;
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      const expression = declaration.initializer;
      if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return expression;
      if (ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression)) return callableOf(declarationOf(expression),seen);
    }
    return undefined;
  }
  const bodyOf=(declaration:ts.Node|undefined)=>callableOf(declaration)?.body;
  function propagated(node:ts.CallExpression):boolean {
    let value:ts.Node=node,parent=node.parent;
    while(parent&&(ts.isParenthesizedExpression(parent)||ts.isAsExpression(parent)||ts.isNonNullExpression(parent))){value=parent;parent=parent.parent;}
    return !!parent&&(ts.isAwaitExpression(parent)||ts.isReturnStatement(parent)||ts.isArrowFunction(parent)&&parent.body===value);
  }
  function importedFrom(node: ts.Node, module: string, importedName: string): boolean {
    const symbol = checker.getSymbolAtLocation(node);
    const declaration = symbol?.declarations?.[0];
    if (!declaration || !ts.isImportSpecifier(declaration)) return false;
    const statement = declaration.parent.parent.parent;
    return ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
      && statement.moduleSpecifier.text === module && (declaration.propertyName ?? declaration.name).text === importedName;
  }
  const handlers: ObservedHandler[] = [];
  for (const file of localFiles.filter(file => file.endsWith('/route.ts') && file.startsWith(join(root, 'app/api/v2')))) {
    const module = program.getSourceFile(file); if (!module) throw new Error('ACCESS_INVENTORY_SOURCE_MISSING');
    const moduleSymbol = checker.getSymbolAtLocation(module); if (!moduleSymbol) continue;
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const method = exported.name; if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)) continue;
      const bound = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
      const declaration = bound.valueDeclaration ?? bound.declarations?.[0];
      const id = `${method} /${relative(root, file).split('\\').join('/').replace(/^app\//, '').replace(/\/route\.ts$/, '')}`;
      const calls: ObservedCall[] = []; const unresolved = new Set<string>(); const stack = new Set<ts.Node>();
      const recursiveVoidCalls = new Set<string>();
      const boundaryPaths: States = [];
      const flow = (active: States = [], returned: States = [], breaks: States = [], continues: States = []): Flow => ({active, returned, breaks, continues});
      const gateAt = (kind: ObservedGate['kind'], value: string, node: ts.CallExpression, declaration: ts.Node): ObservedGate =>
        ({kind, value, source:sourceOf(declaration), line:lineOf(declaration), declaration:locationOf(declaration), callSite:locationOf(node)});
      const rootFrame: CallFrame = { id, owner: callableOf(declaration), bindings: new Map() };
      let currentFrame = rootFrame;
      let staffFactory: ts.FunctionDeclaration | undefined;
      let staffOptions: Reference | undefined;
      const dispatchKey = `@dispatch:${id}`;
      const dirtyAuthorities = new Set<string>();
      const readonlyStack = new Set<Callable>();
      const structuralProjectionStack = new Set<Callable>();
      const unknown = (frame = currentFrame, definitelyUndefined = false): Reference =>
        ({ kind: 'unknown', frame, definitelyUndefined });
      const reference = (node: ts.Node, frame = currentFrame): Reference =>
        ({ kind: 'value', node, frame, awaited: false });
      const referenceKey = (value: Extract<Reference, { kind: 'value' }>) =>
        `${value.frame.id}:${sourceOf(value.node)}:${value.node.getStart()}:${value.node.end}:${value.node.kind}`;
      function containingCallable(node: ts.Node): Callable | undefined {
        for (let parent = node.parent; parent; parent = parent.parent)
          if (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isFunctionExpression(parent)
            || ts.isArrowFunction(parent) || ts.isConstructorDeclaration(parent)) return parent;
        return undefined;
      }
      function declarationFrame(node: ts.Node, frame: CallFrame): CallFrame {
        const owner = containingCallable(node);
        for (let candidate: CallFrame | undefined = frame; candidate; candidate = candidate.parent)
          if (candidate.owner === owner) return candidate;
        return frame;
      }
      function boundValue(symbol: ts.Symbol | undefined, frame: CallFrame): Reference | undefined {
        if (!symbol) return undefined;
        for (let candidate: CallFrame | undefined = frame; candidate; candidate = candidate.parent) {
          const value = candidate.bindings.get(symbol);
          if (value) return value;
        }
        return undefined;
      }
      function constantDeclaration(node: ts.VariableDeclaration): boolean {
        return ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const) !== 0;
      }
      function propertyName(node: ts.PropertyName | ts.BindingName | undefined): string | undefined {
        if (!node) return undefined;
        if (ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return node.text;
        if (ts.isComputedPropertyName(node)
          && (ts.isStringLiteralLike(node.expression) || ts.isNumericLiteral(node.expression))) return node.expression.text;
        return undefined;
      }
      function directlyAwaited(node: ts.CallExpression): boolean {
        let parent = node.parent;
        while (parent && (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent)
          || ts.isNonNullExpression(parent) || ts.isSatisfiesExpression(parent))) parent = parent.parent;
        return !!parent && ts.isAwaitExpression(parent);
      }
      function knownUndefined(value: Reference): boolean {
        if (value.kind === 'unknown') return value.definitelyUndefined === true;
        if (value.kind !== 'value' || !ts.isIdentifier(value.node)) return false;
        const symbol = symbolOf(value.node);
        const native = checker.resolveName('undefined', undefined, ts.SymbolFlags.Value, false);
        return !!symbol && symbol === native && !symbol.declarations?.length;
      }
      function knownNonNullish(value: Reference): boolean {
        if (value.kind !== 'value') return value.kind === 'request' || value.kind === 'transaction';
        const node = value.node;
        return ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)
          || ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)
          || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) || ts.isBigIntLiteral(node)
          || node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword;
      }
      function inertDefault(node: ts.Expression): boolean {
        if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)
          || ts.isSatisfiesExpression(node)) return inertDefault(node.expression);
        if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isIdentifier(node)
          || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) || ts.isBigIntLiteral(node)
          || [ts.SyntaxKind.NullKeyword, ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(node.kind)) return true;
        if (ts.isArrayLiteralExpression(node)) return node.elements.every(element =>
          ts.isOmittedExpression(element) || !ts.isSpreadElement(element) && inertDefault(element));
        if (ts.isObjectLiteralExpression(node)) return node.properties.every(property => {
          if (ts.isSpreadAssignment(property) || ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property)
            || propertyName(property.name) === undefined || propertyName(property.name) === '__proto__') return false;
          return ts.isPropertyAssignment(property) ? inertDefault(property.initializer)
            : ts.isShorthandPropertyAssignment(property) || ts.isMethodDeclaration(property);
        });
        return false;
      }
      function resolveReference(input: Reference, seen = new Set<string>()): Reference {
        if (input.kind !== 'value') return input;
        let node = input.node;
        let awaited = input.awaited;
        while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)
          || ts.isSatisfiesExpression(node) || ts.isAwaitExpression(node)) {
          if (ts.isAwaitExpression(node)) awaited = true;
          node = node.expression;
        }
        const value: Extract<Reference, { kind: 'value' }> = { ...input, node, awaited };
        const key = referenceKey(value);
        if (seen.has(key)) return unknown(input.frame);
        seen.add(key);
        try {
          if (node.kind === ts.SyntaxKind.ThisKeyword) {
            for (let frame: CallFrame | undefined = input.frame; frame; frame = frame.parent)
              if (frame.instance) return resolveReference(frame.instance, seen);
            return unknown(input.frame);
          }
          if (ts.isIdentifier(node)) {
            const binding = boundValue(symbolOf(node), input.frame);
            if (binding) return resolveReference(binding, seen);
            const declared = declarationOf(node);
            if (declared && ts.isVariableDeclaration(declared) && constantDeclaration(declared) && declared.initializer)
              return resolveReference(reference(declared.initializer, declarationFrame(declared, input.frame)), seen);
            if (declared && (ts.isFunctionDeclaration(declared) || ts.isMethodDeclaration(declared)
              || ts.isClassDeclaration(declared)))
              return { kind: 'value', node: declared, frame: declarationFrame(declared, input.frame), awaited: false };
            if (declared && ts.isBindingElement(declared) && !declared.dotDotDotToken && !declared.initializer
              && ts.isObjectBindingPattern(declared.parent) && ts.isVariableDeclaration(declared.parent.parent)) {
              const variable = declared.parent.parent;
              const field = propertyName(declared.propertyName ?? declared.name);
              if (constantDeclaration(variable) && variable.initializer && field !== undefined)
                return project(reference(variable.initializer, declarationFrame(variable, input.frame)), field, seen);
            }
          }
          if (ts.isPropertyAccessExpression(node))
            return project(reference(node.expression, input.frame), node.name.text, seen);
          if (ts.isElementAccessExpression(node) && node.argumentExpression
            && (ts.isStringLiteralLike(node.argumentExpression) || ts.isNumericLiteral(node.argumentExpression)))
            return project(reference(node.expression, input.frame), node.argumentExpression.text, seen);
          if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
            const left = resolveReference(reference(node.left, input.frame), seen);
            if (knownUndefined(left) || left.kind === 'value' && left.node.kind === ts.SyntaxKind.NullKeyword)
              return resolveReference(reference(node.right, input.frame), seen);
            if (knownNonNullish(left)) return left;
          }
          return value;
        } finally { seen.delete(key); }
      }
      // undefined means definitely absent. An unknown spread or computed key
      // blocks an earlier property; the last effective property always wins.
      function findObjectProperty(input: Reference, name: string, seen = new Set<string>()): Reference | undefined {
        const value = resolveReference(input);
        if (value.kind === 'value' && ts.isCallExpression(value.node)) {
          const field = project(value, name, seen);
          if (field.kind === 'projection' && field.property === name && sameValue(field.base, value))
            return unknown(value.frame);
          return field.kind === 'unknown' && field.definitelyUndefined ? undefined : field;
        }
        if (value.kind !== 'value' || !ts.isObjectLiteralExpression(value.node)) return unknown(value.frame);
        const key = `property:${referenceKey(value)}:${name}`;
        if (seen.has(key)) return unknown(value.frame);
        seen.add(key);
        try {
          for (let index = value.node.properties.length - 1; index >= 0; index--) {
            const property = value.node.properties[index];
            if (ts.isSpreadAssignment(property)) {
              const spread = findObjectProperty(reference(property.expression, value.frame), name, seen);
              if (spread !== undefined) return spread;
              continue;
            }
            const field = propertyName(property.name);
            if (field === undefined) return unknown(value.frame);
            if (field === '__proto__' && field !== name && ts.isPropertyAssignment(property)
              && !ts.isComputedPropertyName(property.name)) return unknown(value.frame);
            if (field !== name) continue;
            if (ts.isPropertyAssignment(property)) return reference(property.initializer, value.frame);
            if (ts.isShorthandPropertyAssignment(property)) return reference(property.name, value.frame);
            if (ts.isMethodDeclaration(property)) return reference(property, value.frame);
            return unknown(value.frame);
          }
          return undefined;
        } finally { seen.delete(key); }
      }
      function objectProperty(input: Reference, name: string): Reference {
        return findObjectProperty(input, name) ?? unknown(input.frame, true);
      }
      function absentOptionalCall(node: ts.CallExpression): boolean {
        if (!node.questionDotToken) return false;
        const expression=node.expression;
        let receiver:ts.Expression;let field:string;
        if(ts.isPropertyAccessExpression(expression)){receiver=expression.expression;field=expression.name.text;}
        else if(ts.isElementAccessExpression(expression)&&expression.argumentExpression
          &&(ts.isStringLiteralLike(expression.argumentExpression)||ts.isNumericLiteral(expression.argumentExpression))){
          receiver=expression.expression;field=expression.argumentExpression.text;
        }else return false;
        const base=resolveReference(reference(receiver));
        return base.kind==='value'&&ts.isObjectLiteralExpression(base.node)&&findObjectProperty(base,field)===undefined;
      }
      function project(input: Reference, name: string, seen = new Set<string>()): Reference {
        const base = resolveReference(input, seen);
        if (base.kind === 'value' && ts.isObjectLiteralExpression(base.node)) {
          const value = resolveReference(objectProperty(base, name), seen);
          if (value.kind === 'unknown' && !value.definitelyUndefined)
            return { kind: 'projection', base, property: name, frame: base.frame };
          if (value.kind === 'value' && (ts.isMethodDeclaration(value.node) || ts.isFunctionExpression(value.node))) {
            const frame: CallFrame = { id: `${base.frame.id}>object-this:${sourceOf(base.node)}:${base.node.getStart()}`,
              parent: base.frame, bindings: new Map(), instance: base };
            return { ...value, frame };
          }
          return value;
        }
        if (base.kind === 'value' && ts.isNewExpression(base.node))
          return resolveReference(instanceProperty(base, name), seen);
        if (base.kind === 'value' && ts.isCallExpression(base.node) && !primitiveAuthorityCall(base.node)
          && !canonical(base.node.expression, 'lib/guards.ts', 'requireAuth')
          && !canonical(base.node.expression, 'lib/core-v2/client.ts', 'requireCoreV2Client')
          && !canonical(base.node.expression, 'lib/core-v2/client.ts', 'requireCoreV2AdminAuthorizerClient')) {
          const target = callableReference(reference(base.node.expression, base.frame));
          const body = target?.callable.body;
          const isAsync = target && ts.getModifiers(target.callable)?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword);
          if (target && body && (!isAsync || base.awaited) && ts.isBlock(body)
            && body.statements.length === 1 && ts.isReturnStatement(body.statements[0])) {
            const returned = body.statements[0].expression;
            if (returned && ts.isObjectLiteralExpression(returned)) {
              if (structuralProjectionStack.has(target.callable)) {
                unresolved.add(`${sourceOf(base.node)}:${lineOf(base.node)}:recursive-object-producer`);
                return { kind: 'projection', base, property: name, frame: base.frame };
              }
              structuralProjectionStack.add(target.callable);
              try {
                const frame = bindInvocation(target, base.node.arguments.map(argument => reference(argument, base.frame)), base.node);
                return project(reference(returned, frame), name, seen);
              } finally { structuralProjectionStack.delete(target.callable); }
            }
          }
        }
        return { kind: 'projection', base, property: name, frame: base.frame };
      }
      function projection(input: Reference): { base: Reference; fields: string[] } {
        let base = resolveReference(input);
        const fields: string[] = [];
        while (base.kind === 'projection') { fields.unshift(base.property); base = resolveReference(base.base); }
        return { base, fields };
      }
      function callableReference(input: Reference): { callable: Callable; frame: CallFrame } | undefined {
        const value = resolveReference(input);
        if (value.kind !== 'value') return undefined;
        const callable = callableOf(value.node);
        return callable ? { callable, frame: value.frame } : undefined;
      }
      function bindPattern(pattern: ts.BindingName, value: Reference, frame: CallFrame): void {
        if (ts.isIdentifier(pattern)) {
          const symbol = symbolOf(pattern);
          if (symbol) frame.bindings.set(symbol, value);
          return;
        }
        for (const element of pattern.elements) {
          if (ts.isOmittedExpression(element)) continue;
          const field = ts.isObjectBindingPattern(pattern) ? propertyName(element.propertyName ?? element.name) : undefined;
          bindPattern(element.name, field !== undefined && !element.dotDotDotToken && !element.initializer
            ? project(value, field) : unknown(frame), frame);
        }
      }
      function bindInvocation(target: { callable: Callable; frame: CallFrame }, args: Reference[], site: ts.Node): CallFrame {
        const frame: CallFrame = { id: `${target.frame.id}>${sourceOf(site)}:${site.getStart()}:${target.callable.getStart()}`,
          owner: target.callable, parent: target.frame, bindings: new Map() };
        target.callable.parameters.forEach((parameter, index) => {
          let value = args[index] ?? unknown(frame, true);
          if (parameter.dotDotDotToken) value = unknown(frame);
          else if (parameter.initializer && knownUndefined(resolveReference(value))) {
            if (inertDefault(parameter.initializer)) value = reference(parameter.initializer, frame);
            else {
              const captures: Reference[] = [];
              const visit = (node: ts.Node): void => {
                if (ts.isIdentifier(node) || node.kind === ts.SyntaxKind.ThisKeyword)
                  captures.push(reference(node, frame));
                ts.forEachChild(node, visit);
              };
              visit(parameter.initializer);
              rejectAuthority([...new Set(captures.flatMap(capture => authorityKeys(capture)))],
                parameter, 'unsupported-default-parameter-effects');
              value = unknown(frame);
            }
          }
          bindPattern(parameter.name, value, frame);
        });
        return frame;
      }
      function classDeclaration(input: Reference): ts.ClassDeclaration | ts.ClassExpression | undefined {
        const value = resolveReference(input);
        return value.kind === 'value' && (ts.isClassDeclaration(value.node) || ts.isClassExpression(value.node))
          ? value.node : undefined;
      }
      function constructorTarget(input: Reference): { callable: ts.ConstructorDeclaration; frame: CallFrame } | undefined {
        const value = resolveReference(input);
        if (value.kind !== 'value' || !ts.isNewExpression(value.node)) return undefined;
        const declared = classDeclaration(reference(value.node.expression, value.frame));
        const constructor = declared?.members.find(ts.isConstructorDeclaration);
        return constructor ? { callable: constructor, frame: value.frame } : undefined;
      }
      function parameterProperty(parameter: ts.ParameterDeclaration): boolean {
        return !!ts.getModifiers(parameter)?.some(modifier => [
          ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.PrivateKeyword,
          ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.ReadonlyKeyword,
        ].includes(modifier.kind));
      }
      function instanceProperty(input: Reference, name: string): Reference {
        const value = resolveReference(input);
        if (value.kind !== 'value' || !ts.isNewExpression(value.node)) return unknown(input.frame);
        const declared = classDeclaration(reference(value.node.expression, value.frame));
        const constructor = constructorTarget(value);
        if (!declared || !constructor) return unknown(value.frame);
        const frame = bindInvocation(constructor, (value.node.arguments ?? []).map(argument => reference(argument, value.frame)), value.node);
        frame.instance = value;
        const parameter = constructor.callable.parameters.find(candidate =>
          parameterProperty(candidate) && ts.isIdentifier(candidate.name) && candidate.name.text === name);
        if (parameter && ts.isIdentifier(parameter.name))
          return boundValue(symbolOf(parameter.name), frame) ?? unknown(frame);
        const method = declared.members.find(member => ts.isMethodDeclaration(member) && propertyName(member.name) === name);
        return method && ts.isMethodDeclaration(method) ? reference(method, frame) : unknown(frame);
      }
      function globalObject(input: Reference): boolean {
        const value = resolveReference(input);
        if (value.kind !== 'value' || !ts.isIdentifier(value.node) || symbolOf(value.node)?.name !== 'Object') return false;
        const declared = declarationOf(value.node);
        return !!declared && resolve(declared.getSourceFile().fileName) === resolve(es5Library);
      }
      function globalFunction(input: Reference): boolean {
        const value = resolveReference(input);
        if (value.kind !== 'value' || !ts.isIdentifier(value.node) || symbolOf(value.node)?.name !== 'Function') return false;
        const declared = declarationOf(value.node);
        return !!declared && resolve(declared.getSourceFile().fileName) === resolve(es5Library);
      }
      function originalFreeze(node: ts.CallExpression): boolean {
        if (dirtyAuthorities.has('@platform:Object') || !ts.isPropertyAccessExpression(node.expression)
          || node.expression.name.text !== 'freeze' || !globalObject(reference(node.expression.expression))) return false;
        const declared = declarationOf(node.expression);
        return !!declared && resolve(declared.getSourceFile().fileName) === resolve(es5Library);
      }
      function authenticationOrigin(input: Reference): string | undefined {
        const value = resolveReference(input);
        return value.kind === 'value' && value.awaited && ts.isCallExpression(value.node)
          && canonical(value.node.expression, 'lib/guards.ts', 'requireAuth') ? referenceKey(value) : undefined;
      }
      function privateOrigin(input: Reference, depth = 0): PrivateOrigin | undefined {
        if (depth > 64) return undefined;
        const value = resolveReference(input);
        if (value.kind !== 'value' || !ts.isCallExpression(value.node)) return undefined;
        const call = value.node;
        if (value.awaited && canonical(call.expression, 'lib/auth/private-v1-session.ts', 'readBoundPrivateV1Session')
          && call.arguments.length === 2) {
          const request = resolveReference(reference(call.arguments[0], value.frame));
          const authentication = authenticationOrigin(reference(call.arguments[1], value.frame));
          if (request.kind === 'request' && authentication)
            return { capture: referenceKey(value), authentication, request: request.key };
        }
        if (originalFreeze(call) && call.arguments.length === 1 && ts.isObjectLiteralExpression(call.arguments[0])
          && call.arguments[0].properties.length === 1 && ts.isSpreadAssignment(call.arguments[0].properties[0]))
          return privateOrigin(reference(call.arguments[0].properties[0].expression, value.frame), depth + 1);
        return undefined;
      }
      function originClean(origin: PrivateOrigin): boolean {
        return ![origin.capture, origin.authentication, origin.request].some(key => dirtyAuthorities.has(key));
      }
      function hasCookie(path: ObservedGate[], origin: PrivateOrigin): boolean {
        return originClean(origin) && path.some(gate => gate.kind === 'BOUNDARY_AUTH' && gate.value === origin.authentication)
          && path.some(gate => gate.kind === 'BOUNDARY_PRIVATE_V1' && gate.value === origin.capture);
      }
      function hasLiveLease(path: ObservedGate[], origin: PrivateOrigin): boolean {
        const events = path.filter(gate => gate.value === origin.capture
          && (gate.kind === 'BOUNDARY_V1_LEASE' || gate.kind === 'BOUNDARY_V1_RELEASE'));
        return hasCookie(path, origin) && events.at(-1)?.kind === 'BOUNDARY_V1_LEASE';
      }
      function databaseKey(input: Reference): string | undefined {
        const value = resolveReference(input);
        if (value.kind === 'transaction') return value.key;
        if (value.kind !== 'value' || !value.awaited || !ts.isCallExpression(value.node)) return undefined;
        return canonical(value.node.expression, 'lib/core-v2/client.ts', 'requireCoreV2Client')
          || canonical(value.node.expression, 'lib/core-v2/client.ts', 'requireCoreV2AdminAuthorizerClient')
          ? `@db-client:${referenceKey(value)}` : undefined;
      }
      function isPrismaReceiver(node: ts.Expression): boolean {
        const value = resolveReference(reference(node));
        const key = databaseKey(value);
        return value.kind !== 'transaction' && key !== undefined && !dirtyAuthorities.has(key);
      }
      function truthOf(node: ts.Expression): boolean | undefined {
        while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node))
          node = node.expression;
        if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
        if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InKeyword
          && ts.isStringLiteralLike(node.left) && node.left.text === '$transaction') {
          const value = resolveReference(reference(node.right));
          const key = databaseKey(value);
          if (key && !dirtyAuthorities.has(key)) return value.kind !== 'transaction';
        }
        return undefined;
      }
      function mutableWrites(variable: ts.VariableDeclaration, frame: CallFrame): Reference[] {
        if (!ts.isIdentifier(variable.name)) return [];
        const symbol = symbolOf(variable.name);
        const values: Reference[] = [];
        if (variable.initializer && !(ts.isIdentifier(variable.initializer) && variable.initializer.text === 'undefined'))
          values.push(reference(variable.initializer, declarationFrame(variable, frame)));
        const owner = containingCallable(variable);
        const body = owner?.body ?? variable.getSourceFile();
        const visit = (node: ts.Node): void => {
          if (ts.isBinaryExpression(node) && ts.isIdentifier(node.left) && symbolOf(node.left) === symbol
            && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
            values.push(node.operatorToken.kind === ts.SyntaxKind.EqualsToken
              ? reference(node.right, declarationFrame(node, frame)) : unknown(frame));
          if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
            && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
            && ts.isIdentifier(node.operand) && symbolOf(node.operand) === symbol) values.push(unknown(frame));
          ts.forEachChild(node, visit);
        };
        visit(body);
        return values;
      }
      function leaseOrigin(input: Reference, depth = 0): PrivateOrigin | undefined {
        if (depth > 64) return undefined;
        const value = resolveReference(input);
        if (value.kind !== 'value') return undefined;
        if (ts.isIdentifier(value.node)) {
          const declared = declarationOf(value.node);
          if (declared && ts.isVariableDeclaration(declared) && !constantDeclaration(declared)) {
            const writes = mutableWrites(declared, value.frame);
            return writes.length === 1 ? leaseOrigin(writes[0], depth + 1) : undefined;
          }
        }
        return value.awaited && ts.isCallExpression(value.node) && value.node.arguments.length === 1
          && canonical(value.node.expression, 'lib/auth/v1-session-authority.ts', 'acquireV1SessionAuthority')
          ? privateOrigin(reference(value.node.arguments[0], value.frame)) : undefined;
      }
      function retainedLease(node: ts.CallExpression): boolean {
        let value: ts.Node = node;
        while (value.parent && (ts.isAwaitExpression(value.parent) || ts.isParenthesizedExpression(value.parent)
          || ts.isAsExpression(value.parent) || ts.isNonNullExpression(value.parent) || ts.isSatisfiesExpression(value.parent)))
          value = value.parent;
        const parent = value.parent;
        let variable: ts.VariableDeclaration | undefined;
        if (parent && ts.isVariableDeclaration(parent) && parent.initializer === value && ts.isIdentifier(parent.name))
          variable = parent;
        else if (parent && ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && parent.right === value && ts.isIdentifier(parent.left)) {
          const declared = declarationOf(parent.left);
          if (declared && ts.isVariableDeclaration(declared) && ts.isIdentifier(declared.name)) variable = declared;
        }
        if (!variable || !containingCallable(variable)) return false;
        if (constantDeclaration(variable)) return variable.initializer === value;
        const writes = mutableWrites(variable, currentFrame);
        const resolved = writes.length === 1 ? resolveReference(writes[0]) : undefined;
        return resolved?.kind === 'value' && resolved.awaited && resolved.node === node;
      }
      function sameValue(left: Reference, right: Reference): boolean {
        const a = resolveReference(left), b = resolveReference(right);
        return a.kind === 'value' && b.kind === 'value' && a.node === b.node && a.frame.id === b.frame.id;
      }
      function actorKeys(input: Reference): string[] {
        const value = resolveReference(input);
        if (value.kind !== 'value' || !value.awaited || !ts.isCallExpression(value.node)
          || !canonical(value.node.expression, 'lib/core-v2/http/actor.ts', 'resolveActor')) return [];
        const keys = [`@actor:${referenceKey(value)}`];
        if (value.node.arguments[1]) {
          const identity = projection(reference(value.node.arguments[1], value.frame));
          const auth = authenticationOrigin(identity.base);
          const origin = privateOrigin(identity.base);
          if (auth) keys.push(auth);
          if (origin) keys.push(origin.capture, origin.authentication, origin.request);
        }
        return keys;
      }
      function scalarProjection(input: Reference): boolean {
        const value = projection(input);
        const field = value.fields.join('.');
        if (authenticationOrigin(value.base)) return ['user.id', 'user.role', 'user.authority', 'expires'].includes(field);
        if (privateOrigin(value.base)) return ['userId', 'role', 'sessionVersion', 'expiresAt'].includes(field);
        if (actorKeys(value.base).length) return ['userId', 'role'].includes(field);
        return value.base.kind === 'request' && ['method', 'url'].includes(field);
      }
      function authorityKeys(input: Reference, objectOnly = true, seen = new Set<string>(),
        walk = { memo: new Map<string, string[]>(), cycles: 0 }): string[] {
        const value = resolveReference(input);
        if (value.kind === 'request' || value.kind === 'transaction') return [value.key];
        if (value.kind === 'projection') {
          const projected = projection(value);
          if (projected.base.kind === 'value' && ts.isConditionalExpression(projected.base.node)) {
            const conditional = projected.base, conditionalNode = projected.base.node;
            return [...new Set([conditionalNode.whenTrue, conditionalNode.whenFalse].flatMap(branch => {
              let alternative = reference(branch, conditional.frame);
              for (const field of projected.fields) alternative = project(alternative, field);
              return authorityKeys(alternative, objectOnly, seen, walk);
            }))];
          }
          return objectOnly && scalarProjection(value) ? [] : authorityKeys(value.base, false, seen, walk);
        }
        if (value.kind !== 'value') return [];
        const key = `${referenceKey(value)}:${objectOnly}`;
        if (seen.has(key)) { walk.cycles++; return []; }
        const epoch = dirtyAuthorities.size;
        const memoKey = `${key}:${epoch}`;
        const cached = walk.memo.get(memoKey);
        if (cached) return cached;
        const cycleCount = walk.cycles;
        seen.add(key);
        try {
          const own: string[] = [];
          if (staffOptions && sameValue(value, staffOptions)) own.push(dispatchKey);
          if (globalObject(value)) own.push('@platform:Object');
          if (globalFunction(value)) own.push('@platform:Function');
          const auth = authenticationOrigin(value);
          const origin = privateOrigin(value) ?? leaseOrigin(value);
          const database = databaseKey(value);
          if (auth) own.push(auth);
          if (origin) own.push(origin.capture, origin.authentication, origin.request);
          if (database) own.push(database);
          own.push(...actorKeys(value));
          const children: Reference[] = [];
          const node = value.node;
          if (ts.isIdentifier(node)) {
            const declared = declarationOf(node);
            if (declared && ts.isVariableDeclaration(declared) && !constantDeclaration(declared))
              children.push(...mutableWrites(declared, value.frame));
            if (declared && ts.isBindingElement(declared) && !declared.dotDotDotToken && !declared.initializer
              && ts.isObjectBindingPattern(declared.parent) && ts.isVariableDeclaration(declared.parent.parent)) {
              const variable = declared.parent.parent;
              const field = propertyName(declared.propertyName ?? declared.name);
              if (variable.initializer && field !== undefined)
                children.push(project(reference(variable.initializer, declarationFrame(variable, value.frame)), field));
            }
          } else if (ts.isObjectLiteralExpression(node)) {
            for (const property of node.properties) {
              if (ts.isSpreadAssignment(property)) children.push(reference(property.expression, value.frame));
              else if (ts.isPropertyAssignment(property)) children.push(reference(property.initializer, value.frame));
              else if (ts.isShorthandPropertyAssignment(property)) children.push(reference(property.name, value.frame));
              else if (ts.isMethodDeclaration(property) || ts.isGetAccessorDeclaration(property)
                || ts.isSetAccessorDeclaration(property)) children.push(reference(property, value.frame));
            }
          } else if (ts.isArrayLiteralExpression(node)) {
            for (const element of node.elements) if (!ts.isOmittedExpression(element))
              children.push(reference(ts.isSpreadElement(element) ? element.expression : element, value.frame));
          } else if (ts.isConditionalExpression(node)) {
            children.push(reference(node.whenTrue, value.frame), reference(node.whenFalse, value.frame));
          } else if (ts.isCallExpression(node)
            && canonical(node.expression, 'lib/core-v2/services/context.ts', 'createServiceContext')) {
            children.push(...node.arguments.map(argument => reference(argument, value.frame)));
          } else if (ts.isNewExpression(node)) {
            children.push(...(node.arguments ?? []).map(argument => reference(argument, value.frame)));
          } else if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)
            || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) && node.body) {
            const local = (declaration: ts.Node): boolean => {
              for (let parent: ts.Node | undefined = declaration; parent; parent = parent.parent)
                if (parent === node) return true;
              return false;
            };
            const captures = (child: ts.Node): void => {
              if (ts.isTypeNode(child)) return;
              if (ts.isIdentifier(child)) {
                const parent = child.parent;
                const propertyLabel = ts.isPropertyAccessExpression(parent) && parent.name === child
                  || ts.isPropertyAssignment(parent) && parent.name === child
                  || ts.isMethodDeclaration(parent) && parent.name === child
                  || ts.isPropertyDeclaration(parent) && parent.name === child
                  || ts.isGetAccessorDeclaration(parent) && parent.name === child
                  || ts.isSetAccessorDeclaration(parent) && parent.name === child;
                const declared = declarationOf(child);
                if (!propertyLabel && (!declared || !local(declared))) children.push(reference(child, value.frame));
              } else if (child.kind === ts.SyntaxKind.ThisKeyword) {
                let owner = containingCallable(child);
                while (owner && owner !== node && ts.isArrowFunction(owner)) owner = containingCallable(owner);
                if (owner === node) children.push(reference(child, value.frame));
              }
              ts.forEachChild(child, captures);
            };
            captures(node.body);
          }
          const keys = [...new Set([...own, ...children.flatMap(child => authorityKeys(child, objectOnly, seen, walk))])];
          // A cycle yields a deliberately incomplete traversal. Never cache
          // that result or reuse a walk after another authority operation.
          if (walk.cycles === cycleCount && epoch === dirtyAuthorities.size) walk.memo.set(memoKey, keys);
          return keys;
        } finally { seen.delete(key); }
      }
      function identityKeys(input: Reference): string[] {
        return authorityKeys(input).filter(key => !key.startsWith('@db-')
          && !key.startsWith('@dispatch:') && !key.startsWith('@platform:'));
      }
      function rejectAuthority(keys: string[], node: ts.Node, reason: string): void {
        if (!keys.length) return;
        keys.forEach(key => dirtyAuthorities.add(key));
        unresolved.add(`${sourceOf(node)}:${lineOf(node)}:${reason}`);
      }
      function mutationTarget(node: ts.Expression): Reference {
        return reference(ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) ? node.expression : node);
      }
      function localMutableIdentifier(node: ts.Expression): boolean {
        const declared = ts.isIdentifier(node) ? declarationOf(node) : undefined;
        return !!declared && ts.isVariableDeclaration(declared) && !constantDeclaration(declared)
          && containingCallable(declared) !== undefined;
      }
      function primitiveAuthorityCall(node: ts.CallExpression): boolean {
        return canonical(node.expression, 'lib/auth/private-v1-session.ts', 'readBoundPrivateV1Session')
          || canonical(node.expression, 'lib/auth/v1-session-authority.ts', 'acquireV1SessionAuthority')
          || canonical(node.expression, 'lib/core-v2/http/actor.ts', 'resolveActor');
      }
      function safePlatformInvocation(expression: ts.Expression): boolean {
        if (!ts.isPropertyAccessExpression(expression)) return false;
        const method = expression.name.text;
        const receiver = reference(expression.expression);
        if (globalObject(receiver) && !dirtyAuthorities.has('@platform:Object')) return [
          'keys', 'values', 'entries', 'fromEntries', 'getOwnPropertyNames', 'getOwnPropertySymbols', 'getOwnPropertyDescriptor',
          'getOwnPropertyDescriptors', 'getPrototypeOf', 'is', 'isFrozen', 'isSealed', 'isExtensible',
        ].includes(method);
        const value = projection(receiver);
        if (method === 'call' && value.fields.join('.') === 'prototype.hasOwnProperty'
          && globalObject(value.base) && !dirtyAuthorities.has('@platform:Object')
          && !dirtyAuthorities.has('@platform:Function')) return true;
        if (value.base.kind === 'request' && !dirtyAuthorities.has(value.base.key)) {
          const field = value.fields.join('.');
          if (field === 'body') return method === 'getReader';
          if (field === 'headers') return ['get', 'has', 'entries', 'keys', 'values'].includes(method);
          if (field === 'nextUrl.searchParams') return ['get', 'getAll', 'has', 'entries', 'keys', 'values', 'toString'].includes(method);
          if (!field) return ['text', 'json', 'arrayBuffer', 'blob', 'formData', 'clone'].includes(method);
        }
        const database = databaseKey(value.base);
        if (database && !dirtyAuthorities.has(database)) {
          if (!value.fields.length) return [
            '$transaction', '$connect', '$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe',
          ].includes(method);
          if (value.fields.length === 1) return [
            'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'create', 'createMany',
            'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany',
            'count', 'aggregate', 'groupBy',
          ].includes(method);
        }
        return leaseOrigin(receiver) !== undefined && ['verify', 'release'].includes(method);
      }
      function platformRead(node: ts.CallExpression): boolean {
        return originalFreeze(node) || safePlatformInvocation(node.expression);
      }
      function inspectReadonly(target: { callable: Callable; frame: CallFrame }, args: Reference[], site: ts.Node): void {
        const captured = authorityKeys(reference(target.callable, target.frame));
        const instance = target.frame.instance ? authorityKeys(target.frame.instance) : [];
        const keys = [...new Set([...args.flatMap(argument => authorityKeys(argument)),
          ...captured.filter(key => !key.startsWith('@platform:')),
          ...instance.filter(key => !key.startsWith('@platform:'))])];
        if (!keys.length) return;
        if (!target.callable.body) { rejectAuthority(keys, site, 'opaque-authority-escape'); return; }
        if (readonlyStack.has(target.callable)) { rejectAuthority(keys, site, 'cyclic-authority-escape'); return; }
        const previous = currentFrame;
        currentFrame = bindInvocation(target, args, site);
        if (ts.isNewExpression(site)) currentFrame.instance = reference(site, previous);
        readonlyStack.add(target.callable);
        try {
          target.callable.parameters.forEach((parameter, index) => {
            if (parameterProperty(parameter) && args[index])
              rejectAuthority(identityKeys(args[index]), site, 'authority-stored-on-instance');
          });
          const visit = (node: ts.Node): void => {
            if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)
              || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return;
            if(ts.isCallExpression(node)&&absentOptionalCall(node))return;
            if (ts.isIfStatement(node)) {
              const truth = truthOf(node.expression);
              if (truth !== undefined) {
                visit(node.expression);
                if (truth) visit(node.thenStatement); else if (node.elseStatement) visit(node.elseStatement);
                return;
              }
            }
            if (ts.isConditionalExpression(node)) {
              const truth = truthOf(node.condition);
              if (truth !== undefined) { visit(node.condition); visit(truth ? node.whenTrue : node.whenFalse); return; }
            }
            inspectAuthorityOperation(node);
            ts.forEachChild(node, visit);
          };
          visit(target.callable.body);
        } finally { readonlyStack.delete(target.callable); currentFrame = previous; }
      }
      function inspectAuthorityOperation(node: ts.Node): void {
        if(ts.isCallExpression(node)&&absentOptionalCall(node))return;
        if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
          && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
          if (!localMutableIdentifier(node.left))
            rejectAuthority(authorityKeys(mutationTarget(node.left), false), node, 'authority-write');
          if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const declared = ts.isIdentifier(node.left) ? declarationOf(node.left) : undefined;
            const local = declared && (ts.isVariableDeclaration(declared) || ts.isParameter(declared))
              && containingCallable(declared) !== undefined;
            if (!local) rejectAuthority(identityKeys(reference(node.right)), node, 'authority-stored-outside-local-binding');
          }
          return;
        }
        if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
          && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)) {
          rejectAuthority(authorityKeys(mutationTarget(node.operand), false), node, 'authority-write'); return;
        }
        if (ts.isDeleteExpression(node)) {
          rejectAuthority(authorityKeys(mutationTarget(node.expression), false), node, 'authority-write'); return;
        }
        if (ts.isTaggedTemplateExpression(node)) {
          const args = ts.isTemplateExpression(node.template)
            ? node.template.templateSpans.map(span => reference(span.expression)) : [];
          if (safePlatformInvocation(node.tag)) {
            rejectAuthority(args.flatMap(argument => identityKeys(argument)), node, 'identity-object-in-database-call');
            return;
          }
          const target = callableReference(reference(node.tag));
          if (target) { inspectReadonly(target, [unknown(), ...args], node); return; }
          const receiver = ts.isPropertyAccessExpression(node.tag) ? authorityKeys(reference(node.tag.expression)) : [];
          rejectAuthority([...receiver, ...args.flatMap(argument => authorityKeys(argument))], node, 'opaque-authority-escape');
          return;
        }
        if (!ts.isCallExpression(node) && !ts.isNewExpression(node)) return;
        const args = (node.arguments ?? []).map(argument => reference(argument));
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const receiver = reference(node.expression.expression);
          const method = node.expression.name.text;
          const trustedDatabaseInvocation = safePlatformInvocation(node.expression)
            && databaseKey(projection(receiver).base) !== undefined;
          if (globalObject(receiver) && ['assign', 'defineProperty', 'defineProperties', 'setPrototypeOf'].includes(method)) {
            if (args[0]) rejectAuthority(authorityKeys(args[0], false), node, 'authority-write');
            return;
          }
          if (!trustedDatabaseInvocation && ['set', 'append', 'delete', 'clear', 'sort', '$disconnect'].includes(method))
            rejectAuthority(authorityKeys(receiver, false), node, 'authority-write');
          if (trustedDatabaseInvocation && method !== '$transaction')
            rejectAuthority(args.flatMap(argument => identityKeys(argument)), node, 'identity-object-in-database-call');
        }
        if (ts.isCallExpression(node) && (primitiveAuthorityCall(node) || platformRead(node))) return;
        const target = ts.isNewExpression(node)
          ? constructorTarget(reference(node)) : callableReference(reference(node.expression));
        if (target) { inspectReadonly(target, args, node); return; }
        const receiver = ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
          ? authorityKeys(reference(node.expression.expression)) : [];
        rejectAuthority([...receiver, ...args.flatMap(argument => authorityKeys(argument))], node, 'opaque-authority-escape');
      }
      function applyExpression(node: ts.Node, states: States): States {
        if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return states;
        if(ts.isCallExpression(node)&&absentOptionalCall(node))return states;
        inspectAuthorityOperation(node);
        if (ts.isConditionalExpression(node)) {
          const input = applyExpression(node.condition, states);
          const truth = truthOf(node.condition);
          if (truth !== undefined) return applyExpression(truth ? node.whenTrue : node.whenFalse, input);
          return uniquePaths([...applyExpression(node.whenTrue, input), ...applyExpression(node.whenFalse, input)]);
        }
        if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.QuestionQuestionToken,
          ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken].includes(node.operatorToken.kind)) {
          const left = applyExpression(node.left, states);
          const truth = truthOf(node.left);
          if ([ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken].includes(node.operatorToken.kind)
            && truth !== undefined) return truth ? applyExpression(node.right, left) : left;
          if ([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.BarBarEqualsToken].includes(node.operatorToken.kind)
            && truth !== undefined) return truth ? left : applyExpression(node.right, left);
          return uniquePaths([...left, ...applyExpression(node.right, left)]);
        }
        if (!ts.isCallExpression(node)) { let result = states; ts.forEachChild(node, child => { result = applyExpression(child, result); }); return result; }
        let result = states;
        for (const argument of node.arguments) result = applyExpression(argument, result);
        const callDeclaration = declarationOf(node.expression);
        const name = symbolOf(node.expression)?.name ?? node.expression.getText();
        if (callDeclaration) calls.push({ name, source: sourceOf(callDeclaration), line: lineOf(callDeclaration),
          declaration: locationOf(callDeclaration), callSite: locationOf(node) });
        const rbac = 'lib/core-v2/rbac.ts';
        let gate: ObservedGate | undefined;
        if (canonical(node.expression, rbac, 'assertCapability') || canonical(node.expression, rbac, 'assertSelfServiceRole')) {
          const value = node.arguments[1];
          if (!value || !ts.isStringLiteralLike(value)) unresolved.add(`${sourceOf(node)}:${lineOf(node)}:dynamic-guard`);
          else if (node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])
            && node.arguments[0].properties.some(property=>ts.isPropertyAssignment(property) && property.name.getText()==='role'
              && ts.isStringLiteralLike(property.initializer))) unresolved.add(`${sourceOf(node)}:${lineOf(node)}:literal-forged-actor`);
          else gate = gateAt(name === 'assertCapability' ? 'CAPABILITY' : 'ROLE_SELF_SERVICE', value.text, node, callDeclaration!);
        } else if (canonical(node.expression, rbac, 'assertStaffRole')) gate = gateAt('ROLE_STAFF', 'STAFF', node, callDeclaration!);
        else if (canonical(node.expression, 'lib/core-v2/accounts/v1-authority.ts', 'assertCoreMayHoldCredentials'))
          gate = gateAt('CREDENTIAL_AUTHORITY_IS_V1', 'V1_ONLY', node, callDeclaration!);
        else if (canonical(node.expression, 'lib/auth/private-v1-session.ts', 'readBoundPrivateV1Session')) {
          const origin = privateOrigin({ kind: 'value', node, frame: currentFrame, awaited: directlyAwaited(node) });
          if (!origin || !originClean(origin)) {
            unresolved.add(`${sourceOf(node)}:${lineOf(node)}:private-session-not-bound-to-original-request`); return result;
          }
          return result.map(path => {
            if (!path.some(value => value.kind === 'BOUNDARY_AUTH' && value.value === origin.authentication)) {
              unresolved.add(`${sourceOf(node)}:${lineOf(node)}:private-session-before-accepted-authentication`); return path;
            }
            return [...path, gateAt('BOUNDARY_PRIVATE_V1', origin.capture, node, callDeclaration!)];
          });
        }
        else if (canonical(node.expression, 'lib/auth/v1-session-authority.ts', 'acquireV1SessionAuthority')) {
          const origin = node.arguments.length === 1 ? privateOrigin(reference(node.arguments[0])) : undefined;
          if (!directlyAwaited(node) || !retainedLease(node) || !origin || !originClean(origin)) {
            unresolved.add(`${sourceOf(node)}:${lineOf(node)}:v1-lease-not-awaited-retained-and-cookie-bound`); return result;
          }
          return result.map(path => {
            if (!hasCookie(path, origin)) {
              unresolved.add(`${sourceOf(node)}:${lineOf(node)}:v1-lease-before-bound-private-session`); return path;
            }
            return [...path, gateAt('BOUNDARY_V1_LEASE', origin.capture, node, callDeclaration!)];
          });
        }
        else if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'release') {
          const releaseReceiver = node.expression.expression;
          const origin = leaseOrigin(reference(releaseReceiver));
          if (origin) {
            const optional = node.questionDotToken !== undefined || node.expression.questionDotToken !== undefined;
            return result.map(path => {
              if (!hasLiveLease(path, origin)) {
                if (!optional) unresolved.add(`${sourceOf(node)}:${lineOf(node)}:release-without-live-bound-v1-lease`);
                return path;
              }
              // release unlocks synchronously before its first await.
              return [...path, gateAt('BOUNDARY_V1_RELEASE', origin.capture, node,
                declarationOf(releaseReceiver) ?? node)];
            });
          }
        }
        else if (canonical(node.expression, 'lib/core-v2/queries/self-membership.ts', 'readOwnCoreMembership')) {
          const identity = node.arguments[0] ? projection(reference(node.arguments[0])) : undefined;
          const authentication = identity?.fields.join('.') === 'user.id' ? authenticationOrigin(identity.base) : undefined;
          if (id !== 'GET /api/v2/self/membership') unresolved.add('self-metadata-exception-outside-canonical-route');
          else if (!propagated(node)) unresolved.add('unawaited-self-metadata');
          else if (node.arguments.length === 1 && authentication && !dirtyAuthorities.has(authentication))
            gate = gateAt('BOUNDARY_SELF_METADATA', authentication, node, callDeclaration!);
          else unresolved.add('self-metadata-not-derived-from-session');
        }
        else if (canonical(node.expression, 'lib/core-v2/http/actor.ts', 'resolveActor')) {
          const identity = node.arguments[1] ? projection(reference(node.arguments[1])) : undefined;
          if(!propagated(node)){unresolved.add(`${sourceOf(node)}:${lineOf(node)}:unawaited-core-actor`);return result;}
          const authentication = identity?.fields.join('.') === 'user.id' ? authenticationOrigin(identity.base) : undefined;
          if (authentication && !dirtyAuthorities.has(authentication))
            gate = gateAt('BOUNDARY_CORE', authentication, node, callDeclaration!);
          else {
            const origin = identity?.fields.join('.') === 'userId' ? privateOrigin(identity.base) : undefined;
            const database = node.arguments[0] ? resolveReference(reference(node.arguments[0])) : undefined;
            if (!directlyAwaited(node) || !origin || !originClean(origin) || database?.kind !== 'transaction'
              || dirtyAuthorities.has(database.key)) {
              unresolved.add(`${sourceOf(node)}:${lineOf(node)}:actor-not-derived-from-session-or-live-private-authority`);
              return result;
            }
            return result.map(path => {
              if (!hasLiveLease(path, origin)) {
                unresolved.add(`${sourceOf(node)}:${lineOf(node)}:fresh-core-actor-without-live-v1-lease`); return path;
              }
              return [...path, gateAt('BOUNDARY_CORE', origin.authentication, node, callDeclaration!),
                gateAt('BOUNDARY_FRESH_CORE', origin.capture, node, callDeclaration!)];
            });
          }
        }
        if (gate) return result.map(path => [...path, gate!]);
        if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text==='handler'
          && ts.isIdentifier(node.expression.expression) && sourceOf(node)==='lib/core-v2/http/staff-route.ts') {
          const receiver=declarationOf(node.expression.expression);
          if(!receiver || !staffFactory || receiver !== staffFactory.parameters[0]) {
            unresolved.add('staff-wrapper-unbound-handler'); return result;
          }
          if(!propagated(node)) { unresolved.add('unawaited-staff-handler'); return result; }
          const handler = callableReference(reference(node.expression));
          if (!handler?.callable.body || node.arguments.length !== 1 || dirtyAuthorities.has(dispatchKey)) {
            unresolved.add('staff-wrapper-unbound-handler'); return result;
          }
          const argument = reference(node.arguments[0]);
          const context = resolveReference(objectProperty(argument, 'ctx'));
          const contextCall = context.kind === 'value' && ts.isCallExpression(context.node)
            && canonical(context.node.expression, 'lib/core-v2/services/context.ts', 'createServiceContext')
            ? context.node : undefined;
          const actor = contextCall?.arguments[0] && context.kind === 'value'
            ? resolveReference(reference(contextCall.arguments[0], context.frame)) : undefined;
          const actorCall = actor?.kind === 'value' && actor.awaited && ts.isCallExpression(actor.node)
            && canonical(actor.node.expression, 'lib/core-v2/http/actor.ts', 'resolveActor') ? actor.node : undefined;
          const identity = actorCall?.arguments[1] && actor?.kind === 'value'
            ? projection(reference(actorCall.arguments[1], actor.frame)) : undefined;
          const authentication = identity?.fields.join('.') === 'user.id' ? authenticationOrigin(identity.base) : undefined;
          if (!actorCall || !authentication || dirtyAuthorities.has(authentication)
            || result.some(path => !path.some(value => value.kind === 'BOUNDARY_CORE' && value.value === authentication
              && value.callSite.file === sourceOf(actorCall) && value.callSite.start === actorCall.getStart()))) {
            unresolved.add('staff-wrapper-context-not-derived-from-actor'); return result;
          }
          result=result.map(path=>[...path,gateAt('BOUNDARY_HANDLER','options.handler',node,receiver)]);
          boundaryPaths.push(...result);
          return analyzeDeclaration(handler.callable, handler.callable.body, result, bindInvocation(handler, [argument], node));
        }
        // Only a client derived from the canonical client factory grants a TX.
        // Other delegates are followed through their bodies and actual arguments.
        const transaction = ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === '$transaction'
          && isPrismaReceiver(node.expression.expression);
        if (transaction) {
          if(!propagated(node)){unresolved.add(`${sourceOf(node)}:${lineOf(node)}:unawaited-authority-transaction`);return result;}
          if (node.arguments[0] && ts.isArrayLiteralExpression(node.arguments[0])) return result;
          const callback = node.arguments[0] ? callableReference(reference(node.arguments[0])) : undefined;
          if (!callback?.callable.body) {
            unresolved.add(`${sourceOf(node)}:${lineOf(node)}:unresolved-transaction-callback`); return result;
          }
          const tx: Reference = { kind: 'transaction',
            key: `@db-tx:${currentFrame.id}:${sourceOf(node)}:${node.getStart()}`, frame: currentFrame };
          return analyzeDeclaration(callback.callable, callback.callable.body, result, bindInvocation(callback, [tx], node));
        }
        if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text==='$transaction')
          unresolved.add(`${sourceOf(node)}:${lineOf(node)}:untrusted-transaction-receiver`);
        const target = callableReference(reference(node.expression));
        if (target && (sourceOf(target.callable).startsWith('lib/core-v2/') || sourceOf(target.callable).startsWith('app/api/v2/'))) {
          const body = target.callable.body;
          if (body) {
            const previous = new Set(result.flat());
            const observed = analyzeDeclaration(target.callable, body, result,
              bindInvocation(target, node.arguments.map(argument => reference(argument)), node));
            const added = observed.flat().filter(value => !previous.has(value));
            const isAsync = ts.getModifiers(target.callable)?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword);
            const asynchronousAuthority = added.some(value => [
              'BOUNDARY_PRIVATE_V1', 'BOUNDARY_V1_LEASE', 'BOUNDARY_FRESH_CORE',
            ].includes(value.kind));
            if ((isAsync || asynchronousAuthority) && !propagated(node)) {
              if(added.length)
                unresolved.add(`${sourceOf(node)}:${lineOf(node)}:unawaited-authority-delegate`);
              return result;
            }
            return observed;
          }
        }
        if (callDeclaration && ts.isVariableDeclaration(callDeclaration) && callDeclaration.initializer
          && ts.isConditionalExpression(callDeclaration.initializer)) unresolved.add(`${sourceOf(node)}:${lineOf(node)}:dynamic-delegate`);
        return result;
      }
      function analyzeDeclaration(node: ts.Node, body: ts.ConciseBody, input: States, frame: CallFrame): States {
        if (stack.has(node)) {
          // A recursive void validator supplies NO additional authority.
          // Returning delegates remain unresolved; they could conceal a route.
          if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node))
            && node.type?.kind===ts.SyntaxKind.VoidKeyword) recursiveVoidCalls.add(`${sourceOf(node)}:${lineOf(node)}`);
          else unresolved.add(`${sourceOf(node)}:${lineOf(node)}:cycle`);
          return input;
        }
        stack.add(node);
        try { return analyzeBody(body, input, frame); }
        finally { stack.delete(node); }
      }
      function isRefusal(expression: ts.Expression): boolean {
        if (ts.isAwaitExpression(expression)) return isRefusal(expression.expression);
        if (ts.isCallExpression(expression)) {
          if (canonical(expression.expression, 'lib/core-v2/http/respond.ts', 'privateResponse') && expression.arguments.length === 1)
            return isRefusal(expression.arguments[0]);
          if (canonical(expression.expression, 'lib/core-v2/http/respond.ts', 'failFromError')) return true;
          if (canonical(expression.expression, 'lib/core-v2/http/respond.ts', 'fail'))
            return !!expression.arguments[1] && ts.isNumericLiteral(expression.arguments[1]) && Number(expression.arguments[1].text)>=400;
          if (ts.isPropertyAccessExpression(expression.expression) && importedFrom(expression.expression.expression, 'next/server', 'NextResponse')
            && expression.expression.name.text === 'json') {
            const options = expression.arguments[1];
            if (options && ts.isObjectLiteralExpression(options)) {
              const status = options.properties.find(property => property.name?.getText() === 'status');
              if (status && ts.isPropertyAssignment(status) && ts.isNumericLiteral(status.initializer)) return Number(status.initializer.text) >= 400;
            }
          }
        }
        if (ts.isIdentifier(expression)) {
          const declaration = declarationOf(expression);
          if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
            let initializer = declaration.initializer;
            if (ts.isAwaitExpression(initializer)) initializer = initializer.expression;
            if (ts.isCallExpression(initializer)) return canonical(initializer.expression, 'lib/csrf.ts', 'checkCsrf')
              || canonical(initializer.expression, 'lib/csrf.ts', 'checkBodySize')
              || canonical(initializer.expression, 'lib/rate-limit/sensitive.ts', 'guardSensitiveRateLimit')
              || canonical(initializer.expression, 'lib/core-v2/http/respond.ts', 'failFromError');
          }
        }
        return false;
      }
      function hasFailureStatus(condition:ts.Expression,returned:ts.Expression):boolean {
        if(ts.isParenthesizedExpression(condition))return hasFailureStatus(condition.expression,returned);
        if(ts.isBinaryExpression(condition)&&condition.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken)
          return hasFailureStatus(condition.left,returned)||hasFailureStatus(condition.right,returned);
        return ts.isBinaryExpression(condition)&&ts.isPropertyAccessExpression(condition.left)
          && condition.left.name.text==='status'&&condition.left.expression.getText()===returned.getText()
          && ts.isNumericLiteral(condition.right)&&Number(condition.right.text)>=400
          && [ts.SyntaxKind.GreaterThanEqualsToken,ts.SyntaxKind.GreaterThanToken].includes(condition.operatorToken.kind);
      }
      function returnIsGuardedFailure(node:ts.ReturnStatement):boolean {
        if(!node.expression)return false;
        let cursor:ts.Node=node;
        while(cursor.parent&&!ts.isFunctionDeclaration(cursor)&&!ts.isArrowFunction(cursor)&&!ts.isFunctionExpression(cursor)&&!ts.isMethodDeclaration(cursor)) {
          if(ts.isIfStatement(cursor.parent)&&cursor.parent.thenStatement===cursor&&hasFailureStatus(cursor.parent.expression,node.expression))return true;
          cursor=cursor.parent;
        }
        return false;
      }
      function statement(node: ts.Statement, states: States): Flow {
        if (ts.isBlock(node)) return sequence(node.statements, states);
        if (ts.isReturnStatement(node)) {
          const returned = node.expression ? applyExpression(node.expression, states) : states;
          return flow([], node.expression && (isRefusal(node.expression)||returnIsGuardedFailure(node)) ? [] : returned);
        }
        if (ts.isThrowStatement(node)) { applyExpression(node.expression, states); return flow(); }
        if (ts.isIfStatement(node)) {
          const input = applyExpression(node.expression, states);
          const truth = truthOf(node.expression);
          if (truth === true) return statement(node.thenStatement, input);
          if (truth === false) return node.elseStatement ? statement(node.elseStatement, input) : flow(input);
          const yes = statement(node.thenStatement, input);
          let noInput=input;
          if (ts.isCallExpression(node.expression) && canonical(node.expression.expression,'lib/guards.ts','isErrorResponse')
            && node.expression.arguments[0] && yes.active.length===0) {
            const authentication = authenticationOrigin(reference(node.expression.arguments[0]));
            if (authentication && !dirtyAuthorities.has(authentication)) {
              const auth=gateAt('BOUNDARY_AUTH',authentication,node.expression,declarationOf(node.expression.expression)!);
              noInput=input.map(path=>[...path,auth]);
            }
          }
          const no = node.elseStatement ? statement(node.elseStatement, noInput) : flow(noInput);
          return mergeFlows(yes,no);
        }
        if (ts.isTryStatement(node)) {
          const tried = statement(node.tryBlock, states);
          const combined=node.catchClause ? mergeFlows(tried,statement(node.catchClause.block,states)) : tried;
          if (!node.finallyBlock) return combined;
          const normal=statement(node.finallyBlock,combined.active);
          const returning=statement(node.finallyBlock,combined.returned);
          const breaking=statement(node.finallyBlock,combined.breaks);
          const continuing=statement(node.finallyBlock,combined.continues);
          // A control transfer in finally also replaces a thrown guard refusal.
          // Model that exceptional entry from BEFORE the try; ordinary cleanup
          // completion cannot turn the outstanding exception into success.
          const exceptional=statement(node.finallyBlock,states);
          return flow(normal.active,uniquePaths([...normal.returned,...returning.returned,...returning.active,...breaking.returned,...continuing.returned,...exceptional.returned]),
            uniquePaths([...normal.breaks,...returning.breaks,...breaking.breaks,...breaking.active,...continuing.breaks,...exceptional.breaks]),
            uniquePaths([...normal.continues,...returning.continues,...breaking.continues,...continuing.continues,...continuing.active,...exceptional.continues]));
        }
        if (ts.isFunctionDeclaration(node) || ts.isEmptyStatement(node)) return flow(states);
        if (ts.isVariableStatement(node)) { let active = states;
          for (const entry of node.declarationList.declarations) if (entry.initializer) active = applyExpression(entry.initializer, active);
          return flow(active); }
        if (ts.isExpressionStatement(node)) return flow(applyExpression(node.expression, states));
        if (ts.isBreakStatement(node) || ts.isContinueStatement(node)) {
          if(node.label)unresolved.add(`${sourceOf(node)}:${lineOf(node)}:labelled-control`);
          return ts.isBreakStatement(node) ? flow([],[],states) : flow([],[],[],states);
        }
        if (ts.isSwitchStatement(node)) {
          const input=applyExpression(node.expression,states); const branches:Flow[]=[];
          for(let start=0;start<node.caseBlock.clauses.length;start++) {
            let branch=flow(input);
            for(let index=start;index<node.caseBlock.clauses.length && branch.active.length;index++) {
              const next=sequence(node.caseBlock.clauses[index].statements,branch.active);
              branch=flow(next.active,uniquePaths([...branch.returned,...next.returned]),uniquePaths([...branch.breaks,...next.breaks]),uniquePaths([...branch.continues,...next.continues]));
            }
            branches.push(flow(uniquePaths([...branch.active,...branch.breaks]),branch.returned,[],branch.continues));
          }
          if(!node.caseBlock.clauses.some(ts.isDefaultClause))branches.push(flow(input));
          return mergeFlows(...branches);
        }
        if(ts.isForStatement(node)||ts.isForOfStatement(node)||ts.isForInStatement(node)||ts.isWhileStatement(node)||ts.isDoStatement(node)) {
          let input=states;
          if(ts.isForStatement(node)) {
            if(node.initializer) input=applyExpression(node.initializer,input);
            if(node.condition) input=applyExpression(node.condition,input);
          } else if(!ts.isDoStatement(node)) input=applyExpression(node.expression,input);
          const body=statement(node.statement,input);
          let continuing=uniquePaths([...body.active,...body.continues]);
          if(ts.isForStatement(node)&&node.incrementor)continuing=applyExpression(node.incrementor,continuing);
          if(ts.isDoStatement(node))continuing=applyExpression(node.expression,continuing);
          return flow(uniquePaths([...(ts.isDoStatement(node)?[]:input),...continuing,...body.breaks]),body.returned);
        }
        unresolved.add(`${sourceOf(node)}:${lineOf(node)}:unsupported-${ts.SyntaxKind[node.kind]}`);
        return flow(states);
      }
      function mergeFlows(...flows:Flow[]):Flow { return flow(uniquePaths(flows.flatMap(f=>f.active)),uniquePaths(flows.flatMap(f=>f.returned)),
        uniquePaths(flows.flatMap(f=>f.breaks)),uniquePaths(flows.flatMap(f=>f.continues))); }
      function sequence(statements: ts.NodeArray<ts.Statement>, states: States): Flow {
        let active = states; const returned: States = [], breaks:States=[], continues:States=[];
        for (const node of statements) { if (active.length === 0) break; const next = statement(node, active); active = next.active;
          returned.push(...next.returned);breaks.push(...next.breaks);continues.push(...next.continues); }
        return flow(uniquePaths(active),uniquePaths(returned),uniquePaths(breaks),uniquePaths(continues));
      }
      function analyzeBody(body: ts.ConciseBody, input: States, frame: CallFrame): States {
        const previous = currentFrame;
        currentFrame = frame;
        try {
          if (!ts.isBlock(body)) return applyExpression(body, input);
          const result = sequence(body.statements, input);
          if(result.breaks.length||result.continues.length)unresolved.add(`${sourceOf(body)}:${lineOf(body)}:unconsumed-control`);
          return uniquePaths([...result.returned, ...result.active]);
        } finally { currentFrame = previous; }
      }
      let wrapper: string | null = null; let body = bodyOf(declaration); let wrappedPaths: States | undefined;
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer && ts.isCallExpression(declaration.initializer)) {
        const initializer = declaration.initializer;
        if (canonical(initializer.expression, 'lib/core-v2/http/staff-route.ts', 'defineStaffRoute')) {
          wrapper = 'defineStaffRoute';
          staffOptions = initializer.arguments[0] ? reference(initializer.arguments[0], rootFrame) : unknown(rootFrame);
          const handler = callableReference(project(staffOptions, 'handler'));
          body = handler?.callable.body;
          const wrapperDeclaration = declarationOf(initializer.expression);
          if (wrapperDeclaration && ts.isFunctionDeclaration(wrapperDeclaration) && wrapperDeclaration.body
            && wrapperDeclaration.body.statements.length === 1 && ts.isReturnStatement(wrapperDeclaration.body.statements[0])) {
            staffFactory = wrapperDeclaration;
            const returned = wrapperDeclaration.body.statements[0].expression;
            if (returned && (ts.isArrowFunction(returned) || ts.isFunctionExpression(returned))) {
              const factoryFrame = bindInvocation({ callable: wrapperDeclaration, frame: rootFrame },
                initializer.arguments.map(argument => reference(argument, rootFrame)), initializer);
              const request: Reference = { kind: 'request', key: `${id}:original-request`, frame: rootFrame };
              const returnedFrame = bindInvocation({ callable: returned, frame: factoryFrame },
                [request, unknown(rootFrame)], initializer);
              wrappedPaths = analyzeDeclaration(returned, returned.body, [[]], returnedFrame);
            }
          }
          if (!wrappedPaths || !boundaryPaths.length || wrappedPaths.some(path => !path.some(gate => gate.kind === 'BOUNDARY_HANDLER'))
            || boundaryPaths.some(path => !path.some((gate, index) => gate.kind === 'BOUNDARY_AUTH'
              && path.slice(index + 1).some(next => next.kind === 'BOUNDARY_CORE' && next.value === gate.value))))
            unresolved.add('staff-wrapper-boundary-missing');
        }
      }
      if (!body) unresolved.add(`${relative(root, file)}:${method}:handler-unresolved`);
      if (!wrapper && rootFrame.owner?.parameters[0])
        bindPattern(rootFrame.owner.parameters[0].name,
          { kind: 'request', key: `${id}:original-request`, frame: rootFrame }, rootFrame);
      const paths: States = wrapper ? wrappedPaths ?? [[]] : body && declaration
        ? analyzeDeclaration(callableOf(declaration) ?? declaration, body, [[]], rootFrame) : [[]];
      const guards = [...new Map(paths.flat().map(gate => [`${gate.kind}:${gate.value}`, gate])).values()];
      handlers.push({ id, method, file: relative(root, file), wrapper, gatePaths: paths, guards,
        recursiveVoidCalls:[...recursiveVoidCalls].sort(),
        boundaryPaths:uniquePaths(paths.map(path=>path.filter(gate=>gate.kind.startsWith('BOUNDARY_')))),
        unguardedPath: paths.length === 0 || paths.some(path => !path.some(gate=>!gate.kind.startsWith('BOUNDARY_')
          || id === 'GET /api/v2/self/membership' && gate.kind === 'BOUNDARY_SELF_METADATA')), unresolved: [...unresolved].sort(),
        bodyRange: body ? { file: sourceOf(body), start: body.getStart(), end: body.end } : null,
        calls: [...new Map(calls.map(call => [`${call.source}:${call.name}:${call.declaration.start}:${call.callSite.file}:${call.callSite.start}`, call])).values()] });
    }
  }
  return { schemaVersion: 2, proofKind: 'STATIC_SOURCE_OBSERVATION_ONLY',
    limitations:['Argument bindings and conservative source paths observe a restricted provenance contract; they do not prove runtime HTTP decisions, contextual scope, database invariance, or complete JavaScript semantics.',
      'Unknown spreads, mutable aliases, opaque authority escapes and unsupported callable shapes fail closed. Constructor projection supports declared parameter properties and methods; it does not infer arbitrary constructor assignments or getters.',
      'Final qualification must bind successful HTTP/DB evidence, this generator, configuration and all sources to the clean final SHA.'],
    handlers: handlers.sort((a, b) => a.id.localeCompare(b.id)),
    sources: localFiles.sort().map(file => ({ path: relative(root, file), sha256: createHash('sha256').update(readFileSync(file)).digest('hex') })),
    tooling:['scripts/core-v2/access-policy-inventory.ts','tsconfig.json','docs/core-v2/access-policy.json']
      .filter(file=>existsSync(join(root,file))).map(file=>({path:file,sha256:createHash('sha256').update(readFileSync(join(root,file))).digest('hex')}))
      .concat([{path:'@typescript/lib.es5.d.ts',sha256:createHash('sha256').update(readFileSync(es5Library)).digest('hex')}]) };
}
