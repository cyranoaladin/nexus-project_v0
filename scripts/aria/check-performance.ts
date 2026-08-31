import { existsSync, readFileSync, statSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import {
  DEFAULT_ARIA_HISTORY_BUDGET,
  selectAriaPromptHistory,
  type AriaHistoryTurn,
} from '../../lib/aria/domain/conversation/history-budget';
import { ARIA_PERFORMANCE_BUDGETS } from '../../lib/aria/domain/observability/performance-budgets';
import { formatAriaSSEEvent } from '../../lib/aria/transport/sse-parser';

export interface AriaPerformanceContractReport {
  readonly contextDbOperations: number;
  readonly dbWritesPerToken: number;
  readonly instrumentation: readonly [
    'RAG_LATENCY',
    'TIME_TO_FIRST_TOKEN',
    'GENERATION_DURATION',
    'TERMINAL_PERSISTENCE_DURATION',
  ];
}

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

function isCollectionLoopAncestor(node: ts.Node): boolean {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (ts.isForStatement(ancestor)
      || ts.isForInStatement(ancestor)
      || ts.isForOfStatement(ancestor)
      || ts.isWhileStatement(ancestor)
      || ts.isDoStatement(ancestor)) return true;
    if (ts.isCallExpression(ancestor)
      && ts.isPropertyAccessExpression(ancestor.expression)
      && ['filter', 'flatMap', 'forEach', 'map', 'reduce', 'reduceRight']
        .includes(ancestor.expression.name.text)) return true;
  }
  return false;
}

function unwrapExpression(node: ts.Expression): ts.Expression {
  let current = node;
  while (ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isParenthesizedExpression(current)
    || ts.isSatisfiesExpression(current)
    || ts.isNonNullExpression(current)) current = current.expression;
  return current;
}

function leftmostIdentifier(node: ts.Expression): string | undefined {
  let current = unwrapExpression(node);
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    current = unwrapExpression(current.expression);
  }
  return ts.isIdentifier(current) ? current.text : undefined;
}

function runtimeImports(ast: ts.SourceFile): readonly string[] {
  const imports: string[] = [];
  ast.forEachChild((node) => {
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && !node.importClause?.isTypeOnly) imports.push(node.moduleSpecifier.text);
    if (ts.isExportDeclaration(node)
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
      && !node.isTypeOnly
      && !(node.exportClause
        && ts.isNamedExports(node.exportClause)
        && node.exportClause.elements.length > 0
        && node.exportClause.elements.every((element) => element.isTypeOnly))) {
      imports.push(node.moduleSpecifier.text);
    }
  });
  return imports;
}

function resolveLocalModule(
  repositoryRoot: string,
  containingPath: string,
  specifier: string,
): string | undefined {
  const base = specifier.startsWith('@/')
    ? resolve(repositoryRoot, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(containingPath), specifier)
      : undefined;
  if (!base || !base.startsWith(resolve(repositoryRoot))) return undefined;
  return [`${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx'), base]
    .find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function contextDependencyPaths(
  repositoryRoot: string,
  entrypoints: readonly string[],
): readonly string[] {
  const discovered = new Set<string>();
  const pending = [...entrypoints];
  while (pending.length > 0) {
    const path = pending.pop()!;
    if (discovered.has(path)) continue;
    discovered.add(path);
    const ast = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true);
    for (const specifier of runtimeImports(ast)) {
      const imported = resolveLocalModule(repositoryRoot, path, specifier);
      if (imported && !discovered.has(imported)) pending.push(imported);
    }
  }
  return [...discovered];
}

function collectPrismaRoots(
  ast: ts.SourceFile,
  roots: Set<string> = new Set<string>(['prisma']),
): ReadonlySet<string> {
  const imports = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && /(?:^|\/)lib\/prisma$/.test(node.moduleSpecifier.text)
      && node.importClause?.namedBindings
      && ts.isNamedImports(node.importClause.namedBindings)) {
      for (const element of node.importClause.namedBindings.elements) {
        if ((element.propertyName?.text ?? element.name.text) === 'prisma') roots.add(element.name.text);
      }
    }
    node.forEachChild(imports);
  };
  imports(ast);
  let changed = true;
  while (changed) {
    changed = false;
    const aliases = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        const initializer = unwrapExpression(node.initializer);
        const origin = leftmostIdentifier(initializer);
        if (origin && roots.has(origin)) {
          if (ts.isIdentifier(node.name) && !roots.has(node.name.text)) {
            roots.add(node.name.text);
            changed = true;
          }
          if (ts.isObjectBindingPattern(node.name)) {
            for (const element of node.name.elements) {
              if (ts.isIdentifier(element.name) && !roots.has(element.name.text)) {
                roots.add(element.name.text);
                changed = true;
              }
            }
          }
        }
      }
      if (ts.isCallExpression(node)
        && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === '$transaction'
        && roots.has(leftmostIdentifier(node.expression) ?? '')) {
        for (const argument of node.arguments) {
          if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) {
            for (const parameter of argument.parameters) {
              if (ts.isIdentifier(parameter.name) && !roots.has(parameter.name.text)) {
                roots.add(parameter.name.text);
                changed = true;
              }
            }
          }
        }
      }
      node.forEachChild(aliases);
    };
    aliases(ast);
  }
  return roots;
}

function functionParameters(
  asts: readonly ts.SourceFile[],
): ReadonlyMap<string, Readonly<{ ast: ts.SourceFile; names: readonly string[] }>> {
  const functions = new Map<string, Readonly<{ ast: ts.SourceFile; names: readonly string[] }>>();
  const visit = (ast: ts.SourceFile, node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node)) {
      const definition = {
        ast,
        names: node.parameters.map((parameter) =>
          ts.isIdentifier(parameter.name) ? parameter.name.text : ''),
      };
      if (node.name) functions.set(node.name.text, definition);
      if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) {
        functions.set(defaultFunctionKey(ast), definition);
      }
    }
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      functions.set(node.name.text, {
        ast,
        names: node.initializer.parameters.map((parameter) =>
          ts.isIdentifier(parameter.name) ? parameter.name.text : ''),
      });
    }
    node.forEachChild((child) => visit(ast, child));
  };
  asts.forEach((ast) => visit(ast, ast));
  return functions;
}

interface FunctionBindingResolution {
  readonly aliases: ReadonlyMap<ts.SourceFile, ReadonlyMap<string, string>>;
  readonly namespaces: ReadonlyMap<ts.SourceFile, ReadonlySet<string>>;
}

function defaultFunctionKey(ast: ts.SourceFile): string {
  return `DEFAULT_EXPORT:${ast.fileName}`;
}

function functionBindingResolution(
  asts: readonly ts.SourceFile[],
  repositoryRoot: string,
): FunctionBindingResolution {
  const aliases = new Map<ts.SourceFile, Map<string, string>>();
  const namespaces = new Map<ts.SourceFile, Set<string>>();
  const astByPath = new Map(asts.map((ast) => [ast.fileName, ast]));
  for (const ast of asts) {
    const astAliases = new Map<string, string>();
    aliases.set(ast, astAliases);
    const astNamespaces = new Set<string>();
    namespaces.set(ast, astNamespaces);
    ast.forEachChild((node) => {
      if (ts.isImportDeclaration(node) && node.importClause?.namedBindings) {
        if (ts.isNamedImports(node.importClause.namedBindings)) {
          for (const element of node.importClause.namedBindings.elements) {
            astAliases.set(element.name.text, element.propertyName?.text ?? element.name.text);
          }
        } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          astNamespaces.add(node.importClause.namedBindings.name.text);
        }
      }
      if (ts.isImportDeclaration(node)
        && node.importClause?.name
        && ts.isStringLiteral(node.moduleSpecifier)) {
        const importedPath = resolveLocalModule(repositoryRoot, ast.fileName, node.moduleSpecifier.text);
        const importedAst = importedPath ? astByPath.get(importedPath) : undefined;
        if (importedAst) astAliases.set(node.importClause.name.text, defaultFunctionKey(importedAst));
      }
      if (ts.isExportDeclaration(node)
        && node.exportClause
        && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          astAliases.set(element.name.text, element.propertyName?.text ?? element.name.text);
        }
      }
    });
  }
  return { aliases, namespaces };
}

function resolveFunctionBinding(name: string, aliases: ReadonlyMap<string, string>): string {
  const seen = new Set<string>();
  let current = name;
  while (aliases.has(current) && !seen.has(current)) {
    seen.add(current);
    current = aliases.get(current)!;
  }
  return current;
}

function calledFunctionName(
  expression: ts.Expression,
  ast: ts.SourceFile,
  bindings: FunctionBindingResolution,
): string | undefined {
  const callable = unwrapExpression(expression);
  const aliases = bindings.aliases.get(ast) ?? new Map<string, string>();
  if (ts.isIdentifier(callable)) return resolveFunctionBinding(callable.text, aliases);
  if (ts.isPropertyAccessExpression(callable)
    && ts.isIdentifier(callable.expression)
    && bindings.namespaces.get(ast)?.has(callable.expression.text)) {
    return resolveFunctionBinding(callable.name.text, aliases);
  }
  return undefined;
}

function contextPrismaRoots(
  asts: readonly ts.SourceFile[],
  repositoryRoot: string,
): ReadonlyMap<ts.SourceFile, ReadonlySet<string>> {
  const roots = new Map(asts.map((ast) => [ast, new Set<string>(['prisma'])]));
  const functions = functionParameters(asts);
  const bindings = functionBindingResolution(asts, repositoryRoot);
  let changed = true;
  while (changed) {
    changed = false;
    for (const ast of asts) {
      const astRoots = roots.get(ast)!;
      const before = astRoots.size;
      collectPrismaRoots(ast, astRoots);
      if (astRoots.size !== before) changed = true;
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const functionName = calledFunctionName(node.expression, ast, bindings);
          const target = functionName ? functions.get(functionName) : undefined;
          if (target) {
            node.arguments.forEach((argument, index) => {
              const origin = leftmostIdentifier(unwrapExpression(argument));
              const parameter = target.names[index];
              const targetRoots = roots.get(target.ast)!;
              if (origin && astRoots.has(origin) && parameter && !targetRoots.has(parameter)) {
                targetRoots.add(parameter);
                changed = true;
              }
            });
          }
        }
        node.forEachChild(visit);
      };
      visit(ast);
    }
  }
  return roots;
}

function enclosingFunctionName(node: ts.Node): string | undefined {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (ts.isFunctionDeclaration(ancestor) && ancestor.name) return ancestor.name.text;
    if ((ts.isArrowFunction(ancestor) || ts.isFunctionExpression(ancestor))
      && ts.isVariableDeclaration(ancestor.parent)
      && ts.isIdentifier(ancestor.parent.name)) return ancestor.parent.name.text;
  }
  return undefined;
}

function collectionCallbackNames(asts: readonly ts.SourceFile[]): ReadonlySet<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && ['filter', 'flatMap', 'forEach', 'map', 'reduce', 'reduceRight']
        .includes(node.expression.name.text)) {
      for (const argument of node.arguments) {
        if (ts.isIdentifier(argument)) names.add(argument.text);
      }
    }
    node.forEachChild(visit);
  };
  asts.forEach((ast) => visit(ast));
  return names;
}

function inspectPrismaCalls(
  ast: ts.SourceFile,
  callbackNames: ReadonlySet<string>,
  roots: ReadonlySet<string>,
): Readonly<{
  count: number;
  insideCollectionLoop: boolean;
}> {
  let count = 0;
  let insideCollectionLoop = false;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)
      && roots.has(leftmostIdentifier(node.expression) ?? '')) {
      count += 1;
      if (isCollectionLoopAncestor(node)
        || callbackNames.has(enclosingFunctionName(node) ?? '')) insideCollectionLoop = true;
    }
    node.forEachChild(visit);
  };
  visit(ast);
  return Object.freeze({ count, insideCollectionLoop });
}

function localFunctionBodies(root: ts.Node): ReadonlyMap<string, ts.ConciseBody> {
  const functions = new Map<string, ts.ConciseBody>();
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      functions.set(node.name.text, node.body);
    }
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      functions.set(node.name.text, node.initializer.body);
    }
    node.forEachChild(visit);
  };
  visit(root);
  return functions;
}

interface LocalFunctionDefinition {
  readonly body: ts.ConciseBody;
  readonly parameters: readonly string[];
}

function localFunctionDefinitions(asts: readonly ts.SourceFile[]): ReadonlyMap<string, LocalFunctionDefinition> {
  const definitions = new Map<string, LocalFunctionDefinition>();
  for (const ast of asts) {
    const visit = (node: ts.Node): void => {
      if (ts.isFunctionDeclaration(node) && node.body) {
        const definition = {
          body: node.body,
          parameters: node.parameters.map((parameter) =>
            ts.isIdentifier(parameter.name) ? parameter.name.text : ''),
        };
        if (node.name) definitions.set(node.name.text, definition);
        if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) {
          definitions.set(defaultFunctionKey(ast), definition);
        }
      }
      if (ts.isVariableDeclaration(node)
        && ts.isIdentifier(node.name)
        && node.initializer
        && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
        definitions.set(node.name.text, {
          body: node.initializer.body,
          parameters: node.initializer.parameters.map((parameter) =>
            ts.isIdentifier(parameter.name) ? parameter.name.text : ''),
        });
      }
      node.forEachChild(visit);
    };
    visit(ast);
  }
  return definitions;
}

function repositoryCallsInsideModelLoop(
  asts: readonly ts.SourceFile[],
  ast: ts.SourceFile,
  repositoryRoot: string,
): number {
  const repositoryAliases = new Set<string>();
  const streamFactories = new Set<string>();
  const streamIterables = new Set<string>();
  let changed = true;
  const collectAliases = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const initializer = unwrapExpression(node.initializer);
      const initializerText = initializer.getText(ast);
      if (ts.isIdentifier(node.name)) {
        if (initializerText === 'dependencies.repository'
          || (ts.isIdentifier(initializer) && repositoryAliases.has(initializer.text))) {
          if (!repositoryAliases.has(node.name.text)) changed = true;
          repositoryAliases.add(node.name.text);
        }
        if (initializerText === 'dependencies.streamModel'
          || (ts.isIdentifier(initializer) && streamFactories.has(initializer.text))) {
          if (!streamFactories.has(node.name.text)) changed = true;
          streamFactories.add(node.name.text);
        }
        if ((ts.isCallExpression(initializer)
          && (initializer.expression.getText(ast) === 'dependencies.streamModel'
            || (ts.isIdentifier(initializer.expression)
              && streamFactories.has(initializer.expression.text))))
          || (ts.isIdentifier(initializer) && streamIterables.has(initializer.text))) {
          if (!streamIterables.has(node.name.text)) changed = true;
          streamIterables.add(node.name.text);
        }
      }
      if (ts.isObjectBindingPattern(node.name) && initializerText === 'dependencies') {
        for (const element of node.name.elements) {
          const propertyName = element.propertyName?.getText(ast) ?? element.name.getText(ast);
          if (ts.isIdentifier(element.name) && propertyName === 'repository') {
            if (!repositoryAliases.has(element.name.text)) changed = true;
            repositoryAliases.add(element.name.text);
          }
          if (ts.isIdentifier(element.name) && propertyName === 'streamModel') {
            if (!streamFactories.has(element.name.text)) changed = true;
            streamFactories.add(element.name.text);
          }
        }
      }
    }
    if (ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isIdentifier(node.left)) {
      const right = unwrapExpression(node.right);
      const rightText = right.getText(ast);
      if (rightText === 'dependencies.repository'
        || (ts.isIdentifier(right) && repositoryAliases.has(right.text))) {
        if (!repositoryAliases.has(node.left.text)) changed = true;
        repositoryAliases.add(node.left.text);
      }
      if ((ts.isCallExpression(right)
        && (right.expression.getText(ast) === 'dependencies.streamModel'
          || (ts.isIdentifier(right.expression) && streamFactories.has(right.expression.text))))
        || (ts.isIdentifier(right) && streamIterables.has(right.text))) {
        if (!streamIterables.has(node.left.text)) changed = true;
        streamIterables.add(node.left.text);
      }
      if (rightText === 'dependencies.streamModel'
        || (ts.isIdentifier(right) && streamFactories.has(right.text))) {
        if (!streamFactories.has(node.left.text)) changed = true;
        streamFactories.add(node.left.text);
      }
    }
    node.forEachChild(collectAliases);
  };
  while (changed) {
    changed = false;
    collectAliases(ast);
  }
  const isModelStream = (expression: ts.Expression): boolean => {
    const candidate = unwrapExpression(expression);
    if (candidate.getText(ast).includes('dependencies.streamModel')) return true;
    if (ts.isIdentifier(candidate)) return streamIterables.has(candidate.text);
    return ts.isCallExpression(candidate)
      && ts.isIdentifier(candidate.expression)
      && streamFactories.has(candidate.expression.text);
  };
  const functions = localFunctionDefinitions(asts);
  const bindings = functionBindingResolution(asts, repositoryRoot);
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isForOfStatement(node) && node.awaitModifier && isModelStream(node.expression)) {
        const activeFunctions = new Set<string>();
        const inspectBody = (candidate: ts.Node): void => {
          if (ts.isCallExpression(candidate)) {
            const candidateAst = candidate.getSourceFile();
            const callee = candidate.expression.getText(candidateAst);
            const calleeRoot = leftmostIdentifier(candidate.expression);
            if (callee.startsWith('dependencies.repository.')
              || callee.startsWith('dependencies.repository[')
              || (calleeRoot && repositoryAliases.has(calleeRoot))) count += 1;
            const functionName = calledFunctionName(candidate.expression, candidateAst, bindings);
            if (functionName) {
              const definition = functions.get(functionName);
              if (definition && !activeFunctions.has(functionName)) {
                candidate.arguments.forEach((argument, index) => {
                  const argumentText = unwrapExpression(argument).getText(candidateAst);
                  const argumentRoot = leftmostIdentifier(unwrapExpression(argument));
                  const parameter = definition.parameters[index];
                  if (parameter && (argumentText === 'dependencies.repository'
                    || (argumentRoot && repositoryAliases.has(argumentRoot)))) {
                    repositoryAliases.add(parameter);
                  }
                });
                activeFunctions.add(functionName);
                inspectBody(definition.body);
                activeFunctions.delete(functionName);
              }
            }
          }
          if ((ts.isFunctionDeclaration(candidate)
            || ts.isFunctionExpression(candidate)
            || ts.isArrowFunction(candidate)) && candidate !== node.statement) return;
          candidate.forEachChild(inspectBody);
        };
        inspectBody(node.statement);
    }
    node.forEachChild(visit);
  };
  visit(ast);
  return count;
}

function containsModelStreamOrigin(node: ts.Node, ast: ts.SourceFile): boolean {
  let found = false;
  const visit = (candidate: ts.Node): void => {
    if (ts.isPropertyAccessExpression(candidate)
      && candidate.getText(ast) === 'dependencies.streamModel') found = true;
    if (ts.isVariableDeclaration(candidate)
      && ts.isObjectBindingPattern(candidate.name)
      && candidate.initializer?.getText(ast) === 'dependencies'
      && candidate.name.elements.some((element) =>
        (element.propertyName?.getText(ast) ?? element.name.getText(ast)) === 'streamModel')) {
      found = true;
    }
    if (!found) candidate.forEachChild(visit);
  };
  visit(node);
  return found;
}

function executionFunction(ast: ts.SourceFile): ts.FunctionLikeDeclaration {
  const candidates: ts.FunctionLikeDeclaration[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isFunctionDeclaration(node)
      || ts.isFunctionExpression(node)
      || ts.isArrowFunction(node)
      || ts.isMethodDeclaration(node))
      && node.body
      && containsModelStreamOrigin(node.body, ast)) {
      candidates.push(node);
    }
    node.forEachChild(visit);
  };
  visit(ast);
  const selected = candidates.sort((left, right) =>
    (left.end - left.pos) - (right.end - right.pos))[0];
  if (!selected) throw new Error('ARIA_PERFORMANCE_EXECUTION_PATH_MISSING');
  return selected;
}

function alwaysCompletesAbruptly(node: ts.Node): boolean {
  if (ts.isReturnStatement(node) || ts.isThrowStatement(node)) return true;
  if (ts.isBlock(node)) {
    const last = node.statements[node.statements.length - 1];
    return last ? alwaysCompletesAbruptly(last) : false;
  }
  if (ts.isIfStatement(node)) {
    if (node.expression.kind === ts.SyntaxKind.TrueKeyword) {
      return alwaysCompletesAbruptly(node.thenStatement);
    }
    if (node.expression.kind === ts.SyntaxKind.FalseKeyword) {
      return node.elseStatement ? alwaysCompletesAbruptly(node.elseStatement) : false;
    }
    return Boolean(node.elseStatement
      && alwaysCompletesAbruptly(node.thenStatement)
      && alwaysCompletesAbruptly(node.elseStatement));
  }
  return false;
}

function visitReachable(
  root: ts.Node,
  visitor: (node: ts.Node) => void,
): void {
  const functions = localFunctionBodies(root);
  const activeFunctions = new Set<string>();
  const visit = (node: ts.Node): void => {
    visitor(node);
    if (ts.isBlock(node)) {
      for (const statement of node.statements) {
        visit(statement);
        if (alwaysCompletesAbruptly(statement)) break;
      }
      return;
    }
    if (ts.isIfStatement(node)) {
      visit(node.expression);
      if (node.expression.kind === ts.SyntaxKind.FalseKeyword) {
        if (node.elseStatement) visit(node.elseStatement);
        return;
      }
      visit(node.thenStatement);
      if (node.expression.kind !== ts.SyntaxKind.TrueKeyword && node.elseStatement) {
        visit(node.elseStatement);
      }
      return;
    }
    if (ts.isFunctionDeclaration(node)
      || ts.isFunctionExpression(node)
      || ts.isArrowFunction(node)) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const functionName = node.expression.text;
      const body = functions.get(functionName);
      if (body && !activeFunctions.has(functionName)) {
        activeFunctions.add(functionName);
        visit(body);
        activeFunctions.delete(functionName);
      }
    }
    node.forEachChild(visit);
  };
  visit(root);
}

function isElapsedCall(node: ts.Expression | undefined): boolean {
  if (!node) return false;
  const expression = unwrapExpression(node);
  return ts.isCallExpression(expression)
    && ts.isIdentifier(expression.expression)
    && expression.expression.text === 'elapsed';
}

function elapsedUsesMonotonicClock(root: ts.Node): boolean {
  let elapsed:
    | { readonly body: ts.ConciseBody; readonly parameter: string }
    | undefined;
  const findElapsed = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === 'elapsed'
      && node.initializer
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      const parameter = node.initializer.parameters[0]?.name;
      if (parameter && ts.isIdentifier(parameter)) {
        elapsed = { body: node.initializer.body, parameter: parameter.text };
      }
    }
    if (!elapsed) node.forEachChild(findElapsed);
  };
  findElapsed(root);
  if (!elapsed) return false;
  const containsDurationSubtraction = (node: ts.Node): boolean => {
    let found = false;
    const visit = (candidate: ts.Node): void => {
      if (ts.isBinaryExpression(candidate)
        && candidate.operatorToken.kind === ts.SyntaxKind.MinusToken
        && containsIdentifier(candidate.right, elapsed!.parameter)) {
        let hasMonotonicCall = false;
        const inspectLeft = (left: ts.Node): void => {
          if (ts.isCallExpression(left)
            && left.expression.getText(left.getSourceFile()) === 'dependencies.monotonicNow') {
            hasMonotonicCall = true;
          }
          if (!hasMonotonicCall) left.forEachChild(inspectLeft);
        };
        inspectLeft(candidate.left);
        if (hasMonotonicCall) found = true;
      }
      if (!found) candidate.forEachChild(visit);
    };
    visit(node);
    return found;
  };
  if (!ts.isBlock(elapsed.body)) return containsDurationSubtraction(elapsed.body);
  return elapsed.body.statements.some((statement) =>
    ts.isReturnStatement(statement)
    && statement.expression
    && containsDurationSubtraction(statement.expression));
}

function containsIdentifier(node: ts.Node | undefined, name: string): boolean {
  if (!node) return false;
  let found = false;
  const visit = (candidate: ts.Node): void => {
    if (ts.isIdentifier(candidate) && candidate.text === name) found = true;
    if (!found) candidate.forEachChild(visit);
  };
  visit(node);
  return found;
}

function canonicalLocalEmitters(root: ts.Node, ast: ts.SourceFile): ReadonlySet<string> {
  const emitters = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      const body = node.initializer.body;
      if (body.getText(ast).includes('recordAriaTelemetry(dependencies.telemetry')) {
        emitters.add(node.name.text);
      }
    }
    node.forEachChild(visit);
  };
  visit(root);
  return emitters;
}

function hasTelemetryEvent(input: {
  readonly root: ts.Node;
  readonly ast: ts.SourceFile;
  readonly event: string;
  readonly durationIdentifier?: string;
  readonly detailIdentifier?: string;
  readonly requireElapsedDuration?: boolean;
}): boolean {
  const emitters = canonicalLocalEmitters(input.root, input.ast);
  const detailIdentifier = input.detailIdentifier;
  const elapsedState = new Map<string, boolean>();
  let found = false;
  visitReachable(input.root, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      elapsedState.set(node.name.text, isElapsedCall(node.initializer));
    }
    if (ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isIdentifier(node.left)) {
      elapsedState.set(node.left.text, isElapsedCall(node.right));
    }
    if (ts.isCallExpression(node)) {
      const callable = node.expression;
      const isEmitter = (ts.isIdentifier(callable) && emitters.has(callable.text))
        || callable.getText(input.ast) === 'dependencies.telemetry.emit';
      if (isEmitter && ts.isStringLiteral(node.arguments[0])
        && node.arguments[0].text === input.event
        && (!input.durationIdentifier
          || (elapsedState.get(input.durationIdentifier) === true
            && containsIdentifier(node.arguments[1], input.durationIdentifier)))
        && (!detailIdentifier
          || (elapsedState.get(detailIdentifier) === true
            && node.arguments.slice(2).some((argument) =>
              containsIdentifier(argument, detailIdentifier))))
        && (!input.requireElapsedDuration
          || (ts.isCallExpression(node.arguments[1])
            && ts.isIdentifier(node.arguments[1].expression)
            && node.arguments[1].expression.text === 'elapsed'))) found = true;
    }
  });
  return found;
}

export function inspectAriaPerformanceContract(repositoryRoot: string): AriaPerformanceContractReport {
  const contextEntrypoints = [
    resolve(repositoryRoot, 'lib/aria/application/conversation/build-context.ts'),
    resolve(repositoryRoot, 'lib/aria/application/conversation/load-authorization-student.ts'),
  ];
  const contextPaths = contextDependencyPaths(repositoryRoot, contextEntrypoints);
  const executionPath = resolve(repositoryRoot, 'lib/aria/application/conversation/run-conversation.ts');
  const executionPaths = contextDependencyPaths(repositoryRoot, [executionPath]);
  const executionSource = source(executionPath);
  const executionAst = ts.createSourceFile(executionPath, executionSource, ts.ScriptTarget.Latest, true);
  const executionAsts = executionPaths.map((path) => path === executionPath
    ? executionAst
    : ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true));
  const execution = executionFunction(executionAst);
  const executionBody = execution.body!;
  let contextQueryInsideLoop = false;
  const contextAsts = contextPaths.map((contextPath) => {
    const contextSource = source(contextPath);
    return ts.createSourceFile(contextPath, contextSource, ts.ScriptTarget.Latest, true);
  });
  const callbacks = collectionCallbackNames(contextAsts);
  const prismaRoots = contextPrismaRoots(contextAsts, repositoryRoot);
  const contextDbOperations = contextAsts.reduce((count, contextAst) => {
    const analysis = inspectPrismaCalls(contextAst, callbacks, prismaRoots.get(contextAst)!);
    if (analysis.insideCollectionLoop) contextQueryInsideLoop = true;
    return count + analysis.count;
  }, 0);
  const dbWritesPerToken = repositoryCallsInsideModelLoop(
    executionAsts,
    executionAst,
    repositoryRoot,
  );
  const requiredInstrumentation = [
    [hasTelemetryEvent({
        root: executionBody, ast: executionAst, event: 'RETRIEVAL', durationIdentifier: 'ragLatencyMs',
      }), 'RAG_LATENCY'],
    [hasTelemetryEvent({
        root: executionBody, ast: executionAst, event: 'MODEL', detailIdentifier: 'timeToFirstTokenMs',
      }), 'TIME_TO_FIRST_TOKEN'],
    [hasTelemetryEvent({
        root: executionBody, ast: executionAst, event: 'MODEL', durationIdentifier: 'generationDurationMs',
      }), 'GENERATION_DURATION'],
    [hasTelemetryEvent({
      root: executionBody, ast: executionAst, event: 'FINALIZE', requireElapsedDuration: true,
    }), 'TERMINAL_PERSISTENCE_DURATION'],
  ] as const;
  for (const [present, label] of requiredInstrumentation) {
    if (!present) throw new Error(`ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:${label}`);
  }
  if (!elapsedUsesMonotonicClock(executionBody)) {
    throw new Error('ARIA_PERFORMANCE_INSTRUMENTATION_MISSING:MONOTONIC_CLOCK');
  }
  if (contextQueryInsideLoop) throw new Error('ARIA_CONTEXT_QUERY_INSIDE_COLLECTION_LOOP');
  if (contextDbOperations > ARIA_PERFORMANCE_BUDGETS.contextDbOperationsMax) {
    throw new Error(`ARIA_CONTEXT_QUERY_BUDGET_EXCEEDED:${contextDbOperations}`);
  }
  if (dbWritesPerToken !== 0) throw new Error(`ARIA_DB_WRITES_PER_TOKEN:${dbWritesPerToken}`);
  return Object.freeze({
    contextDbOperations,
    dbWritesPerToken,
    instrumentation: Object.freeze(requiredInstrumentation.map(([, label]) => label)) as
      AriaPerformanceContractReport['instrumentation'],
  });
}

function percentile95(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

function fixtureTurns(): readonly AriaHistoryTurn[] {
  return Array.from({ length: 100 }, (_, index) => ({
    turnId: `turn-${String(index).padStart(3, '0')}`,
    createdAt: new Date(1_788_000_000_000 + index),
    user: { id: `user-${index}`, role: 'user' as const, content: `Question ${index}` },
    assistant: { id: `assistant-${index}`, role: 'assistant' as const, content: `Réponse ${index}` },
  }));
}

export function measureAriaDeterministicPerformance(iterations = 20): Readonly<{
  history100TurnsP95Ms: number;
  sse500EventsP95Ms: number;
}> {
  if (!Number.isSafeInteger(iterations) || iterations < 5 || iterations > 100) {
    throw new Error('ARIA_PERFORMANCE_ITERATIONS_INVALID');
  }
  const historyDurations: number[] = [];
  const sseDurations: number[] = [];
  const turns = fixtureTurns();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let startedAt = performance.now();
    selectAriaPromptHistory(turns, DEFAULT_ARIA_HISTORY_BUDGET);
    historyDurations.push(performance.now() - startedAt);

    startedAt = performance.now();
    for (let index = 0; index < 500; index += 1) {
      formatAriaSSEEvent({ event: 'delta', data: { text: `token-${index}` } });
    }
    sseDurations.push(performance.now() - startedAt);
  }
  return Object.freeze({
    history100TurnsP95Ms: percentile95(historyDurations),
    sse500EventsP95Ms: percentile95(sseDurations),
  });
}

function main(): void {
  const contract = inspectAriaPerformanceContract(process.cwd());
  const measured = measureAriaDeterministicPerformance();
  if (measured.history100TurnsP95Ms > ARIA_PERFORMANCE_BUDGETS.fixtureOverheadP95Ms
    || measured.sse500EventsP95Ms > ARIA_PERFORMANCE_BUDGETS.fixtureOverheadP95Ms) {
    throw new Error('ARIA_DETERMINISTIC_PERFORMANCE_BUDGET_EXCEEDED');
  }
  process.stdout.write(`ARIA_CONTEXT_DB_OPERATIONS_OBSERVED=${contract.contextDbOperations}\n`);
  process.stdout.write(`ARIA_DB_WRITES_PER_TOKEN=${contract.dbWritesPerToken}\n`);
  process.stdout.write(`ARIA_HISTORY_100_TURNS_P95_MS=${measured.history100TurnsP95Ms.toFixed(3)}\n`);
  process.stdout.write(`ARIA_SSE_500_EVENTS_P95_MS=${measured.sse500EventsP95Ms.toFixed(3)}\n`);
  process.stdout.write(`ARIA_LATENCY_INSTRUMENTATION=${contract.instrumentation.join(',')}\n`);
}

if (require.main === module) main();
