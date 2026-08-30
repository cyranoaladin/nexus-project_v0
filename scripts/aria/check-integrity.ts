import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const GRADE_LEVELS = new Set([
  'QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE', 'POSTBAC', 'AUTRE',
]);
const LEGACY_FUNCTIONS = new Set([
  'mapLegacySubjectToCourseKey',
  'generateAriaResponse',
  'generateAriaStream',
  'generateAriaResponseStream',
]);
const COURSE_KEY = /^(?:college|tc|eds|stmg|option|options)-[a-z0-9-]+$/;

interface Finding {
  readonly path: string;
  readonly line: number;
  readonly reason: string;
}

function filesUnder(repositoryRoot: string, ...roots: string[]): readonly string[] {
  const files: string[] = [];
  const visit = (absolute: string): void => {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      const child = join(absolute, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(relative(repositoryRoot, child));
    }
  };
  for (const root of roots) visit(resolve(repositoryRoot, root));
  return files.sort();
}

function parsed(repositoryRoot: string, path: string): { readonly ast: ts.SourceFile; readonly text: string } {
  const text = readFileSync(resolve(repositoryRoot, path), 'utf8');
  return {
    ast: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true),
    text,
  };
}

function finding(path: string, ast: ts.SourceFile, node: ts.Node, reason: string): Finding {
  return {
    path,
    line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
    reason,
  };
}

function stringValue(node: ts.Node | undefined): string | null {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;
}

export interface AriaIntegrityReport {
  readonly hardcodedCourses: readonly Finding[];
  readonly implicitGradeDefaults: readonly Finding[];
  readonly implicitCourseDefaults: readonly Finding[];
  readonly adapterDefaults: readonly Finding[];
  readonly terminaleCalls: readonly Finding[];
  readonly legacyAdapters: readonly Finding[];
  readonly subjectClients: readonly Finding[];
  readonly subjectMathsFallbacks: readonly Finding[];
  readonly historyIsCourseKey: boolean;
  readonly violationCount: number;
}

export function inspectAriaIntegrity(repositoryRoot: string): AriaIntegrityReport {
  const ariaRuntimeFiles = filesUnder(repositoryRoot, 'app/api/aria', 'components/aria', 'lib/aria');
  const productFiles = filesUnder(repositoryRoot, 'app', 'components', 'lib');
  const frontendFiles = filesUnder(repositoryRoot, 'components/aria');

  const hardcodedCourses: Finding[] = [];
  for (const path of frontendFiles) {
    const { ast } = parsed(repositoryRoot, path);
  const visit = (node: ts.Node): void => {
    const value = stringValue(node);
    if (value && COURSE_KEY.test(value)) {
      hardcodedCourses.push(finding(path, ast, node, `hardcoded authenticated course ${value}`));
    }
    node.forEachChild(visit);
  };
    visit(ast);
  }

  const implicitGradeDefaults: Finding[] = [];
  const implicitCourseDefaults: Finding[] = [];
  for (const path of ariaRuntimeFiles) {
    const { ast } = parsed(repositoryRoot, path);
  const visit = (node: ts.Node): void => {
    if (ts.isParameter(node)) {
      const value = stringValue(node.initializer);
      if (value && GRADE_LEVELS.has(value)) {
        implicitGradeDefaults.push(finding(path, ast, node, `grade parameter defaults to ${value}`));
      }
    }
    if (ts.isBinaryExpression(node)
      && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
      const right = stringValue(node.right);
      if (right && (COURSE_KEY.test(right) || ['MATHEMATIQUES', 'MATHS'].includes(right))) {
        implicitCourseDefaults.push(finding(path, ast, node, `context fallback to ${right}`));
      }
    }
    if (ts.isElementAccessExpression(node)
      && stringValue(node.argumentExpression) === null
      && ts.isNumericLiteral(node.argumentExpression)
      && node.argumentExpression.text === '0'
      && /^(?:available|courses)$/.test(node.expression.getText(ast))) {
      implicitCourseDefaults.push(finding(path, ast, node, 'first course selected implicitly'));
    }
    node.forEachChild(visit);
  };
    visit(ast);
  }

  const adapterDefaults: Finding[] = [];
  const terminaleCalls: Finding[] = [];
  const legacyAdapters: Finding[] = [];
  const subjectClients: Finding[] = [];
  const subjectMathsFallbacks: Finding[] = [];
  for (const path of productFiles) {
    const { ast, text } = parsed(repositoryRoot, path);
  const hasChatEndpoint = /\/api\/aria\/(?:chat|conversations)/.test(text);
  const visit = (node: ts.Node): void => {
    if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node))
      && node.name && LEGACY_FUNCTIONS.has(node.name.getText(ast))) {
      legacyAdapters.push(finding(path, ast, node, `legacy declaration ${node.name.getText(ast)}`));
      if (node.name.getText(ast) === 'mapLegacySubjectToCourseKey') {
        for (const parameter of node.parameters) {
          if (parameter.initializer) adapterDefaults.push(finding(path, ast, parameter, 'legacy grade default'));
        }
      }
    }
    if (ts.isImportSpecifier(node) && LEGACY_FUNCTIONS.has(node.name.text)) {
      legacyAdapters.push(finding(path, ast, node, `legacy import ${node.name.text}`));
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(ast).split('.').at(-1) ?? '';
      if (LEGACY_FUNCTIONS.has(callee)) {
        legacyAdapters.push(finding(path, ast, node, `legacy call ${callee}`));
      }
      if (callee === 'mapLegacySubjectToCourseKey'
        && node.arguments.some((argument) => stringValue(argument) === 'TERMINALE')) {
        terminaleCalls.push(finding(path, ast, node, 'hardcoded TERMINALE legacy call'));
      }
    }
    if (hasChatEndpoint && ts.isPropertyAssignment(node)
      && node.name.getText(ast).replace(/["']/g, '') === 'subject') {
      subjectClients.push(finding(path, ast, node, 'subject payload sent to an ARIA chat/history API'));
    }
    if (hasChatEndpoint) {
      const value = stringValue(node);
      if (value && /[?&]subject=/.test(value)) {
        subjectClients.push(finding(path, ast, node, 'subject query sent to an ARIA chat/history API'));
      }
    }
    if (ts.isBinaryExpression(node)
      && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)
      && /legacySubject/.test(node.left.getText(ast))
      && /(?:MATHEMATIQUES|MATHS)/.test(node.right.getText(ast))) {
      subjectMathsFallbacks.push(finding(path, ast, node, 'null legacy subject falls back to Maths'));
    }
    node.forEachChild(visit);
  };
    visit(ast);
  }

  const historyRoute = readFileSync(resolve(repositoryRoot, 'app/api/aria/conversations/route.ts'), 'utf8');
  const historyContracts = readFileSync(resolve(repositoryRoot, 'lib/aria/transport/contracts.ts'), 'utf8');
  const historyIsCourseKey = /courseKey/.test(historyRoute)
    && /ariaConversationListQuerySchema[\s\S]*courseKey/.test(historyContracts)
    && !/ariaConversationListQuerySchema[\s\S]{0,500}\bsubject\s*:/.test(historyContracts);
  const violationCount = hardcodedCourses.length
    + implicitGradeDefaults.length
    + implicitCourseDefaults.length
    + adapterDefaults.length
    + terminaleCalls.length
    + subjectMathsFallbacks.length
    + subjectClients.length
    + legacyAdapters.length
    + (historyIsCourseKey ? 0 : 1);
  return Object.freeze({
    hardcodedCourses: Object.freeze(hardcodedCourses),
    implicitGradeDefaults: Object.freeze(implicitGradeDefaults),
    implicitCourseDefaults: Object.freeze(implicitCourseDefaults),
    adapterDefaults: Object.freeze(adapterDefaults),
    terminaleCalls: Object.freeze(terminaleCalls),
    legacyAdapters: Object.freeze(legacyAdapters),
    subjectClients: Object.freeze(subjectClients),
    subjectMathsFallbacks: Object.freeze(subjectMathsFallbacks),
    historyIsCourseKey,
    violationCount,
  });
}

export function renderAriaIntegrityReport(
  report: AriaIntegrityReport,
  write: (value: string) => void = (value) => process.stdout.write(value),
): void {
  const emit = (label: string, findings: readonly Finding[]): void => {
    write(`${label}=${findings.length}\n`);
    for (const item of findings) write(`${label}_FINDING=${item.path}:${item.line}:${item.reason}\n`);
  };
  emit('ARIA_HARDCODED_COURSE_LISTS', report.hardcodedCourses);
  emit('ARIA_IMPLICIT_GRADE_DEFAULTS', report.implicitGradeDefaults);
  emit('ARIA_IMPLICIT_COURSE_DEFAULTS', report.implicitCourseDefaults);
  write(`LEGACY_ADAPTER_DEFAULT_GRADE=${report.adapterDefaults.length === 0 ? 'NONE' : report.adapterDefaults.length}\n`);
  emit('HARDCODED_TERMINALE_LEGACY_CALLS', report.terminaleCalls);
  emit('LEGACY_SUBJECT_NULL_TO_MATHS', report.subjectMathsFallbacks);
  emit('ACTIVE_SUBJECT_BASED_CHAT_CLIENTS', report.subjectClients);
  emit('UNNECESSARY_LEGACY_ARIA_ADAPTERS', report.legacyAdapters);
  write(`ARIA_HISTORY_PRIMARY_CONTEXT=${report.historyIsCourseKey ? 'COURSE_KEY' : 'INVALID'}\n`);
}

export function runAriaIntegrityCheck(repositoryRoot = process.cwd()): number {
  const report = inspectAriaIntegrity(repositoryRoot);
  renderAriaIntegrityReport(report);
  return report.violationCount > 0 ? 1 : 0;
}

if (require.main === module) process.exitCode = runAriaIntegrityCheck();
