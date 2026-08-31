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
  const leadPath = '/api/quotes/leads/search';
  const studentPath = '/api/assistante/students';
  const isLead = target.includes(leadPath) && !target.includes(`${leadPath}/`);
  const isStudent = target.includes(studentPath) && !target.includes(`${studentPath}/`);
  if (!isLead && !isStudent) return null;
  const suffix = target.slice(target.indexOf(isLead ? leadPath : studentPath) + (isLead ? leadPath : studentPath).length);
  const hasForbiddenQuery = isLead
    ? /(?:[?&*])q(?:=|\*)/i.test(suffix)
    : /(?:[?&*])search(?:=|\*)/i.test(suffix);
  if (method === 'POST') return hasForbiddenQuery ? 'QUERY_PII' : null;
  if (method === 'GET') {
    if (isStudent && !hasForbiddenQuery) return null;
    return methodValue == null ? 'DEFAULT_GET' : 'EXPLICIT_GET';
  }
  return 'AMBIGUOUS_METHOD';
}

function appendQueryKeys(base, keys) {
  if (keys.size === 0) return base;
  return `${base}${base.includes('?') ? '&' : '?'}${[...keys].map((key) => `${key}=*`).join('&')}`;
}

function propertyName(property) {
  return ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name) ? property.name.text : null;
}

function objectProperty(node, name, environment) {
  const object = ts.isIdentifier(node) ? environment.objects.get(node.text) : node;
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
    if (node.expression.text === 'URLSearchParams') return evaluateExpression(node.arguments?.[0], environment) ?? '';
  }
  return null;
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

function callName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return null;
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

function transportCall(node, environment) {
  const expression = node.expression;
  if (ts.isIdentifier(expression) && ['fetch', '$fetch', 'axios', 'got', 'ky'].includes(expression.text)) {
    if (expression.text === 'axios' && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
      const targetNode = objectProperty(node.arguments[0], 'url', environment);
      return targetNode ? { targetNode, method: methodFromOptions(node.arguments[0], environment), operation: 'axios' } : null;
    }
    return { targetNode: node.arguments[0], method: methodFromOptions(node.arguments[1], environment), operation: expression.text };
  }
  if (!ts.isPropertyAccessExpression(expression)) return null;
  const verb = expression.name.text.toLowerCase();
  if (verb === 'get' || verb === 'post') return { targetNode: node.arguments[0], method: verb.toUpperCase(), operation: verb };
  if (verb === 'fetch') return { targetNode: node.arguments[0], method: methodFromOptions(node.arguments[1], environment), operation: 'fetch' };
  return null;
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
      environment.urls.set(identifier, { base: value ?? '*', keys: new Set() });
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
      const transport = transportCall(node, environment);
      if (transport?.targetNode) {
        const target = evaluateExpression(transport.targetNode, environment);
        if (target) addFinding(node, target, transport.method, transport.operation);
      }
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'open') {
        const method = evaluateExpression(node.arguments[0], environment);
        const target = evaluateExpression(node.arguments[1], environment);
        if (target) addFinding(node, target, method, 'open');
      }
    }
    if (ts.isNewExpression(node) && callName(node.expression) === 'Request') {
      const target = evaluateExpression(node.arguments?.[0], environment);
      if (target) addFinding(node, target, methodFromOptions(node.arguments?.[1], environment), 'Request');
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

function retiredResponseDescriptor(expression) {
  if (!expression || !ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression)) return null;
  if (expression.expression.name.text !== 'json') return null;
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

function exactRetiredReturn(statement, expectedCode) {
  if (!statement || !ts.isReturnStatement(statement)) return false;
  const response = retiredResponseDescriptor(statement.expression);
  return response?.error === expectedCode && response.status === 405 && response.noStore;
}

function validateLeadRetiredRoute(source) {
  const get = exportedGet(source);
  return Boolean(get?.body
    && get.body.statements.length === 1
    && exactRetiredReturn(get.body.statements[0], 'METHOD_NOT_ALLOWED'));
}

function bindingDerivesSearchParams(statement, requestName) {
  if (!ts.isVariableStatement(statement)) return false;
  return statement.declarationList.declarations.some((declaration) => {
    if (!ts.isObjectBindingPattern(declaration.name) || !declaration.initializer || !ts.isNewExpression(declaration.initializer)) return false;
    const hasSearchParams = declaration.name.elements.some((element) => element.name.getText() === 'searchParams');
    const constructorIsUrl = ts.isIdentifier(declaration.initializer.expression) && declaration.initializer.expression.text === 'URL';
    const requestUrl = declaration.initializer.arguments?.[0];
    return hasSearchParams && constructorIsUrl && Boolean(requestUrl
      && ts.isPropertyAccessExpression(requestUrl)
      && ts.isIdentifier(requestUrl.expression)
      && requestUrl.expression.text === requestName
      && requestUrl.name.text === 'url');
  });
}

function studentSearchDenial(ifStatement, containingBlock, requestName) {
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
  if (!exactRetiredReturn(denial, 'SEARCH_REQUIRES_POST')) return false;
  const index = containingBlock.statements.findIndex((statement) => statement === ifStatement);
  if (index <= 0 || index >= containingBlock.statements.length - 1) return false;
  return containingBlock.statements.slice(0, index).some((statement) => bindingDerivesSearchParams(statement, requestName));
}

function validateStudentRetiredRoute(source) {
  const get = exportedGet(source);
  const parameter = get?.parameters[0]?.name;
  if (!get?.body || !parameter || !ts.isIdentifier(parameter)) return false;
  let valid = false;
  function visitGovernedBlock(block) {
    for (const statement of block.statements) {
      if (ts.isIfStatement(statement) && studentSearchDenial(statement, block, parameter.text)) {
        valid = true;
        return;
      }
      // The production handler has a top-level try/catch. Only that transparent
      // wrapper is traversed; conditional/dead/nested-function decoys are not.
      if (ts.isTryStatement(statement)) visitGovernedBlock(statement.tryBlock);
      if (valid) return;
    }
  }
  visitGovernedBlock(get.body);
  return valid;
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

function scanExecutableText(sourceText) {
  const normalized = normalizeTransportText(sourceText);
  const findings = [];
  for (const match of normalized.matchAll(/(?:curl|wget|fetch|Request|axios|got|ky|\$fetch|requests?\.get)[^\n]{0,300}(\/api\/(?:quotes\/leads\/search|assistante\/students)[^\s'\"`]*)/gi)) {
    const methodMatch = match[0].match(/(?:-X|--request|method\s*[:=])\s*['\"]?(GET|POST)/i);
    const reason = classifyTransport(match[1], methodMatch?.[1] ?? null);
    if (reason) findings.push({ reason, line: normalized.slice(0, match.index).split('\n').length });
  }
  return findings;
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
        if (['sh', 'bash', 'shell', 'zsh', 'py', 'python'].includes(block.language)) findings.push(...scanExecutableText(block.content));
        else {
          try { findings.push(...scanJavaScript(block.content, relativePath)); }
          catch (error) {
            if (!(error instanceof LegacySearchScanError) || error.code !== 'SOURCE_PARSE_FAILED') throw error;
            findings.push(...scanExecutableText(block.content));
          }
        }
      }
    } else if (JAVASCRIPT_EXTENSIONS.has(extension)) findings = scanJavaScript(content, relativePath);
    else findings = scanExecutableText(content);
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
