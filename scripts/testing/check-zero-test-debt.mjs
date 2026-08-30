import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import ts from 'typescript';

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
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

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const member = propertyName(node.expression);
      if (member && FORBIDDEN_MEMBERS.has(member)) {
        findings.push(`${file}:${lineAndColumn(sourceFile, node)} focused-or-disabled-test:${member}`);
      } else if (ts.isIdentifier(node.expression) && FORBIDDEN_CALLEES.has(node.expression.text)) {
        findings.push(`${file}:${lineAndColumn(sourceFile, node)} focused-or-disabled-test:${node.expression.text}`);
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
      if (name === 'testIgnore') {
        const serialized = node.initializer.getText(sourceFile).toLowerCase();
        if (serialized.includes('aria') || serialized.includes('candidate-diagnostic')
          || serialized.includes('coach-resource-student')) {
          findings.push(`${file}:${lineAndColumn(sourceFile, node)} ignored-qualification-test`);
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
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
  }
}
