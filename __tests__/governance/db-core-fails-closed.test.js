/**
 * PR #310, closing the gap flagged on review: __tests__/database/assert-
 * test-db-available.test.ts exercises the probe function directly — it
 * proves the function throws, not that the CI command the mandatory
 * `db-core` lane actually runs (`npm run test:db:core` →
 * `npx jest --config jest.db-core.config.js --runInBand --ci`) fails
 * closed with a nonzero exit code and an explicit diagnostic when its
 * database is unavailable, and succeeds with real assertions run when it
 * is available.
 *
 * This spawns that exact command as a real subprocess, scoped to one
 * representative suite file so the counter-proof stays bounded — it never
 * invokes the whole `db-core` lane, so the lane can never recurse into this
 * test of itself. It never touches any database shared with another test
 * or with the local preview: the positive case gets its own throwaway
 * Postgres container, and the negative case targets a local port nothing
 * is listening on (deterministic ECONNREFUSED — no dependency on how a
 * given runner's network treats a documentation-reserved address like
 * 192.0.2.1, which is a real, distinct concern from "is the target
 * unreachable").
 */
const { spawnSync } = require('child_process');
const { execSync } = require('child_process');
const net = require('net');

const REPO_ROOT = require('path').resolve(__dirname, '../..');
const TARGET_SUITE = '__tests__/concurrency/credit-debit-idempotency.test.ts';
const CONTAINER = `nexus-govtest-dbcore-${process.pid}-${Date.now()}`;

/** A local port nothing is listening on: connections fail immediately and locally. */
async function findClosedPort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port; // now closed again — nothing listens here
}

function runDbCoreSuite(databaseUrl) {
  return spawnSync(
    'npx',
    ['jest', '--config', 'jest.db-core.config.js', '--runInBand', '--ci', TARGET_SUITE],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 110_000,
      env: {
        ...process.env,
        NEXUS_DISPOSABLE_POSTGRES: '1',
        DATABASE_URL: databaseUrl,
        TEST_DATABASE_URL: databaseUrl,
      },
    },
  );
}

describe('db-core lane fails closed on the real CI command (not a unit-level mock)', () => {
  let availablePort;

  beforeAll(() => {
    availablePort = 5000 + (process.pid % 1000); // stable per-run, avoids the picked-then-closed port above
    execSync(
      `docker run -d --name ${CONTAINER} -p 127.0.0.1:${availablePort}:5432 ` +
      `-e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=nexus_disposable_govtest_test pgvector/pgvector:pg16`,
      { stdio: 'pipe' },
    );
    execSync(
      `for i in $(seq 1 30); do docker exec ${CONTAINER} pg_isready -U postgres -d nexus_disposable_govtest_test >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1`,
      { shell: '/bin/bash', stdio: 'pipe' },
    );
    execSync('npx prisma migrate deploy', {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: `postgresql://postgres@127.0.0.1:${availablePort}/nexus_disposable_govtest_test`,
      },
    });
  }, 90_000);

  afterAll(() => {
    try { execSync(`docker rm -f ${CONTAINER}`, { stdio: 'pipe' }); } catch { /* best-effort cleanup */ }
  });

  it('exits nonzero with an explicit diagnostic when the database is unavailable — never a false pass', async () => {
    const closedPort = await findClosedPort();
    const result = runDbCoreSuite(`postgresql://postgres@127.0.0.1:${closedPort}/nexus_disposable_govtest_test`);
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain('DB_UNAVAILABLE_IN_MANDATORY_LANE');
    // The historical defect this guards against: every `it()` no-op-returning
    // made Jest report the suite as fully passed. Assert the actual failure
    // shape, not just the presence of the diagnostic string somewhere in
    // stray output.
    expect(output).toMatch(/Tests:\s+\d+\s+failed/);
    expect(output).not.toMatch(/Tests:\s+\d+\s+passed,\s+\d+\s+total(?!.*failed)/);
  }, 130_000);

  it('exits zero with real, executed assertions when the database is available', async () => {
    const result = runDbCoreSuite(`postgresql://postgres@127.0.0.1:${availablePort}/nexus_disposable_govtest_test`);
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

    expect(result.status).toBe(0);
    expect(output).not.toContain('DB_UNAVAILABLE_IN_MANDATORY_LANE');
    // Not a vacuous 0/0 — the suite's real describe blocks actually ran.
    expect(output).toMatch(/Tests:\s+\d+\s+passed,\s+\d+\s+total/);
    expect(output).not.toMatch(/Tests:\s+0\s+passed/);
  }, 130_000);
});
