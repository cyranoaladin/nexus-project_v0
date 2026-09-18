import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

/**
 * A promise is only "handled" once something attaches to it. A test that
 * creates a competing promise, then awaits other things, and only afterwards
 * writes `await expect(p).rejects...` leaves a window: if `p` settles during
 * those intervening awaits, Node reports an unhandled rejection and the run
 * fails even though the assertion itself would have passed.
 *
 * That is exactly how `npc-submission-lock.real.test.ts` turned `main` red on
 * 2026-09-16 (run 35082406437). The competing transaction was blocked on a row
 * lock; `releaseQueue.resolve()` freed it, and it rejected during `await queue`
 * — one line before the handler would have attached. The log shows
 * "PromiseRejectionHandledWarning: rejection was handled asynchronously"
 * immediately before the failure.
 *
 * The fix is to attach at creation and assert on the captured outcome:
 *
 *   const outcome = p.then(() => null, (error: unknown) => error);
 *   ...
 *   expect(await outcome).toBeInstanceOf(ExpectedError);
 *
 * which is strictly equivalent — a promise that does not reject yields null and
 * still fails the assertion — but has no window.
 *
 * This guard flags only the genuinely dangerous shape: an `expect(<name>).rejects`
 * whose promise was created in the same block with at least one `await` in
 * between. `await expect(doThing()).rejects...` on a freshly created promise is
 * fine and is not flagged.
 */

const ROOTS = ['__tests__', 'e2e'];

function sourceFiles(directory: string): string[] {
  const absolute = resolve(process.cwd(), directory);
  return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.tsx?$/.test(entry.name) ? [relative] : [];
  });
}

/** Promise-valued consts declared in this block, in order, with their index. */
function deferredRejectionWindows(file: string, source: string): string[] {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations: string[] = [];

  const visitBlock = (statements: ts.NodeArray<ts.Statement>) => {
    // name -> index of the statement that created it
    const created = new Map<string, number>();
    // indexes of statements that contain an await
    const awaitAt: number[] = [];

    statements.forEach((statement, index) => {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.initializer) {
            // A call expression that is NOT awaited here is a live promise.
            const init = declaration.initializer;
            const isAwaited = ts.isAwaitExpression(init);
            const isCall = ts.isCallExpression(init) || ts.isPropertyAccessExpression(init);
            // `.then(...)`/`.catch(...)` already attaches a handler -> safe.
            const attaches = /\.(?:then|catch|finally)\s*\(/.test(init.getText(parsed));
            if (!isAwaited && isCall && !attaches) created.set(declaration.name.text, index);
          }
        }
      }
      // A standalone `void p.catch(...)` / `p.catch(...)` statement marks the
      // promise handled from that point on, which is the minimal remedy when
      // the assertion below must stay exactly as written.
      if (ts.isExpressionStatement(statement)) {
        const text = statement.getText(parsed);
        const marker = /^(?:void\s+)?([A-Za-z_$][\w$]*)\s*\.\s*catch\s*\(/.exec(text.trim());
        if (marker) created.delete(marker[1]);
      }

      let hasAwait = false;
      const scan = (node: ts.Node) => {
        if (ts.isAwaitExpression(node)) hasAwait = true;
        // do not descend into nested function bodies: their awaits are not ours
        if (ts.isFunctionLike(node)) return;
        ts.forEachChild(node, scan);
      };
      ts.forEachChild(statement, scan);
      if (hasAwait) awaitAt.push(index);

      // Find `expect(<name>).rejects` anywhere in this statement.
      const findAssertion = (node: ts.Node) => {
        if (
          ts.isPropertyAccessExpression(node) &&
          node.name.text === 'rejects' &&
          ts.isCallExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === 'expect' &&
          node.expression.arguments.length === 1 &&
          ts.isIdentifier(node.expression.arguments[0])
        ) {
          const name = (node.expression.arguments[0] as ts.Identifier).text;
          const createdAt = created.get(name);
          if (createdAt !== undefined && awaitAt.some(a => a > createdAt && a < index)) {
            const { line } = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
            violations.push(`${file}:${line + 1} (${name})`);
          }
        }
        ts.forEachChild(node, findAssertion);
      };
      ts.forEachChild(statement, findAssertion);
    });
  };

  const walk = (node: ts.Node) => {
    if (ts.isBlock(node) || ts.isSourceFile(node)) visitBlock(node.statements);
    ts.forEachChild(node, walk);
  };
  walk(parsed);
  return violations;
}

describe('deferred rejection assertion authority', () => {
  it('never asserts .rejects on a promise that could settle during an earlier await', () => {
    const offenders = ROOTS.flatMap(sourceFiles).flatMap(file =>
      deferredRejectionWindows(file, readFileSync(resolve(process.cwd(), file), 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('flags the exact shape that turned main red, and clears the converged form', () => {
    const dangerous = `
      async function t() {
        const holder = begin();
        const competing = second();
        await holder;
        await expect(competing).rejects.toBeInstanceOf(Error);
      }`;
    expect(deferredRejectionWindows('x.ts', dangerous)).toHaveLength(1);

    const converged = `
      async function t() {
        const holder = begin();
        const competing = second();
        const outcome = competing.then(() => null, (e: unknown) => e);
        await holder;
        expect(await outcome).toBeInstanceOf(Error);
      }`;
    expect(deferredRejectionWindows('x.ts', converged)).toEqual([]);
  });

  it('does not flag an assertion on a freshly created promise', () => {
    const fine = `
      async function t() {
        await expect(doThing()).rejects.toBeInstanceOf(Error);
      }`;
    expect(deferredRejectionWindows('x.ts', fine)).toEqual([]);
  });
});
