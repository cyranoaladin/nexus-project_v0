import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const SCAN_ROOTS = [
  'app/api/aria', 'components/aria', 'lib/aria', 'scripts/aria', 'scripts/e2e', 'e2e/aria',
  'e2e/helpers',
] as const;
const SCAN_FILES = ['scripts/seed-e2e-db.ts'] as const;

export type AriaSecurityFindingCode =
  | 'DIRECT_MODEL_CALL_OUTSIDE_GATEWAY'
  | 'FAKE_MODEL_CREDENTIAL_FALLBACK'
  | 'RAW_SERVER_ERROR_TO_CLIENT'
  | 'SILENT_EMPTY_CATCH';

export interface AriaSecurityFinding {
  readonly path: string;
  readonly code: AriaSecurityFindingCode;
}

function sourceFiles(root: string): readonly string[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(relative(ROOT, absolute));
    }
  };
  visit(resolve(ROOT, root));
  return files;
}

function discardsPromiseFailure(callback: ts.Expression): boolean {
  if (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) return false;
  if (ts.isBlock(callback.body)) {
    if (callback.body.statements.length === 0) return true;
    return callback.body.statements.length === 1
      && ts.isReturnStatement(callback.body.statements[0])
      && (!callback.body.statements[0].expression
        || callback.body.statements[0].expression.kind === ts.SyntaxKind.NullKeyword
        || (ts.isIdentifier(callback.body.statements[0].expression)
          && callback.body.statements[0].expression.text === 'undefined'));
  }
  return callback.body.kind === ts.SyntaxKind.NullKeyword
    || (ts.isIdentifier(callback.body) && callback.body.text === 'undefined');
}

function containsPersistenceOperation(text: string): boolean {
  return /\b(?:prisma|tx|database|repository|persistence|store)\b/i.test(text)
    || /\.(?:create|createMany|delete|deleteMany|finalize|heartbeat|insert|reserve|save|update|updateMany|upsert)\s*\(/i.test(text);
}

export function inspectAriaSecuritySources(
  sources: ReadonlyMap<string, string>,
): readonly AriaSecurityFinding[] {
  const findings: AriaSecurityFinding[] = [];
  for (const [path, source] of sources) {
    let silentPersistenceFailure = false;
    if (/\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/.test(source)) {
      silentPersistenceFailure = true;
    }
    if (/\b(?:OPENAI_API_KEY|ARIA_MODEL_API_KEY)\s*(?:\|\||\?\?)\s*['"]ollama['"]/i.test(source)) {
      findings.push({ path, code: 'FAKE_MODEL_CREDENTIAL_FALLBACK' });
    }
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true,
      path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visitPersistence = (node: ts.Node): void => {
      if (ts.isCallExpression(node)
        && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === 'catch'
        && node.arguments[0]
        && discardsPromiseFailure(node.arguments[0])
        && containsPersistenceOperation(node.expression.expression.getText(ast))) {
        silentPersistenceFailure = true;
      }
      if (ts.isTryStatement(node)
        && node.catchClause
        && node.catchClause.block.statements.length === 0
        && containsPersistenceOperation(node.tryBlock.getText(ast))) {
        silentPersistenceFailure = true;
      }
      node.forEachChild(visitPersistence);
    };
    visitPersistence(ast);
    if (silentPersistenceFailure) findings.push({ path, code: 'SILENT_EMPTY_CATCH' });

    if (path.startsWith('app/api/aria/')) {
      let rawPublicError = false;
      const canonicalSerializerBindings = new Set<string>();
      for (const statement of ast.statements) {
        if (!ts.isImportDeclaration(statement)
          || !ts.isStringLiteral(statement.moduleSpecifier)
          || statement.moduleSpecifier.text !== '@/lib/aria/application/public-error'
          || !statement.importClause?.namedBindings
          || !ts.isNamedImports(statement.importClause.namedBindings)) continue;
        for (const element of statement.importClause.namedBindings.elements) {
          if ((element.propertyName?.text ?? element.name.text) === 'serializeAriaPublicError') {
            canonicalSerializerBindings.add(element.name.text);
          }
        }
      }
      const isPublicSerialization = (node: ts.CallExpression | ts.NewExpression): boolean => {
        if (ts.isNewExpression(node)) {
          return ts.isIdentifier(node.expression) && node.expression.text === 'Response';
        }
        return ts.isPropertyAccessExpression(node.expression)
          && (node.expression.name.text === 'json'
            || (node.expression.expression.getText(ast) === 'JSON'
              && node.expression.name.text === 'stringify'));
      };
      const visit = (node: ts.Node): void => {
        if ((ts.isCallExpression(node) || ts.isNewExpression(node))
          && isPublicSerialization(node)
          && (node.arguments ?? []).some(
            (argument) => /\berror\.message\b/.test(argument.getText(ast)),
          )) {
          rawPublicError = true;
        }
        node.forEachChild(visit);
      };
      visit(ast);

      const inspectCatchClause = (clause: ts.CatchClause): void => {
        if (!clause.variableDeclaration || !ts.isIdentifier(clause.variableDeclaration.name)) return;
        const tainted = new Set([clause.variableDeclaration.name.text]);
        const containsTaintedValue = (node: ts.Node): boolean => {
          if (ts.isCallExpression(node)
            && ts.isIdentifier(node.expression)
            && canonicalSerializerBindings.has(node.expression.text)) return false;
          if (ts.isIdentifier(node) && tainted.has(node.text)) return true;
          return node.getChildren(ast).some(containsTaintedValue);
        };
        const visitCatch = (node: ts.Node): void => {
          if (ts.isVariableDeclaration(node)
            && ts.isIdentifier(node.name)
            && node.initializer
            && containsTaintedValue(node.initializer)) {
            tainted.add(node.name.text);
          }
          if (ts.isBinaryExpression(node)
            && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
            && ts.isIdentifier(node.left)
            && containsTaintedValue(node.right)) {
            tainted.add(node.left.text);
          }
          if ((ts.isCallExpression(node) || ts.isNewExpression(node))
            && isPublicSerialization(node)
            && (node.arguments ?? []).some(containsTaintedValue)) {
            rawPublicError = true;
          }
          node.forEachChild(visitCatch);
        };
        visitCatch(clause.block);
      };
      const visitCatches = (node: ts.Node): void => {
        if (ts.isCatchClause(node)) inspectCatchClause(node);
        node.forEachChild(visitCatches);
      };
      visitCatches(ast);
      if (rawPublicError) findings.push({ path, code: 'RAW_SERVER_ERROR_TO_CLIENT' });
    }
    if (path !== 'lib/aria/infrastructure/model/gateway.ts'
      && (/\bnew\s+OpenAI\s*\(/.test(source) || /\bopenai\.(?:chat|responses)\b/.test(source))) {
      findings.push({ path, code: 'DIRECT_MODEL_CALL_OUTSIDE_GATEWAY' });
    }
  }
  return findings.sort((left, right) =>
    left.path.localeCompare(right.path) || left.code.localeCompare(right.code));
}

export function inspectRepositoryAriaSecurity(): Readonly<{
  filesInspected: number;
  findings: readonly AriaSecurityFinding[];
}> {
  const files = [...SCAN_ROOTS.flatMap(sourceFiles), ...SCAN_FILES];
  const sources = new Map(files.map((path) => [path, readFileSync(resolve(ROOT, path), 'utf8')]));
  return Object.freeze({ filesInspected: files.length, findings: inspectAriaSecuritySources(sources) });
}

function main(): void {
  const result = inspectRepositoryAriaSecurity();
  const counts = new Map<AriaSecurityFindingCode, number>([
    ['DIRECT_MODEL_CALL_OUTSIDE_GATEWAY', 0],
    ['FAKE_MODEL_CREDENTIAL_FALLBACK', 0],
    ['RAW_SERVER_ERROR_TO_CLIENT', 0],
    ['SILENT_EMPTY_CATCH', 0],
  ]);
  for (const finding of result.findings) {
    counts.set(finding.code, (counts.get(finding.code) ?? 0) + 1);
    process.stderr.write(`ARIA_SECURITY_FINDING=${finding.code}:${finding.path}\n`);
  }
  process.stdout.write(`ARIA_SECURITY_FILES_INSPECTED=${result.filesInspected}\n`);
  process.stdout.write(`DIRECT_MODEL_CALLS_OUTSIDE_GATEWAY=${counts.get('DIRECT_MODEL_CALL_OUTSIDE_GATEWAY')}\n`);
  process.stdout.write(`FAKE_MODEL_CREDENTIAL_FALLBACKS=${counts.get('FAKE_MODEL_CREDENTIAL_FALLBACK')}\n`);
  process.stdout.write(`RAW_SERVER_ERROR_TO_CLIENT=${counts.get('RAW_SERVER_ERROR_TO_CLIENT')}\n`);
  process.stdout.write(`ARIA_CORE_DB_ERRORS_SWALLOWED=${counts.get('SILENT_EMPTY_CATCH')}\n`);
  if (result.findings.length > 0) process.exitCode = 1;
}

if (require.main === module) main();
