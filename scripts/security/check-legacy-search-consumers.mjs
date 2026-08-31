#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { accessSync, constants, existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs',
  '.sh', '.bash', '.zsh', '.py', '.md', '.mdx',
]);
const JAVASCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const ARTIFACT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const EXECUTABLE_FENCE_LANGUAGES = new Set([
  'js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx', 'mts', 'cts', 'mjs', 'cjs',
  'sh', 'bash', 'shell', 'zsh', 'py', 'python',
]);
// Exact generated/vendor/VCS/test-artifact directory names. There is
// deliberately no source-directory allowlist.
const SOURCE_EXCLUDED_DIRECTORIES = new Set([
  '.git', '.next', '.turbo', '.cache', 'node_modules', 'vendor', 'dist', 'build',
  'coverage', 'test-results', 'playwright-report',
]);
const ARTIFACT_EXCLUDED_DIRECTORIES = new Set([
  '.git', 'node_modules', 'coverage', 'test-results', 'playwright-report',
]);
const DENIAL_TESTS = new Map([
  ['__tests__/api/assistante.students-search-retired.route.test.ts', {
    endpoint: '/api/assistante/students', parameter: 'search', routeCall: 'GET',
  }],
  ['__tests__/api/staff-safe-search-consumers.route.test.ts', {
    endpoint: '/api/quotes/leads/search', parameter: 'q', routeCall: 'retiredLeadGet',
  }],
]);

export class LegacySearchScanError extends Error {
  constructor(code) {
    super(code);
    this.name = 'LegacySearchScanError';
    this.code = code;
  }
}

function normalizeTransportText(value) {
  let normalized = String(value)
    .replace(/\\x([0-9a-f]{2})/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\u00([0-9a-f]{2})/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\\//g, '/');
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const decoded = decodeURIComponent(normalized);
      if (decoded === normalized) break;
      normalized = decoded;
    } catch {
      break;
    }
  }
  return normalized;
}

function classifyTransport(targetValue, methodValue) {
  const target = normalizeTransportText(targetValue).replace(/\s+/g, '');
  const method = methodValue == null ? 'GET' : String(methodValue).toUpperCase();
  const match = legacyTarget(target);
  if (!match) return null;
  const { kind, hasForbiddenQuery } = match;
  if (method === 'POST') return hasForbiddenQuery ? 'QUERY_PII' : null;
  if (method === 'GET') {
    if (kind === 'student' && !hasForbiddenQuery) return null;
    return methodValue == null ? 'DEFAULT_GET' : 'EXPLICIT_GET';
  }
  return 'AMBIGUOUS_METHOD';
}

function legacyTarget(value) {
  const target = normalizeTransportText(value).replace(/\s+/g, '');
  const definitions = [
    { kind: 'lead', path: '/api/quotes/leads/search', key: 'q' },
    { kind: 'student', path: '/api/assistante/students', key: 'search' },
  ];
  for (const definition of definitions) {
    const index = target.indexOf(definition.path);
    if (index < 0) continue;
    let suffix = target.slice(index + definition.path.length);
    if (suffix.startsWith('/')) suffix = suffix.slice(1);
    if (suffix && !/^[?&#*]/.test(suffix)) continue;
    let hasForbiddenQuery = false;
    if (!target.includes('*')) {
      try {
        const parsed = new URL(target.slice(index), 'https://scanner.invalid');
        hasForbiddenQuery = parsed.searchParams.has(definition.key);
      } catch { /* conservative expression fallback below */ }
    }
    hasForbiddenQuery ||= new RegExp(`(?:[?&*])${definition.key}(?:=|&|#|$|\\*)`, 'i').test(suffix);
    return { ...definition, hasForbiddenQuery };
  }
  return null;
}

function appendQueryKeys(base, keys) {
  if (keys.size === 0) return base;
  return `${base}${base.includes('?') ? '&' : '?'}${[...keys].map((key) => `${key}=*`).join('&')}`;
}

function propertyName(property) {
  if (!property?.name) return null;
  return ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name) ? property.name.text : null;
}

function objectProperty(node, name, environment) {
  if (!node) return null;
  let object = ts.isIdentifier(node) ? environment.objects.get(node.text) : node;
  if (object && ts.isCallExpression(object) && ts.isPropertyAccessExpression(object.expression)
    && object.expression.name.text === 'objectContaining') object = object.arguments[0];
  if (!object || !ts.isObjectLiteralExpression(object)) return null;
  const property = object.properties.find((candidate) => ts.isPropertyAssignment(candidate) && propertyName(candidate) === name);
  return property && ts.isPropertyAssignment(property) ? property.initializer : null;
}

function evaluateExpression(node, environment) {
  if (!node) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return evaluateExpression(node.expression, environment);
  if (ts.isTemplateExpression(node)) {
    let result = node.head.text;
    for (const span of node.templateSpans) result += `${evaluateExpression(span.expression, environment) ?? '*'}${span.literal.text}`;
    return result;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return `${evaluateExpression(node.left, environment) ?? '*'}${evaluateExpression(node.right, environment) ?? '*'}`;
  }
  if (ts.isConditionalExpression(node)) {
    const yes = evaluateExpression(node.whenTrue, environment);
    const no = evaluateExpression(node.whenFalse, environment);
    return yes === no ? yes : `${yes ?? '*'}*${no ?? '*'}`;
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((item) => evaluateExpression(item, environment) ?? '*').join('*');
  if (ts.isIdentifier(node)) {
    const url = environment.urls.get(node.text);
    if (url) return appendQueryKeys(url.base, url.keys);
    const params = environment.params.get(node.text);
    if (params) return [...params].map((key, index) => `${index === 0 ? '?' : '&'}${key}=*`).join('');
    const array = environment.arrays.get(node.text);
    if (array) return array.join('*');
    return environment.values.get(node.text) ?? '*';
  }
  if (ts.isPropertyAccessExpression(node)) {
    const owner = evaluateExpression(node.expression, environment);
    return owner && owner !== '*' ? `${owner}*${node.name.text}` : '*';
  }
  if (ts.isCallExpression(node)) {
    if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'toString') {
      const owner = node.expression.expression;
      if (ts.isIdentifier(owner)) {
        const params = environment.params.get(owner.text);
        if (params) return [...params].map((key, index) => `${index === 0 ? '' : '&'}${key}=*`).join('');
      }
    }
    if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'join') {
      const owner = node.expression.expression;
      const array = ts.isIdentifier(owner)
        ? environment.arrays.get(owner.text)
        : ts.isArrayLiteralExpression(owner)
          ? owner.elements.map((item) => evaluateExpression(item, environment) ?? '*')
          : null;
      if (array) return array.join(evaluateExpression(node.arguments[0], environment) ?? ',');
    }
    const values = node.arguments.map((argument) => evaluateExpression(argument, environment))
      .filter((value) => value != null && value !== '*');
    return values.length > 0 ? values.join('*') : null;
  }
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
    if (node.expression.text === 'URL') return evaluateExpression(node.arguments?.[0], environment);
    if (node.expression.text === 'URLSearchParams') {
      return appendQueryKeys('', queryKeysFromNode(node.arguments?.[0], environment));
    }
  }
  return null;
}

function queryKeysFromNode(node, environment) {
  if (!node) return new Set();
  if (ts.isParenthesizedExpression(node)) return queryKeysFromNode(node.expression, environment);
  if (ts.isIdentifier(node)) {
    if (environment.params.has(node.text)) return new Set(environment.params.get(node.text));
    if (environment.objects.has(node.text)) return queryKeysFromNode(environment.objects.get(node.text), environment);
  }
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)
    && node.expression.text === 'URLSearchParams') return queryKeysFromNode(node.arguments?.[0], environment);
  if (ts.isObjectLiteralExpression(node)) {
    return new Set(node.properties.map(propertyName).filter(Boolean));
  }
  if (ts.isArrayLiteralExpression(node)) {
    const keys = new Set();
    for (const item of node.elements) {
      if (!ts.isArrayLiteralExpression(item)) continue;
      const key = evaluateExpression(item.elements[0], environment);
      if (key) keys.add(key);
    }
    return keys;
  }
  const value = evaluateExpression(node, environment);
  const keys = new Set();
  if (value) for (const match of value.matchAll(/(?:^|[?&])([^=&*]+)(?:=|&|$)/g)) keys.add(match[1]);
  return keys;
}

function methodFromOptions(node, environment) {
  if (!node) return null;
  const property = objectProperty(node, 'method', environment);
  if (!property) {
    return ts.isObjectLiteralExpression(node) || (ts.isIdentifier(node) && environment.objects.has(node.text))
      ? null
      : 'UNKNOWN';
  }
  return evaluateExpression(property, environment);
}

function provenJsonPostMethod(node, environment) {
  if (String(methodFromOptions(node, environment)).toUpperCase() !== 'POST') return null;
  const headers = objectProperty(node, 'headers', environment);
  const contentType = headers ? objectProperty(headers, 'Content-Type', environment)
    ?? objectProperty(headers, 'content-type', environment) : null;
  const value = evaluateExpression(contentType, environment);
  return value && /^application\/json(?:\s*;|$)/i.test(value) ? 'POST' : null;
}

function callName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return null;
}

function bindingPatternContains(pattern, name) {
  if (ts.isIdentifier(pattern)) return pattern.text === name;
  if (!ts.isObjectBindingPattern(pattern) && !ts.isArrayBindingPattern(pattern)) return false;
  return pattern.elements.some((element) => ts.isBindingElement(element)
    && bindingPatternContains(element.name, name));
}

function collectModuleBindings(source) {
  const bindings = new Map();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)) {
      const moduleSource = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (clause?.name) bindings.set(clause.name.text, { kind: 'import', source: moduleSource, imported: 'default' });
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        bindings.set(clause.namedBindings.name.text, { kind: 'import', source: moduleSource, imported: '*' });
      } else if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const specifier of clause.namedBindings.elements) {
          bindings.set(specifier.name.text, {
            kind: 'import',
            source: moduleSource,
            imported: specifier.propertyName?.text ?? specifier.name.text,
          });
        }
      }
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer;
      if (!initializer || !ts.isCallExpression(initializer) || !ts.isIdentifier(initializer.expression)
        || initializer.expression.text !== 'require' || initializer.arguments.length !== 1
        || !ts.isStringLiteralLike(initializer.arguments[0])) continue;
      const moduleSource = initializer.arguments[0].text;
      if (ts.isIdentifier(declaration.name)) {
        bindings.set(declaration.name.text, { kind: 'import', source: moduleSource, imported: 'default' });
      } else if (ts.isObjectBindingPattern(declaration.name)) {
        for (const element of declaration.name.elements) {
          if (!ts.isIdentifier(element.name)) continue;
          const imported = element.propertyName && (ts.isIdentifier(element.propertyName) || ts.isStringLiteralLike(element.propertyName))
            ? element.propertyName.text : element.name.text;
          bindings.set(element.name.text, { kind: 'import', source: moduleSource, imported });
        }
      }
    }
  }
  return bindings;
}

function scopeDeclares(scope, name) {
  if (ts.isFunctionLike(scope) || ts.isFunctionDeclaration(scope) || ts.isMethodDeclaration(scope)) {
    if (scope.name && ts.isIdentifier(scope.name) && scope.name.text === name) return true;
    if (scope.parameters.some((parameter) => bindingPatternContains(parameter.name, name))) return true;
  }
  const statements = ts.isSourceFile(scope) || ts.isBlock(scope) ? scope.statements : null;
  if (!statements) return false;
  return statements.some((statement) => {
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.some((declaration) => bindingPatternContains(declaration.name, name));
    }
    return (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name?.text === name;
  });
}

function resolveBinding(identifier, context) {
  const name = identifier.text;
  for (let current = identifier.parent; current && !ts.isSourceFile(current); current = current.parent) {
    if ((ts.isBlock(current) || ts.isFunctionLike(current) || ts.isFunctionDeclaration(current)
      || ts.isMethodDeclaration(current)) && scopeDeclares(current, name)) return { kind: 'local' };
  }
  const imported = context.moduleBindings.get(name);
  if (imported) return imported;
  if (scopeDeclares(context.source, name)) return { kind: 'local' };
  return { kind: 'global' };
}

function exactImport(identifier, context, source, imported) {
  const binding = resolveBinding(identifier, context);
  return binding.kind === 'import' && binding.source === source && binding.imported === imported;
}

function isFunctionLike(node) {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

function isTestInvocation(call, callback) {
  if (!call.arguments.some((argument) => argument === callback)) return false;
  const expression = call.expression;
  if (ts.isIdentifier(expression)) return expression.text === 'test' || expression.text === 'it';
  if (ts.isPropertyAccessExpression(expression)) {
    let owner = expression.expression;
    while (ts.isPropertyAccessExpression(owner)) owner = owner.expression;
    return ts.isIdentifier(owner) && (owner.text === 'test' || owner.text === 'it');
  }
  if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
    const owner = expression.expression.expression;
    return ts.isIdentifier(owner) && (owner.text === 'test' || owner.text === 'it') && expression.expression.name.text === 'each';
  }
  return false;
}

function enclosingTestCallback(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (isFunctionLike(current) && current.parent && ts.isCallExpression(current.parent) && isTestInvocation(current.parent, current)) return current;
  }
  return null;
}

function assertionMatchesVariable(node, variableName) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  if (!['toBe', 'toEqual', 'toStrictEqual'].includes(node.expression.name.text)) return false;
  const expected = node.arguments[0];
  if (!expected || !ts.isNumericLiteral(expected) || expected.text !== '405') return false;
  const expectCall = node.expression.expression;
  if (!ts.isCallExpression(expectCall) || callName(expectCall.expression) !== 'expect') return false;
  const actual = expectCall.arguments[0];
  return Boolean(actual && ts.isPropertyAccessExpression(actual)
    && actual.name.text === 'status'
    && ts.isIdentifier(actual.expression)
    && actual.expression.text === variableName);
}

function exactDenialAssertion(routeInvocation) {
  let initializer = routeInvocation;
  if (initializer.parent && ts.isAwaitExpression(initializer.parent)) initializer = initializer.parent;
  const declaration = initializer.parent;
  if (!declaration || !ts.isVariableDeclaration(declaration) || !ts.isIdentifier(declaration.name)) return false;
  const statement = declaration.parent?.parent;
  const controlScope = statement?.parent;
  if (!statement || !ts.isVariableStatement(statement) || !controlScope || !ts.isBlock(controlScope)) return false;
  const callback = enclosingTestCallback(routeInvocation);
  if (!callback || callback.body !== controlScope) return false;
  return controlScope.statements.some((candidate) => candidate.pos > statement.pos
    && ts.isExpressionStatement(candidate)
    && assertionMatchesVariable(candidate.expression, declaration.name.text));
}

function denialTestAllows(relativePath, target, operation, node) {
  const policy = DENIAL_TESTS.get(relativePath);
  if (!policy || operation !== 'Request') return false;
  const routeInvocation = node.parent;
  return normalizeTransportText(target).includes(`${policy.endpoint}?${policy.parameter}=`)
    && ts.isCallExpression(routeInvocation)
    && callName(routeInvocation.expression) === policy.routeCall
    && routeInvocation.arguments.some((argument) => argument === node)
    && exactDenialAssertion(routeInvocation);
}

function transportCall(node, environment, context) {
  const expression = node.expression;
  if (ts.isIdentifier(expression) && expression.text === 'fetch'
    && resolveBinding(expression, context).kind === 'global') {
    return { targetNode: node.arguments[0], method: methodFromOptions(node.arguments[1], environment), operation: 'fetch' };
  }
  if (ts.isIdentifier(expression)) {
    const binding = resolveBinding(expression, context);
    const trustedCallable = binding.kind === 'import' && (
      (binding.source === 'axios' && binding.imported === 'default')
      || (binding.source === 'got' && binding.imported === 'default')
      || (binding.source === 'ky' && binding.imported === 'default')
      || (binding.source === 'ofetch' && binding.imported === '$fetch')
    );
    if (!trustedCallable) return null;
    if (binding.source === 'axios' && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
      const targetNode = objectProperty(node.arguments[0], 'url', environment);
      return targetNode ? {
        targetNode,
        method: methodFromOptions(node.arguments[0], environment),
        operation: 'axios',
        queryNode: objectProperty(node.arguments[0], 'params', environment),
      } : null;
    }
    const options = node.arguments[1];
    const queryProperty = binding.source === 'ofetch' ? 'query'
      : ['got', 'ky'].includes(binding.source) ? 'searchParams' : null;
    return {
      targetNode: node.arguments[0],
      method: methodFromOptions(options, environment),
      operation: binding.source,
      queryNode: queryProperty ? objectProperty(options, queryProperty, environment)
        ?? (binding.source === 'ofetch' ? objectProperty(options, 'params', environment) : null) : null,
    };
  }
  if (!ts.isPropertyAccessExpression(expression)) return null;
  const verb = expression.name.text.toLowerCase();
  if ((verb === 'get' || verb === 'post') && ts.isIdentifier(expression.expression)) {
    const binding = resolveBinding(expression.expression, context);
    if (binding.kind === 'import' && ['axios', 'got', 'ky'].includes(binding.source)
      && binding.imported === 'default') {
      const options = binding.source === 'axios'
        ? node.arguments[verb === 'post' ? 2 : 1]
        : node.arguments[1];
      return {
        targetNode: node.arguments[0],
        method: verb.toUpperCase(),
        operation: `${binding.source}.${verb}`,
        queryNode: objectProperty(options, binding.source === 'axios' ? 'params' : 'searchParams', environment),
      };
    }
  }
  if (verb === 'fetch' && ts.isIdentifier(expression.expression)
    && ['window', 'globalThis'].includes(expression.expression.text)
    && resolveBinding(expression.expression, context).kind === 'global') {
    return { targetNode: node.arguments[0], method: methodFromOptions(node.arguments[1], environment), operation: 'fetch' };
  }
  return null;
}

function expressionCandidates(node, environment) {
  if (!node) return [];
  const candidates = [];
  const evaluated = evaluateExpression(node, environment);
  if (evaluated && evaluated !== '*') candidates.push(evaluated);
  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property)) candidates.push(...expressionCandidates(property.initializer, environment));
    }
  }
  return candidates;
}

function governedLiteralAllows(relativePath, node, source) {
  if (!DENIAL_TESTS.has(relativePath)) return false;
  for (let current = node.parent; current && current !== source; current = current.parent) {
    if (ts.isNewExpression(current) && callName(current.expression) === 'Request') {
      const target = evaluateExpression(current.arguments?.[0], {
        values: new Map(), urls: new Map(), params: new Map(), arrays: new Map(), objects: new Map(),
      });
      return Boolean(target && denialTestAllows(relativePath, target, 'Request', current));
    }
  }
  return false;
}

function jestPostAssertionMethod(node, environment) {
  return ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === 'toHaveBeenCalledWith'
    ? provenJsonPostMethod(node.arguments[1], environment)
    : null;
}

function enclosedByTransportCandidate(node, source) {
  for (let current = node.parent; current && current !== source; current = current.parent) {
    if (ts.isCallExpression(current)) return callName(current.expression) !== 'write';
    if (ts.isNewExpression(current)) return true;
    if (ts.isStatement(current)) return false;
  }
  return false;
}

function parseJavaScriptSource(sourceText, relativePath) {
  const extension = path.extname(relativePath).toLowerCase();
  const kind = extension === '.tsx' || extension === '.jsx'
    ? ts.ScriptKind.TSX
    : ['.ts', '.mts', '.cts'].includes(extension) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const parseable = sourceText.replace(/^\s*#!([^\r\n]*)$/gm, '// shebang$1');
  const source = ts.createSourceFile(relativePath, parseable, ts.ScriptTarget.Latest, true, kind);
  if (source.parseDiagnostics.length > 0) throw new LegacySearchScanError('SOURCE_PARSE_FAILED');
  return source;
}

function scanJavaScript(sourceText, relativePath) {
  const source = parseJavaScriptSource(sourceText, relativePath);
  const bindingContext = { source, moduleBindings: collectModuleBindings(source) };
  const environment = { values: new Map(), urls: new Map(), params: new Map(), arrays: new Map(), objects: new Map() };
  const findings = [];

  function addFinding(node, target, method, operation) {
    let reason = classifyTransport(target, method);
    if (!reason || denialTestAllows(relativePath, target, operation, node)) return;
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const normalized = normalizeTransportText(target);
    if (method !== 'POST' && (
      /\/api\/quotes\/leads\/search(?:\?|\*)[^#]*\bq=/i.test(normalized)
      || /\/api\/assistante\/students(?:\?|\*)[^#]*\bsearch=/i.test(normalized)
    )) reason = `${reason}_QUERY_PII`;
    findings.push({ reason, line });
  }

  function registerVariable(node) {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
    const identifier = node.name.text;
    if (ts.isArrayLiteralExpression(node.initializer)) {
      environment.arrays.set(identifier, node.initializer.elements.map((item) => evaluateExpression(item, environment) ?? '*'));
    }
    if (ts.isObjectLiteralExpression(node.initializer)) environment.objects.set(identifier, node.initializer);
    const value = evaluateExpression(node.initializer, environment);
    if (value != null && value !== '*') environment.values.set(identifier, value);
    if (!ts.isNewExpression(node.initializer) || !ts.isIdentifier(node.initializer.expression)) return;
    if (node.initializer.expression.text === 'URL') {
      if (resolveBinding(node.initializer.expression, bindingContext).kind === 'global') {
        environment.urls.set(identifier, { base: value ?? '*', keys: new Set() });
      }
      return;
    }
    if (node.initializer.expression.text !== 'URLSearchParams') return;
    const keys = new Set();
    const argument = node.initializer.arguments?.[0];
    if (argument && ts.isObjectLiteralExpression(argument)) {
      for (const property of argument.properties) {
        if (ts.isPropertyAssignment(property)) {
          const key = propertyName(property);
          if (key) keys.add(key);
        }
      }
    } else if (argument && ts.isArrayLiteralExpression(argument)) {
      for (const item of argument.elements) {
        if (!ts.isArrayLiteralExpression(item)) continue;
        const key = evaluateExpression(item.elements[0], environment);
        if (key) keys.add(key);
      }
    } else {
      const initial = evaluateExpression(argument, environment) ?? '';
      for (const match of initial.matchAll(/(?:^|[?&])([^=&*]+)=/g)) keys.add(match[1]);
    }
    environment.params.set(identifier, keys);
  }

  function registerQueryMutation(node) {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    if (!['set', 'append'].includes(node.expression.name.text)) return;
    const key = evaluateExpression(node.arguments[0], environment);
    const owner = node.expression.expression;
    if (key && ts.isPropertyAccessExpression(owner) && owner.name.text === 'searchParams' && ts.isIdentifier(owner.expression)) {
      environment.urls.get(owner.expression.text)?.keys.add(key);
    } else if (key && ts.isIdentifier(owner)) environment.params.get(owner.text)?.add(key);
  }

  function visit(node) {
    registerVariable(node);
    registerQueryMutation(node);
    if (ts.isCallExpression(node)) {
      const transport = transportCall(node, environment, bindingContext);
      if (transport?.targetNode) {
        let target = evaluateExpression(transport.targetNode, environment);
        if (target && transport.queryNode) target = appendQueryKeys(target, queryKeysFromNode(transport.queryNode, environment));
        if (target) addFinding(node, target, transport.method, transport.operation);
      } else {
        for (const argument of node.arguments) {
          for (const target of expressionCandidates(argument, environment)) {
            if (!legacyTarget(target)) continue;
            const method = argument === node.arguments[0] ? jestPostAssertionMethod(node, environment) : null;
            addFinding(node, target, method, 'unknown-call');
          }
        }
      }
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'open') {
        const method = evaluateExpression(node.arguments[0], environment);
        const target = evaluateExpression(node.arguments[1], environment);
        if (target) addFinding(node, target, method, 'open');
      }
    }
    const nativeRequest = ts.isNewExpression(node) && ts.isIdentifier(node.expression)
      && node.expression.text === 'Request' && resolveBinding(node.expression, bindingContext).kind === 'global';
    const nextRequest = ts.isNewExpression(node) && ts.isIdentifier(node.expression)
      && exactImport(node.expression, bindingContext, 'next/server', 'NextRequest');
    if (nativeRequest || nextRequest) {
      const target = evaluateExpression(node.arguments?.[0], environment);
      if (target) addFinding(node, target, methodFromOptions(node.arguments?.[1], environment), 'Request');
    } else if (ts.isNewExpression(node)) {
      const constructor = callName(node.expression);
      const globalUrl = ts.isIdentifier(node.expression) && constructor === 'URL'
        && resolveBinding(node.expression, bindingContext).kind === 'global';
      if (globalUrl) {
        ts.forEachChild(node, visit);
        return;
      }
      if (constructor && ['Set', 'Map', 'Array'].includes(constructor)) {
        ts.forEachChild(node, visit);
        return;
      }
      for (const argument of node.arguments ?? []) {
        for (const target of expressionCandidates(argument, environment)) {
          if (!legacyTarget(target)) continue;
          const method = constructor === 'URL' ? 'UNKNOWN' : null;
          addFinding(node, target, method, 'unknown-constructor');
        }
      }
    }
    if (ts.isStringLiteralLike(node)) {
      const target = normalizeTransportText(node.text);
      if (legacyTarget(target)?.hasForbiddenQuery
        && !enclosedByTransportCandidate(node, source)
        && !governedLiteralAllows(relativePath, node, source)) {
        addFinding(node, target, null, 'literal');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}

function exportedGet(source) {
  return source.statements.find((statement) => ts.isFunctionDeclaration(statement)
    && statement.name?.text === 'GET'
    && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function literalObjectProperty(object, name) {
  if (!object || !ts.isObjectLiteralExpression(object)) return null;
  const property = object.properties.find((candidate) => ts.isPropertyAssignment(candidate) && propertyName(candidate) === name);
  return property && ts.isPropertyAssignment(property) ? property.initializer : null;
}

function trustedResponseOwner(owner, context) {
  if (!ts.isIdentifier(owner)) return false;
  if (owner.text === 'Response') return resolveBinding(owner, context).kind === 'global';
  return owner.text === 'NextResponse' && exactImport(owner, context, 'next/server', 'NextResponse');
}

function retiredResponseDescriptor(expression, context) {
  if (!expression || !ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression)) return null;
  if (expression.expression.name.text !== 'json') return null;
  const responseOwner = expression.expression.expression;
  if (!trustedResponseOwner(responseOwner, context)) return null;
  const body = expression.arguments[0];
  const options = expression.arguments[1];
  if (!body || !ts.isObjectLiteralExpression(body) || body.properties.length !== 1) return null;
  const error = literalObjectProperty(body, 'error');
  const status = literalObjectProperty(options, 'status');
  const headers = literalObjectProperty(options, 'headers');
  const cacheControl = literalObjectProperty(headers, 'Cache-Control') ?? literalObjectProperty(headers, 'cache-control');
  return {
    error: error && ts.isStringLiteralLike(error) ? error.text : null,
    status: status && ts.isNumericLiteral(status) ? Number(status.text) : null,
    noStore: Boolean(cacheControl && ts.isStringLiteralLike(cacheControl) && /(?:^|[,\s])no-store(?:[,\s]|$)/i.test(cacheControl.text)),
  };
}

function exactRetiredReturn(statement, expectedCode, context) {
  if (!statement || !ts.isReturnStatement(statement)) return false;
  const response = retiredResponseDescriptor(statement.expression, context);
  return response?.error === expectedCode && response.status === 405 && response.noStore;
}

function validateLeadRetiredRoute(source) {
  const context = { source, moduleBindings: collectModuleBindings(source) };
  const get = exportedGet(source);
  return Boolean(get?.body
    && get.body.statements.length === 1
    && exactRetiredReturn(get.body.statements[0], 'METHOD_NOT_ALLOWED', context));
}

function bindingDerivesSearchParams(statement, requestName, context) {
  if (!ts.isVariableStatement(statement)) return false;
  return statement.declarationList.declarations.some((declaration) => {
    if (!ts.isObjectBindingPattern(declaration.name) || !declaration.initializer || !ts.isNewExpression(declaration.initializer)) return false;
    const hasSearchParams = declaration.name.elements.some((element) => element.name.getText() === 'searchParams');
    const constructorIsUrl = ts.isIdentifier(declaration.initializer.expression)
      && declaration.initializer.expression.text === 'URL'
      && resolveBinding(declaration.initializer.expression, context).kind === 'global';
    const requestUrl = declaration.initializer.arguments?.[0];
    return hasSearchParams && constructorIsUrl && Boolean(requestUrl
      && ts.isPropertyAccessExpression(requestUrl)
      && ts.isIdentifier(requestUrl.expression)
      && requestUrl.expression.text === requestName
      && requestUrl.name.text === 'url');
  });
}

function returnedHttpStatus(expression, context) {
  if (!expression) return null;
  if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)
    && expression.expression.name.text === 'json'
    && trustedResponseOwner(expression.expression.expression, context)) {
    const options = expression.arguments[1];
    const status = literalObjectProperty(options, 'status');
    if (!status) return 200;
    return ts.isNumericLiteral(status) ? Number(status.text) : null;
  }
  if (ts.isNewExpression(expression) && ts.isIdentifier(expression.expression)
    && expression.expression.text === 'Response'
    && resolveBinding(expression.expression, context).kind === 'global') {
    const options = expression.arguments?.[1];
    const status = literalObjectProperty(options, 'status');
    if (!status) return 200;
    return ts.isNumericLiteral(status) ? Number(status.text) : null;
  }
  return null;
}

function containsSuccessReturn(node, context) {
  let success = false;
  function visit(current) {
    if (success) return;
    if (current !== node && (ts.isFunctionDeclaration(current) || isFunctionLike(current))) return;
    if (ts.isReturnStatement(current)) {
      const status = returnedHttpStatus(current.expression, context);
      if (status != null && status >= 200 && status < 300) success = true;
      return;
    }
    ts.forEachChild(current, visit);
  }
  visit(node);
  return success;
}

function referencesSearchParameter(node) {
  let found = false;
  function ownerReferencesSearchParams(owner) {
    if (ts.isIdentifier(owner)) return owner.text === 'searchParams';
    if (ts.isPropertyAccessExpression(owner)) {
      return owner.name.text === 'searchParams' || ownerReferencesSearchParams(owner.expression);
    }
    return false;
  }
  function visit(current) {
    if (found) return;
    if (current !== node && (ts.isFunctionDeclaration(current) || isFunctionLike(current))) return;
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)
      && ['get', 'has', 'getAll'].includes(current.expression.name.text)
      && ownerReferencesSearchParams(current.expression.expression)) {
      const key = current.arguments[0];
      if (key && ts.isStringLiteralLike(key) && key.text === 'search') {
        found = true;
        return;
      }
    }
    ts.forEachChild(current, visit);
  }
  visit(node);
  return found;
}

function unwrapExpression(expression) {
  let current = expression;
  while (current && (ts.isAwaitExpression(current) || ts.isParenthesizedExpression(current))) current = current.expression;
  return current;
}

function exactRbacErrorGuard(statement, context) {
  if (!ts.isIfStatement(statement) || statement.elseStatement) return false;
  const condition = statement.expression;
  if (!ts.isCallExpression(condition) || !ts.isIdentifier(condition.expression)
    || !exactImport(condition.expression, context, '@/lib/guards', 'isErrorResponse')) return false;
  const guarded = condition.arguments[0];
  if (!guarded || !ts.isIdentifier(guarded)) return false;
  const returned = ts.isBlock(statement.thenStatement)
    ? statement.thenStatement.statements.length === 1 ? statement.thenStatement.statements[0] : null
    : statement.thenStatement;
  if (!(returned && ts.isReturnStatement(returned)
    && returned.expression && ts.isIdentifier(returned.expression)
    && returned.expression.text === guarded.text)) return false;
  const block = statement.parent;
  if (!ts.isBlock(block)) return false;
  const guardIndex = block.statements.findIndex((candidate) => candidate === statement);
  return block.statements.slice(0, guardIndex).some((candidate) => {
    if (!ts.isVariableStatement(candidate)) return false;
    return candidate.declarationList.declarations.some((declaration) => {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== guarded.text) return false;
      const initializer = unwrapExpression(declaration.initializer);
      return Boolean(initializer && ts.isCallExpression(initializer)
        && ts.isIdentifier(initializer.expression)
        && exactImport(initializer.expression, context, '@/lib/guards', 'requireAnyRole')
        && exactStaffRoleArgument(initializer));
    });
  });
}

function exactStaffRoleArgument(call) {
  if (call.arguments.length !== 1 || !ts.isArrayLiteralExpression(call.arguments[0])) return false;
  const roles = call.arguments[0].elements.map((element) => ts.isStringLiteralLike(element) ? element.text : null);
  if (roles.some((role) => role == null)) return false;
  const unique = new Set(roles);
  return roles.length === 2 && unique.size === 2 && unique.has('ADMIN') && unique.has('ASSISTANTE');
}

function precedingGuardIsFailClosed(statement, context) {
  if (ts.isReturnStatement(statement)) return false;
  const returns = [];
  function visit(node) {
    if (node !== statement && (ts.isFunctionDeclaration(node) || isFunctionLike(node))) return;
    if (ts.isReturnStatement(node)) returns.push(node);
    else ts.forEachChild(node, visit);
  }
  visit(statement);
  if (returns.length === 0) return true;
  if (exactRbacErrorGuard(statement, context)) return true;
  return returns.every((returned) => {
    const status = returnedHttpStatus(returned.expression, context);
    return status != null && status >= 400;
  });
}

function studentSearchDenial(ifStatement, containingBlock, requestName, context) {
  if (ifStatement.elseStatement) return false;
  const condition = ifStatement.expression;
  if (!ts.isCallExpression(condition) || !ts.isPropertyAccessExpression(condition.expression)) return false;
  if (condition.expression.name.text !== 'has' || !ts.isIdentifier(condition.expression.expression)
    || condition.expression.expression.text !== 'searchParams') return false;
  const key = condition.arguments[0];
  if (!key || !ts.isStringLiteralLike(key) || key.text !== 'search') return false;
  const denial = ts.isBlock(ifStatement.thenStatement)
    ? ifStatement.thenStatement.statements.length === 1 ? ifStatement.thenStatement.statements[0] : null
    : ifStatement.thenStatement;
  if (!exactRetiredReturn(denial, 'SEARCH_REQUIRES_POST', context)) return false;
  const index = containingBlock.statements.findIndex((statement) => statement === ifStatement);
  if (index <= 0 || index >= containingBlock.statements.length - 1) return false;
  const derivationIndex = index - 1;
  if (!bindingDerivesSearchParams(containingBlock.statements[derivationIndex], requestName, context)) return false;
  const preceding = containingBlock.statements.slice(0, derivationIndex);
  if (!preceding.every((statement) => precedingGuardIsFailClosed(statement, context))) return false;
  const following = containingBlock.statements.slice(index + 1);
  if (following.some((statement) => referencesSearchParameter(statement) && containsSuccessReturn(statement, context))) return false;
  return true;
}

function validateStudentRetiredRoute(source) {
  const context = { source, moduleBindings: collectModuleBindings(source) };
  const get = exportedGet(source);
  const parameter = get?.parameters[0]?.name;
  if (!get?.body || !parameter || !ts.isIdentifier(parameter)) return false;
  if (get.body.statements.length !== 1 || !ts.isTryStatement(get.body.statements[0])) return false;
  const governedTry = get.body.statements[0];
  if (!governedTry.catchClause || governedTry.finallyBlock) return false;
  let catchValid = true;
  function inspectCatch(node) {
    if (!catchValid) return;
    if (node !== governedTry.catchClause?.block && (ts.isFunctionDeclaration(node) || isFunctionLike(node))) return;
    if (ts.isReturnStatement(node)) {
      const status = returnedHttpStatus(node.expression, context);
      if (status == null || status < 400) catchValid = false;
      return;
    }
    ts.forEachChild(node, inspectCatch);
  }
  inspectCatch(governedTry.catchClause.block);
  if (!catchValid) return false;
  return governedTry.tryBlock.statements.some((statement) => ts.isIfStatement(statement)
    && studentSearchDenial(statement, governedTry.tryBlock, parameter.text, context));
}

function validateDenialTest(source, policy) {
  const environment = { values: new Map(), urls: new Map(), params: new Map(), arrays: new Map(), objects: new Map() };
  let valid = false;
  function visit(node) {
    if (valid) return;
    if (ts.isNewExpression(node) && callName(node.expression) === 'Request') {
      const target = evaluateExpression(node.arguments?.[0], environment);
      if (target && normalizeTransportText(target).includes(`${policy.endpoint}?${policy.parameter}=`)
        && denialTestAllows(policy.relativePath, target, 'Request', node)) valid = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return valid;
}

function governedSemanticFindings(root, files) {
  const byRelativePath = new Map(files.map((file) => [path.relative(root, file).split(path.sep).join('/'), file]));
  const findings = [];
  const routes = [
    ['app/api/assistante/students/route.ts', 'GOVERNED_STUDENT_ROUTE_INVALID', validateStudentRetiredRoute],
    ['app/api/quotes/leads/search/route.ts', 'GOVERNED_LEAD_ROUTE_INVALID', validateLeadRetiredRoute],
  ];
  for (const [relativePath, invalidReason, validator] of routes) {
    const file = byRelativePath.get(relativePath);
    if (!file) findings.push({ reason: 'GOVERNED_ROUTE_MISSING', line: 0, relativePath });
    else {
      const source = parseJavaScriptSource(readFileSync(file, 'utf8'), relativePath);
      if (!validator(source)) findings.push({ reason: invalidReason, line: 0, relativePath });
    }
  }
  for (const [relativePath, basePolicy] of DENIAL_TESTS) {
    const file = byRelativePath.get(relativePath);
    if (!file) findings.push({ reason: 'GOVERNED_DENIAL_TEST_MISSING', line: 0, relativePath });
    else {
      const source = parseJavaScriptSource(readFileSync(file, 'utf8'), relativePath);
      if (!validateDenialTest(source, { ...basePolicy, relativePath })) {
        findings.push({ reason: 'GOVERNED_DENIAL_TEST_INVALID', line: 0, relativePath });
      }
    }
  }
  return findings;
}

const EXECUTABLE_TARGET_SOURCE = String.raw`\/api\/(?:quotes\/leads\/search|assistante\/students)(?:\/)?(?:\?[^\s'\"\x60)]+)?`;

function executableTargets(text) {
  const matches = [];
  for (const match of normalizeTransportText(text).matchAll(new RegExp(EXECUTABLE_TARGET_SOURCE, 'gi'))) {
    // Documentation may name an implementation file such as app/api/.../route.ts.
    // That is not a network endpoint and must not acquire transport semantics.
    if (match.index >= 3 && text.slice(match.index - 3, match.index) === 'app') continue;
    matches.push(match[0]);
  }
  return matches;
}

function stripExecutableQuote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith("'") && trimmed.endsWith("'"))
    || (trimmed.startsWith('"') && trimmed.endsWith('"')))) return trimmed.slice(1, -1);
  return trimmed;
}

function scanShellExecutable(normalized) {
  const findings = [];
  const constantsByName = new Map();
  const consumed = new Set();
  const expand = (value) => value.replace(/\$\{([A-Za-z_]\w*)\}|\$([A-Za-z_]\w*)/g,
    (_match, braced, plain) => constantsByName.get(braced ?? plain) ?? '*');
  const commands = normalized.replace(/\\\r?\n/g, ' ').split(/\r?\n|;|&&|\|\||(?<!\|)\|(?!\|)/);
  for (const rawCommand of commands) {
    const command = rawCommand.trim();
    if (!command) continue;
    const assignment = command.match(/^(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.+)$/s);
    if (assignment && !/\s(?:curl|wget)\b/i.test(command)) {
      constantsByName.set(assignment[1], expand(stripExecutableQuote(assignment[2])));
      continue;
    }
    const referenced = [...command.matchAll(/\$\{([A-Za-z_]\w*)\}|\$([A-Za-z_]\w*)/g)]
      .map((match) => match[1] ?? match[2]);
    const expanded = expand(command);
    const isCurl = /^\s*(?:command\s+)?curl\b/i.test(expanded);
    const explicitPost = isCurl && /(?:-X|--request(?:=|\s+))\s*['\"]?POST\b/i.test(expanded);
    const explicitGet = isCurl && /(?:^|\s)(?:-G|--get)(?:\s|$)/i.test(expanded);
    const queryKeys = new Set();
    if (explicitGet) {
      const dataArguments = /(?:^|\s)(?:--data-urlencode|-d|--data(?:-raw|-binary)?)(?:=|\s+)['\"]?([^'\"\s]+)/gi;
      for (const match of expanded.matchAll(dataArguments)) {
        const key = match[1].split('=', 1)[0];
        if (key) queryKeys.add(key);
      }
    }
    for (const target of executableTargets(expanded)) {
      for (const name of referenced) consumed.add(name);
      const composedTarget = appendQueryKeys(target, queryKeys);
      const reason = classifyTransport(composedTarget, explicitGet ? 'GET' : explicitPost ? 'POST' : null);
      if (reason) findings.push({ reason, line: 1 });
    }
  }
  for (const [name, value] of constantsByName) {
    if (consumed.has(name)) continue;
    for (const target of executableTargets(value)) {
      const reason = classifyTransport(target, null);
      if (reason) findings.push({ reason, line: 1 });
    }
  }
  return findings;
}

function evaluatePythonConstant(expression, constantsByName) {
  const parts = expression.trim().split(/\s*\+\s*/);
  let value = '';
  for (const part of parts) {
    const token = part.trim();
    if (/^(['"])[\s\S]*\1$/.test(token)) value += stripExecutableQuote(token);
    else if (/^[A-Za-z_]\w*$/.test(token) && constantsByName.has(token)) value += constantsByName.get(token);
    else return null;
  }
  return value;
}

function scanPythonExecutable(normalized) {
  const findings = [];
  const constantsByName = new Map();
  const parameterKeysByName = new Map();
  const consumed = new Set();
  for (const line of normalized.split(/\r?\n/)) {
    const assignment = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.+?)\s*$/);
    if (!assignment) continue;
    const dictionary = assignment[2].match(/^\{([\s\S]*)\}$/);
    if (dictionary) {
      const keys = new Set([...dictionary[1].matchAll(/(?:^|,)\s*['\"]([^'\"]+)['\"]\s*:/g)].map((match) => match[1]));
      parameterKeysByName.set(assignment[1], keys);
      continue;
    }
    const value = evaluatePythonConstant(assignment[2], constantsByName);
    if (value != null) constantsByName.set(assignment[1], value);
  }
  const calls = /\b(?:(requests?|httpx)\.(get|post)|urllib\.request\.urlopen)\s*\(\s*((?:['"][^'\"]*['"])|(?:[A-Za-z_]\w*))([^)]*)\)/gi;
  for (const match of normalized.matchAll(calls)) {
    const argument = match[3];
    const identifier = /^[A-Za-z_]\w*$/.test(argument) ? argument : null;
    const targetValue = identifier ? constantsByName.get(identifier) : stripExecutableQuote(argument);
    if (identifier) consumed.add(identifier);
    if (!targetValue) continue;
    const queryKeys = new Set();
    const paramsArgument = match[4]?.match(/(?:^|,)\s*params\s*=\s*(\{[^}]*\}|[A-Za-z_]\w*)/);
    if (paramsArgument) {
      if (paramsArgument[1].startsWith('{')) {
        for (const keyMatch of paramsArgument[1].matchAll(/(?:^|\{|,)\s*['\"]([^'\"]+)['\"]\s*:/g)) queryKeys.add(keyMatch[1]);
      } else {
        for (const key of parameterKeysByName.get(paramsArgument[1]) ?? []) queryKeys.add(key);
      }
    }
    for (const target of executableTargets(targetValue)) {
      const method = match[2]?.toUpperCase() === 'POST' ? 'POST' : null;
      const reason = classifyTransport(appendQueryKeys(target, queryKeys), method);
      if (reason) findings.push({ reason, line: 1 });
    }
  }
  for (const [name, value] of constantsByName) {
    if (consumed.has(name)) continue;
    for (const target of executableTargets(value)) {
      const reason = classifyTransport(target, null);
      if (reason) findings.push({ reason, line: 1 });
    }
  }
  return findings;
}

function scanExecutableText(sourceText, language = 'text') {
  const normalized = normalizeTransportText(sourceText);
  if (['py', 'python', '.py'].includes(language)) return scanPythonExecutable(normalized);
  return scanShellExecutable(normalized);
}

function executableFences(markdown) {
  const blocks = [];
  for (const match of markdown.matchAll(/```([^\s`]*)[^\n]*\n([\s\S]*?)```/g)) {
    const language = match[1].toLowerCase();
    if (EXECUTABLE_FENCE_LANGUAGES.has(language)) blocks.push({ language, content: match[2] });
  }
  return blocks;
}

function canonicalRoot(root, mode) {
  const absolute = path.resolve(root);
  if (!existsSync(absolute)) throw new LegacySearchScanError('SCAN_ROOT_MISSING');
  if (!lstatSync(absolute).isDirectory()) throw new LegacySearchScanError('SCAN_ROOT_NOT_DIRECTORY');
  let canonical;
  try { canonical = realpathSync(absolute); } catch { throw new LegacySearchScanError('SCAN_ROOT_UNREADABLE'); }
  if (mode === 'source' && existsSync(path.join(canonical, 'package.json'))) {
    let repositoryRoot;
    try {
      repositoryRoot = realpathSync(execFileSync('git', ['-C', canonical, 'rev-parse', '--show-toplevel'], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim());
    } catch {
      throw new LegacySearchScanError('SCAN_ROOT_NOT_REPOSITORY_ROOT');
    }
    if (repositoryRoot !== canonical) throw new LegacySearchScanError('SCAN_ROOT_NOT_REPOSITORY_ROOT');
  }
  return canonical;
}

function listFiles(root, mode) {
  const files = [];
  const excluded = mode === 'source' ? SOURCE_EXCLUDED_DIRECTORIES : ARTIFACT_EXCLUDED_DIRECTORIES;
  const extensions = mode === 'source' ? SOURCE_EXTENSIONS : ARTIFACT_EXTENSIONS;
  function walk(directory) {
    let entries;
    try {
      accessSync(directory, constants.R_OK);
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      throw new LegacySearchScanError('SCAN_ROOT_UNREADABLE');
    }
    for (const entry of entries) {
      if (entry.isDirectory() && excluded.has(entry.name)) continue;
      const full = path.join(directory, entry.name);
      let stats;
      try { stats = lstatSync(full); } catch { throw new LegacySearchScanError('SCAN_ROOT_UNREADABLE'); }
      if (stats.isSymbolicLink()) throw new LegacySearchScanError('SCAN_SYMLINK_UNSUPPORTED');
      if (stats.isDirectory()) walk(full);
      else if (stats.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) files.push(full);
    }
  }
  walk(root);
  return files;
}

export function scanLegacySearchConsumers({ root, mode }) {
  if (mode !== 'source' && mode !== 'artifact') throw new LegacySearchScanError('SCAN_MODE_INVALID');
  const absoluteRoot = canonicalRoot(root, mode);
  const files = listFiles(absoluteRoot, mode);
  if (files.length === 0) throw new LegacySearchScanError('SCAN_ROOT_EMPTY');
  const violations = mode === 'source' ? governedSemanticFindings(absoluteRoot, files) : [];
  for (const file of files) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { throw new LegacySearchScanError('SCAN_ROOT_UNREADABLE'); }
    const relativePath = path.relative(absoluteRoot, file).split(path.sep).join('/');
    let findings = [];
    const extension = path.extname(file).toLowerCase();
    if (extension === '.md' || extension === '.mdx') {
      for (const block of executableFences(content)) {
        if (['sh', 'bash', 'shell', 'zsh', 'py', 'python'].includes(block.language)) findings.push(...scanExecutableText(block.content, block.language));
        else {
          try { findings.push(...scanJavaScript(block.content, relativePath)); }
          catch (error) {
            if (!(error instanceof LegacySearchScanError) || error.code !== 'SOURCE_PARSE_FAILED') throw error;
            findings.push(...scanExecutableText(block.content, block.language));
          }
        }
      }
    } else if (JAVASCRIPT_EXTENSIONS.has(extension)) findings = scanJavaScript(content, relativePath);
    else findings = scanExecutableText(content, extension);
    for (const finding of findings) violations.push({ ...finding, relativePath });
  }
  const unique = [...new Map(violations.map((finding) => [`${finding.relativePath}:${finding.line}:${finding.reason}`, finding])).values()];
  return { root: absoluteRoot, mode, filesScanned: files.length, violations: unique };
}

function parseCli(argv) {
  let mode = null;
  let root = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if ((argument !== '--source-root' && argument !== '--artifact-root') || mode !== null || index + 1 >= argv.length) {
      throw new LegacySearchScanError('ARGUMENT_INVALID');
    }
    mode = argument === '--source-root' ? 'source' : 'artifact';
    root = argv[index + 1];
    index += 1;
  }
  if (mode === null || root === null) throw new LegacySearchScanError('ARGUMENT_INVALID');
  return { mode, root };
}

function runCli() {
  try {
    const report = scanLegacySearchConsumers(parseCli(process.argv.slice(2)));
    const findings = report.violations.map(({ relativePath, line, reason }) => ({
      reason,
      locatorDigest: createHash('sha256').update(`${relativePath}:${line}`).digest('hex').slice(0, 16),
    }));
    console.log(JSON.stringify({ pass: findings.length === 0, mode: report.mode, filesScanned: report.filesScanned, findings }, null, 2));
    console.log(`LEGACY_GET_SEARCH_CONSUMERS=${findings.length}`);
    process.exitCode = findings.length === 0 ? 0 : 1;
  } catch (error) {
    console.error(error instanceof LegacySearchScanError ? error.code : 'SCAN_FAILED');
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
