import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { assertDisposablePostgresUrl } from '../../helpers/disposable-postgres';

/**
 * Throwaway PostgreSQL databases for the Core v2 identity suite.
 *
 * Every property below is enforced in code, not by convention:
 *
 * - EXPLICIT DSN. The server is reached ONLY through the DSN passed to
 *   `createScratchDatabaseRegistry()` (the suite reads it from
 *   CORE_V2_IDENTITY_TEST_ADMIN_URL). Nothing here reads DATABASE_URL or
 *   CORE_V2_DATABASE_URL, so no ambient variable can redirect it.
 * - NAMED AND MARKED. Each database is named `nexus_disposable_<label>_<run>_test`
 *   (the exact shape `assertDisposablePostgresUrl` accepts) and carries a
 *   `COMMENT ON DATABASE` ownership marker unique to this registry instance.
 * - ANTI-PRODUCTION GUARD. The administrative DSN must be a local server's
 *   `postgres` maintenance database and NEXUS_DISPOSABLE_POSTGRES=1 must be set;
 *   every scratch URL must pass `assertDisposablePostgresUrl` before it is
 *   handed out; a database is dropped only if its comment still equals this
 *   registry's marker, so a database this registry did not create can never be
 *   dropped, even by a name collision.
 * - SCOPED TERMINATION. `dropAll()` does call `pg_terminate_backend`, but only
 *   for backends whose `datname` is the named scratch database, and never for
 *   its own backend: there is no global sweep, and no other project's sessions
 *   can be reached. The drop itself is `DROP DATABASE ... WITH (FORCE)` under a
 *   bounded `lock_timeout`/`statement_timeout`, retried a FINITE number of
 *   times, rethrowing the last error so nothing is masked. After the drop, the
 *   registry verifies that the database and all its sessions are gone.
 * - DETERMINISTIC TEARDOWN. `dropAll()` attempts every database, even after a
 *   failure, and throws one aggregate error at the end.
 */

export interface ScratchDatabase {
  readonly name: string;
  readonly url: string;
}

export interface ScratchDatabaseRegistry {
  create(label: string): Promise<ScratchDatabase>;
  dropAll(): Promise<void>;
}

const ADMIN_HOSTS = new Set(['127.0.0.1', 'localhost']);
const LABEL = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

function withDatabase(baseUrl: URL, database: string): string {
  const url = new URL(baseUrl.toString());
  url.pathname = `/${database}`;
  return url.toString();
}

/** The administrative DSN must be explicit, local, and the maintenance database. */
function assertAdminUrl(value: string | undefined): URL {
  if (!value) {
    throw new Error(
      'CORE_V2_IDENTITY_TEST_ADMIN_URL must be set explicitly (a role allowed to CREATE DATABASE on a local, ' +
        'disposable PostgreSQL server, pointing at its "postgres" maintenance database).',
    );
  }
  if (process.env.NEXUS_DISPOSABLE_POSTGRES !== '1') {
    throw new Error('SCRATCH_DATABASE_GUARD_FAILED:MISSING_DISPOSABLE_MARKER');
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('SCRATCH_DATABASE_GUARD_FAILED:INVALID_ADMIN_URL');
  }
  if (parsed.protocol !== 'postgresql:') {
    throw new Error(`SCRATCH_DATABASE_GUARD_FAILED:UNEXPECTED_PROTOCOL:${parsed.protocol}`);
  }
  if (!ADMIN_HOSTS.has(parsed.hostname)) {
    throw new Error(`SCRATCH_DATABASE_GUARD_FAILED:NON_LOCAL_HOST:${parsed.hostname}`);
  }
  if (parsed.pathname !== '/postgres') {
    throw new Error('SCRATCH_DATABASE_GUARD_FAILED:ADMIN_URL_MUST_TARGET_THE_postgres_MAINTENANCE_DATABASE');
  }
  return parsed;
}

async function withAdmin<T>(adminUrl: URL, work: (admin: Client) => Promise<T>): Promise<T> {
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    return await work(admin);
  } finally {
    await admin.end();
  }
}

export function createScratchDatabaseRegistry(adminDsn: string | undefined): ScratchDatabaseRegistry {
  const adminUrl = assertAdminUrl(adminDsn);
  // Hex only: the production-name guard rejects any name containing "prod".
  const runId = randomBytes(6).toString('hex');
  // Marqueur de propriete (pas un secret) : pose en COMMENT ON DATABASE et
  // relu avant toute destruction, pour n'effacer que nos propres bases.
  const ownershipMarker = `nexus-disposable-scratch core-v2-database-identity ${runId}`;
  const created: string[] = [];
  let sequence = 0;

  return {
    async create(label) {
      if (!LABEL.test(label)) throw new Error(`SCRATCH_DATABASE_GUARD_FAILED:INVALID_LABEL:${label}`);
      sequence += 1;
      const name = `nexus_disposable_${label}_${runId}${sequence}_test`;
      const url = withDatabase(adminUrl, name);
      assertDisposablePostgresUrl(url);

      await withAdmin(adminUrl, async (admin) => {
        await admin.query(`CREATE DATABASE "${name}"`);
        created.push(name);
        await admin.query(`COMMENT ON DATABASE "${name}" IS '${ownershipMarker}'`);
      });
      return { name, url };
    },

    async dropAll() {
      const failures: string[] = [];
      for (const name of [...created].reverse()) {
        try {
          await withAdmin(adminUrl, async (admin) => {
            const marker = await admin.query<{ comment: string | null }>(
              `SELECT shobj_description(oid, 'pg_database') AS comment FROM pg_database WHERE datname = $1`,
              [name],
            );
            if (marker.rowCount === 0) return; // already gone
            if (marker.rows[0].comment !== ownershipMarker) {
              throw new Error('database is not marked as owned by this run; refusing to drop it');
            }
            // CREATE/DROP DATABASE se serialisent : un DROP peut rester bloque
            // des dizaines de secondes si un autre est en vol. Mesure : un DROP
            // a pris 30 604 ms la ou les suivants prenaient 130 ms, ce qui
            // faisait depasser le budget du hook afterAll et marquait la suite
            // en echec sans qu'aucun test n'echoue.
            //
            // On BORNE l'attente au lieu d'allonger le timeout : un verrou qui
            // ne vient pas en 5 s echoue vite, et on reessaie un nombre FINI de
            // fois. Si cela persiste, l'erreur remonte — rien n'est masque.
            await admin.query(`SET lock_timeout = '5s'`);
            await admin.query(`SET statement_timeout = '15s'`);
            let dropped = false;
            let lastDropError: unknown = null;
            for (let attempt = 1; attempt <= 3 && !dropped; attempt += 1) {
              try {
                // Terminaison limitee a CETTE base : jamais de balayage global.
                await admin.query(
                  `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
                     WHERE datname = $1 AND pid <> pg_backend_pid()`,
                  [name],
                );
                await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
                dropped = true;
              } catch (error) {
                lastDropError = error;
                await new Promise((resolve) => { setTimeout(resolve, 250 * attempt); });
              }
            }
            if (!dropped) throw lastDropError ?? new Error('DROP DATABASE failed without an error');

            const database = await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [name]);
            const sessions = await admin.query(`SELECT 1 FROM pg_stat_activity WHERE datname = $1`, [name]);
            if (database.rowCount !== 0 || sessions.rowCount !== 0) {
              throw new Error('database or its sessions still present after DROP');
            }
          });
        } catch (error) {
          failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      created.length = 0;
      if (failures.length > 0) {
        throw new Error(`SCRATCH_DATABASE_TEARDOWN_FAILED\n${failures.join('\n')}`);
      }
    },
  };
}

/** Runs a single raw SQL statement against a scratch database's own DSN. */
export async function runRawSql(scratch: ScratchDatabase, sql: string): Promise<void> {
  assertDisposablePostgresUrl(scratch.url);
  const client = new Client({ connectionString: scratch.url });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}
