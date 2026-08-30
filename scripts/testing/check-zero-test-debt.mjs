import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import ts from 'typescript';

const SOURCE_EXTENSIONS = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.json', '.yml', '.yaml',
]);
const FORBIDDEN_MEMBERS = new Set(['skip', 'todo', 'only', 'fixme']);
const FORBIDDEN_CALLEES = new Set(['x' + 'it', 'x' + 'describe', 'f' + 'it', 'f' + 'describe']);

function lineAndColumn(sourceFile, node) {
  const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${location.line + 1}:${location.character + 1}`;
}

function propertyName(expression) {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (ts.isElementAccessExpression(expression)
    && expression.argumentExpression
    && ts.isStringLiteral(expression.argumentExpression)) {
    return expression.argumentExpression.text;
  }
  return null;
}

function numericLiteralValue(node) {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  return null;
}

export function inspectTestDebtSource(file, text) {
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') || file.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const findings = [];
  const qualificationFile = /^(?:e2e\/aria\/|__tests__\/(?:api|architecture|components|concurrency|database|db|integration|lib|scripts)\/.*aria)/.test(file);
  const browserQualificationFile = /^e2e\/aria\//.test(file);

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const member = propertyName(node.expression);
      if (member && FORBIDDEN_MEMBERS.has(member)) {
        findings.push(`${file}:${lineAndColumn(sourceFile, node)} focused-or-disabled-test:${member}`);
      } else if (ts.isIdentifier(node.expression) && FORBIDDEN_CALLEES.has(node.expression.text)) {
        findings.push(`${file}:${lineAndColumn(sourceFile, node)} focused-or-disabled-test:${node.expression.text}`);
      }
      if (browserQualificationFile
        && ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === 'expect'
        && node.expression.name.text === 'anything') {
        findings.push(`${file}:${lineAndColumn(sourceFile, node)} permissive-qualification-assertion`);
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)
        ? node.name.text
        : null;
      if (name === 'retries') {
        const value = numericLiteralValue(node.initializer);
        if (value === null || value !== 0) {
          findings.push(`${file}:${lineAndColumn(sourceFile, node)} retry-policy-must-be-zero`);
        }
      }
      if (name === 'testIgnore' || name === 'testPathIgnorePatterns') {
        const serialized = node.initializer.getText(sourceFile).toLowerCase();
        const isOwnedLanePartition = name === 'testPathIgnorePatterns'
          && ((file === 'jest.aria.unit.config.js'
            && serialized.includes('sse.test.ts') && serialized.includes('real'))
            || (file === 'jest.aria.integration.config.js'
              && serialized.includes('real') && !serialized.includes('aria')));
        if (!isOwnedLanePartition
          && (serialized.includes('aria') || serialized.includes('candidate-diagnostic')
          || serialized.includes('coach-resource-student'))) {
          findings.push(`${file}:${lineAndColumn(sourceFile, node)} ignored-qualification-test`);
        }
      }
      if (name === 'passWithNoTests' && node.initializer.kind !== ts.SyntaxKind.FalseKeyword) {
        findings.push(`${file}:${lineAndColumn(sourceFile, node)} empty-test-lane-option`);
      }
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (qualificationFile && /@\s*quarantine\b/i.test(text)) {
    findings.push(`${file}:1:1 quarantined-test-marker`);
  }
  const emptyLaneCliOption = ['--', 'pass', 'With', 'No', 'Tests'].join('');
  if (text.includes(emptyLaneCliOption)) {
    findings.push(`${file}:1:1 empty-test-lane-option`);
  }
  return findings;
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

export function inspectRepositoryTestDebt(files = trackedFiles()) {
  const findings = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    if (file.endsWith('/QUARANTINE.md') || file === 'e2e/QUARANTINE.md') {
      findings.push(`${file}: quarantined-test-inventory`);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(extname(file))) continue;
    findings.push(...inspectTestDebtSource(file, readFileSync(file, 'utf8')));
  }
  return { filesInspected: files.length, findings };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const result = inspectRepositoryTestDebt();
  if (result.findings.length > 0) {
    process.stderr.write(`${result.findings.join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`TEST_DEBT_FILES_INSPECTED=${result.filesInspected}\n`);
    process.stdout.write('TEST_SKIP_COUNT=0\nTEST_TODO_COUNT=0\nXIT_COUNT=0\nXDESCRIBE_COUNT=0\n');
    process.stdout.write('FIT_COUNT=0\nFDESCRIBE_COUNT=0\nTEST_ONLY_COUNT=0\nQUARANTINED_TEST_COUNT=0\n');
    process.stdout.write('IGNORED_ARIA_TEST_COUNT=0\n');
  }
}
