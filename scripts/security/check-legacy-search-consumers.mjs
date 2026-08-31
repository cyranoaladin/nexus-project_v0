#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { accessSync, constants, existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SOURCE_DIRECTORIES = ['components', 'app', 'lib', 'scripts', 'e2e', '__tests__', 'docs'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sh', '.bash', '.py', '.md']);
const JAVASCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const EXECUTABLE_FENCE_LANGUAGES = new Set(['js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx', 'mjs', 'cjs', 'sh', 'bash', 'shell', 'zsh', 'py', 'python']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', '.next', 'coverage', 'test-results', 'playwright-report']);
const DENIAL_TESTS = new Map([
  ['__tests__/api/assistante.students-search-retired.route.test.ts', {
    endpoint: '/api/assistante/students', parameter: 'search', routeCall: 'GET', error: 'SEARCH_REQUIRES_POST',
  }],
  ['__tests__/api/staff-safe-search-consumers.route.test.ts', {
    endpoint: '/api/quotes/leads/search', parameter: 'q', routeCall: 'retiredLeadGet', error: 'METHOD_NOT_ALLOWED',
  }],
]);
const RETIRED_ROUTES = new Map([
  ['app/api/assistante/students/route.ts', ["searchParams.has('search')", 'SEARCH_REQUIRES_POST', 'status: 405']],
  ['app/api/quotes/leads/search/route.ts', ['export async function GET', 'METHOD_NOT_ALLOWED', 'status: 405']],
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
  const query = target.includes('?') ? target.slice(target.indexOf('?')) : '';
  const hasForbiddenQuery = isLead
    ? /(?:[?&])q(?:=|\*)/i.test(query)
    : /(?:[?&])search(?:=|\*)/i.test(query);
  if (method === 'POST') return hasForbiddenQuery ? 'QUERY_PII' : null;
  if (method === 'GET') {
    if (isStudent && !hasForbiddenQuery) return null;
    return methodValue == null ? 'DEFAULT_GET' : 'EXPLICIT_GET';
  }
  return 'AMBIGUOUS_METHOD';
}

function evaluateExpression(node, environment) {
  if (!node) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isTemplateExpression(node)) return `${node.head.text}${node.templateSpans.map((span) => `*${span.literal.text}`).join('')}`;
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return `${evaluateExpression(node.left, environment) ?? '*'}${evaluateExpression(node.right, environment) ?? '*'}`;
  }
  if (ts.isIdentifier(node)) {
    const url = environment.urls.get(node.text);
    if (url) return appendQueryKeys(url.base, url.keys);
    const params = environment.params.get(node.text);
    if (params) return [...params].map((key, index) => `${index === 0 ? '?' : '&'}${key}=*`).join('');
    const value = environment.values.get(node.text);
    if (value != null) return value;
    return '*';
  }
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === 'toString' && ts.isIdentifier(node.expression.expression)) {
    const params = environment.params.get(node.expression.expression.text);
    if (params) return [...params].map((key, index) => `${index === 0 ? '' : '&'}${key}=*`).join('');
  }
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL') {
    return evaluateExpression(node.arguments?.[0], environment);
  }
  return null;
}

function appendQueryKeys(base, keys) {
  if (keys.size === 0) return base;
  return `${base}${base.includes('?') ? '&' : '?'}${[...keys].map((key) => `${key}=*`).join('&')}`;
}

function methodFromOptions(node, environment) {
  if (!node) return null;
  if (!ts.isObjectLiteralExpression(node)) return 'UNKNOWN';
  const property = node.properties.find((candidate) => ts.isPropertyAssignment(candidate)
    && ((ts.isIdentifier(candidate.name) && candidate.name.text === 'method')
      || (ts.isStringLiteral(candidate.name) && candidate.name.text === 'method')));
  if (!property || !ts.isPropertyAssignment(property)) return null;
  return evaluateExpression(property.initializer, environment);
}

function callName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return null;
}

function denialTestAllows(relativePath, sourceText, target, operation, node) {
  const policy = DENIAL_TESTS.get(relativePath);
  if (!policy || operation !== 'Request') return false;
  const routeInvocation = node.parent;
  return normalizeTransportText(target).includes(`${policy.endpoint}?${policy.parameter}=`)
    && sourceText.includes('expect(response.status).toBe(405)')
    && ts.isCallExpression(routeInvocation)
    && callName(routeInvocation.expression) === policy.routeCall
    && routeInvocation.arguments.some((argument) => argument === node);
}

function scanJavaScript(sourceText, relativePath) {
  const kind = relativePath.endsWith('.tsx') || relativePath.endsWith('.jsx')
    ? ts.ScriptKind.TSX
    : relativePath.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const parseableSourceText = sourceText.replace(/^\s*#!([^\r\n]*)$/gm, '// shebang$1');
  const source = ts.createSourceFile(relativePath, parseableSourceText, ts.ScriptTarget.Latest, true, kind);
  if (source.parseDiagnostics.length > 0) throw new LegacySearchScanError('SOURCE_PARSE_FAILED');
  const environment = { values: new Map(), urls: new Map(), params: new Map() };
  const findings = [];

  function addFinding(node, target, method, operation) {
    let reason = classifyTransport(target, method);
    if (!reason || denialTestAllows(relativePath, sourceText, target, operation, node)) return;
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const normalizedTarget = normalizeTransportText(target);
    if (method !== 'POST' && (
      /\/api\/quotes\/leads\/search\?[^#]*\bq=/i.test(normalizedTarget)
      || /\/api\/assistante\/students\?[^#]*\bsearch=/i.test(normalizedTarget)
    )) reason = `${reason}_QUERY_PII`;
    findings.push({ reason, line });
  }

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const identifier = node.name.text;
      const value = evaluateExpression(node.initializer, environment);
      if (value != null && value !== '*') environment.values.set(identifier, value);
      if (ts.isNewExpression(node.initializer) && ts.isIdentifier(node.initializer.expression)) {
        if (node.initializer.expression.text === 'URL') {
          environment.urls.set(identifier, { base: value ?? '*', keys: new Set() });
        } else if (node.initializer.expression.text === 'URLSearchParams') {
          const keys = new Set();
          const argument = node.initializer.arguments?.[0];
          if (argument && ts.isObjectLiteralExpression(argument)) {
            for (const property of argument.properties) {
              if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) keys.add(property.name.text);
            }
          } else {
            const initial = evaluateExpression(argument, environment) ?? '';
            for (const match of initial.matchAll(/(?:^|[?&])([^=&*]+)=/g)) keys.add(match[1]);
          }
          environment.params.set(identifier, keys);
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'set') {
      const key = evaluateExpression(node.arguments[0], environment);
      const owner = node.expression.expression;
      if (key && ts.isPropertyAccessExpression(owner) && owner.name.text === 'searchParams' && ts.isIdentifier(owner.expression)) {
        environment.urls.get(owner.expression.text)?.keys.add(key);
      } else if (key && ts.isIdentifier(owner)) environment.params.get(owner.text)?.add(key);
    }
    if (ts.isCallExpression(node) && callName(node.expression) === 'fetch') {
      const target = evaluateExpression(node.arguments[0], environment);
      if (target) addFinding(node, target, methodFromOptions(node.arguments[1], environment), 'fetch');
    }
    if (ts.isNewExpression(node) && callName(node.expression) === 'Request') {
      const target = evaluateExpression(node.arguments?.[0], environment);
      if (target) addFinding(node, target, methodFromOptions(node.arguments?.[1], environment), 'Request');
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'open') {
      const method = evaluateExpression(node.arguments[0], environment);
      const target = evaluateExpression(node.arguments[1], environment);
      if (target) addFinding(node, target, method, 'open');
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}

function scanExecutableText(sourceText) {
  const normalized = normalizeTransportText(sourceText);
  const findings = [];
  for (const match of normalized.matchAll(/(?:curl|wget|fetch|Request)[^\n]{0,300}(\/api\/(?:quotes\/leads\/search|assistante\/students)[^\s'"`]*)/gi)) {
    const methodMatch = match[0].match(/(?:-X|--request|method\s*[:=])\s*['"]?(GET|POST)/i);
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

function listFiles(root, mode) {
  const files = [];
  function walk(directory) {
    let entries;
    try {
      accessSync(directory, constants.R_OK);
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      throw new LegacySearchScanError('SCAN_ROOT_UNREADABLE');
    }
    for (const entry of entries) {
      if (SKIPPED_DIRECTORIES.has(entry.name) && !(mode === 'artifact' && entry.name === '.next')) continue;
      const full = path.join(directory, entry.name);
      let stats;
      try { stats = lstatSync(full); } catch { throw new LegacySearchScanError('SCAN_ROOT_UNREADABLE'); }
      if (stats.isSymbolicLink()) throw new LegacySearchScanError('SCAN_SYMLINK_UNSUPPORTED');
      if (stats.isDirectory()) {
        if (mode === 'artifact' && entry.name === 'node_modules') continue;
        walk(full);
      } else if (stats.isFile()) {
        const extension = path.extname(entry.name).toLowerCase();
        if (mode === 'source' ? SOURCE_EXTENSIONS.has(extension) : ['.js', '.mjs', '.cjs'].includes(extension)) files.push(full);
      }
    }
  }
  if (mode === 'source') {
    const present = SOURCE_DIRECTORIES.map((directory) => path.join(root, directory)).filter((directory) => existsSync(directory));
    if (present.length === 0) walk(root);
    else for (const directory of present) walk(directory);
  } else {
    const nextRoot = path.join(root, '.next');
    walk(existsSync(nextRoot) ? nextRoot : root);
  }
  return files;
}

function validateGovernedExceptions(root, files) {
  if (!existsSync(path.join(root, 'package.json'))) return [];
  const relativeFiles = new Set(files.map((file) => path.relative(root, file).split(path.sep).join('/')));
  const findings = [];
  for (const [relativePath, markers] of RETIRED_ROUTES) {
    if (!relativeFiles.has(relativePath)) findings.push({ reason: 'ALLOWLIST_ROUTE_MISSING', line: 0, relativePath });
    else if (!markers.every((marker) => readFileSync(path.join(root, relativePath), 'utf8').includes(marker))) {
      findings.push({ reason: 'ALLOWLIST_ROUTE_INVALID', line: 0, relativePath });
    }
  }
  for (const [relativePath, policy] of DENIAL_TESTS) {
    if (!relativeFiles.has(relativePath)) findings.push({ reason: 'ALLOWLIST_TEST_MISSING', line: 0, relativePath });
    else {
      const content = readFileSync(path.join(root, relativePath), 'utf8');
      if (!content.includes(policy.endpoint) || !content.includes('toBe(405)') || !content.includes(policy.error)) {
        findings.push({ reason: 'ALLOWLIST_TEST_INVALID', line: 0, relativePath });
      }
    }
  }
  return findings;
}

export function scanLegacySearchConsumers({ root, mode }) {
  if (mode !== 'source' && mode !== 'artifact') throw new LegacySearchScanError('SCAN_MODE_INVALID');
  const absoluteRoot = path.resolve(root);
  if (!existsSync(absoluteRoot)) throw new LegacySearchScanError('SCAN_ROOT_MISSING');
  if (!lstatSync(absoluteRoot).isDirectory()) throw new LegacySearchScanError('SCAN_ROOT_NOT_DIRECTORY');
  const files = listFiles(absoluteRoot, mode);
  if (files.length === 0) throw new LegacySearchScanError('SCAN_ROOT_EMPTY');
  const violations = mode === 'source' ? validateGovernedExceptions(absoluteRoot, files) : [];
  for (const file of files) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { throw new LegacySearchScanError('SCAN_ROOT_UNREADABLE'); }
    const relativePath = path.relative(absoluteRoot, file).split(path.sep).join('/');
    let findings = [];
    const extension = path.extname(file).toLowerCase();
    if (extension === '.md') {
      for (const block of executableFences(content)) {
        if (['sh', 'bash', 'shell', 'zsh', 'py', 'python'].includes(block.language)) {
          findings.push(...scanExecutableText(block.content));
        } else {
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
