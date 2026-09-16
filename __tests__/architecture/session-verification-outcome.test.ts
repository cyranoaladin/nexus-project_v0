import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const marker = 'recordSessionVerificationUnavailable();';

/**
 * Integration contract for the canonical JWT callback: Auth.js can swallow
 * exceptions into 200/null and cookie deletion. A bare rethrow is NOT enough.
 * Keep the outcome marker as the first executable catch statement, before any
 * potentially throwing work, conditional exit, return or rethrow.
 */
function unmarkedSessionCatches(source: string): string[] {
  const file = ts.createSourceFile('session-revocation.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const validators = file.statements.filter(ts.isFunctionDeclaration)
    .filter(node => node.name?.text === 'validateSessionToken' && node.body);
  if (validators.length !== 1) return ['Expected exactly one canonical validateSessionToken implementation'];
  const violations: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCatchClause(node)) {
      const first = node.block.statements.find(statement => !ts.isEmptyStatement(statement));
      const call = first && ts.isExpressionStatement(first) ? first.expression : undefined;
      const marked = call && ts.isCallExpression(call) && !call.questionDotToken
        && ts.isIdentifier(call.expression) && call.expression.text === 'recordSessionVerificationUnavailable'
        && call.arguments.length === 0;
      if (!marked) {
        const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
        violations.push(`line ${line + 1}: caught session-authority exceptions must record unavailability first`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(validators[0].body!);
  return violations;
}

// Structural fixtures for the four catches in #252 at ec4121d56453b795b796c6e45241ea92b8a9ae84.
// They exercise integration enforcement only, NOT real Core v2 lifecycle coverage.
const authorityBranches = [
  ['rollout mode', 'mode = validators.mode();'],
  ['Core v2 session', 'return await validators.coreV2(claims) ? token : null;'],
  ['HYBRID ownership', 'if (await validators.ownedByCoreV2(userId)) return null;'],
  ['V1 lookup', 'const user = await database.user.findUnique(query); return user ? token : null;'],
] as const;

function fixture(tryBody: string, catchBody: string): string {
  return `export async function validateSessionToken(token) {
    try { ${tryBody} } catch (error) { ${catchBody} }
  }`;
}

describe('canonical session unavailable outcome integration guard', () => {
  it('marks every caught authority failure in the current runtime validator', () => {
    const source = readFileSync(resolve(process.cwd(), 'lib/auth/session-revocation.ts'), 'utf8');
    expect(unmarkedSessionCatches(source)).toEqual([]);
    // Removing today's marker must fail even before the additional #252 paths land.
    expect(unmarkedSessionCatches(source.replace('recordSessionVerificationUnavailable()', 'void 0'))).toHaveLength(1);
  });

  describe.each(authorityBranches)('%s authority branch', (_name, tryBody) => {
    it.each([
      ['missing marker', 'return null;'],
      ['conditional marker', 'if (error.retryable) recordSessionVerificationUnavailable(); return null;'],
      ['marker after return', `return null; ${marker}`],
      ['bare rethrow', 'throw error;'],
      ['marker after potentially throwing work', `audit(error); ${marker} return null;`],
      ['comment pretending to mark', '// recordSessionVerificationUnavailable();\n return null;'],
    ])('rejects %s', (_case, catchBody) => {
      expect(unmarkedSessionCatches(fixture(tryBody, catchBody))).toHaveLength(1);
    });

    it.each(['return null;', 'throw error;'])('accepts an unconditional marker before %s', exit => {
      expect(unmarkedSessionCatches(fixture(tryBody, `/* infrastructure failure */ ; ${marker} ${exit}`))).toEqual([]);
    });
  });

  it('rejects all four unmarked #252 catch branches independently in one validator', () => {
    const source = `export async function validateSessionToken(token) {
      ${authorityBranches.map(([, body]) => `try { ${body} } catch { return null; }`).join('\n')}
    }`;
    expect(unmarkedSessionCatches(source)).toHaveLength(4);
    expect(unmarkedSessionCatches(source.replaceAll('catch {', `catch { ${marker}`))).toEqual([]);
  });

  it('does not silently pass if the canonical validator is renamed or absent', () => {
    expect(unmarkedSessionCatches('export function anotherValidator() {}')).toHaveLength(1);
  });

  it('leaves unrelated functions outside this narrowly scoped guard', () => {
    const source = fixture('return token;', `${marker} return null;`)
      + '\nexport function unrelated() { try { work(); } catch { return null; } }';
    expect(unmarkedSessionCatches(source)).toEqual([]);
  });
});
