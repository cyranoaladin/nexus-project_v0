import { assertTestDbAvailable, testPrisma } from '../setup/test-database';

/**
 * Regression test for the fix in `test-database.ts`: the mandatory `db-core`
 * lane must fail loudly, not silently pass, when its database is
 * unreachable (see `credit-debit-idempotency.test.ts` and friends).
 *
 * This exercises the real function against a real (but deliberately
 * unroutable) Postgres URL — not a mock — so it proves the actual command's
 * behavior, not just that a string or a stubbed client returns the right
 * shape. TEST_NET_UNREACHABLE (192.0.2.1, RFC 5737) never accepts a
 * connection, so this never depends on any shared disposable database and
 * cannot flake on real DB latency.
 */
describe('assertTestDbAvailable', () => {
  const UNREACHABLE_URL = 'postgresql://postgres@192.0.2.1:5432/unreachable?connect_timeout=1';

  it('throws DB_UNAVAILABLE_IN_MANDATORY_LANE when the database cannot be reached', async () => {
    await expect(assertTestDbAvailable(UNREACHABLE_URL)).rejects.toThrow(
      'DB_UNAVAILABLE_IN_MANDATORY_LANE',
    );
  }, 10_000);

  it('clears its internal timer on the winning (fast, reachable) path — not just when it fires', async () => {
    // The bug this guards: `Promise.race` never cancels the losing side, so
    // a fast, successful probe query used to leave the 3s timeout armed —
    // firing a reject() 3s later that nothing awaits anymore. A test that
    // only exercises an unreachable target can't catch this: the timer
    // fires and self-clears there regardless of whether the code calls
    // `clearTimeout`. This needs a real, reachable database so the query
    // wins the race well inside 3s. Jest's fake timers would also freeze
    // Prisma's own internal connection timers and hang the real query, so
    // this spies on the real global setTimeout/clearTimeout instead.
    // Only intercept the exact 3000ms delay this function's own timeout
    // race uses, so unrelated timers (Prisma's connection/keep-alive
    // internals included) never pollute the assertion.
    const created: unknown[] = [];
    const cleared: unknown[] = [];
    const realSetTimeout = global.setTimeout;
    const realClearTimeout = global.clearTimeout;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).setTimeout = ((fn: (...a: unknown[]) => void, delay?: number, ...rest: unknown[]) => {
      const handle = realSetTimeout(fn as never, delay as never, ...(rest as []));
      if (delay === 3000) created.push(handle);
      return handle;
    }) as typeof setTimeout;
    (global as any).clearTimeout = ((handle: unknown) => {
      if (created.includes(handle)) cleared.push(handle);
      return realClearTimeout(handle as never);
    }) as typeof clearTimeout;
    try {
      await assertTestDbAvailable(); // default URL: the real, reachable disposable DB this suite already uses
    } finally {
      global.setTimeout = realSetTimeout;
      global.clearTimeout = realClearTimeout;
    }
    expect(created.length).toBe(1);
    expect(cleared).toEqual(created);
  }, 10_000);

  afterAll(async () => {
    await testPrisma.$disconnect();
  });
});
