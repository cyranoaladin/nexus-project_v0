import { Client } from 'pg';

export interface ScratchDatabase {
  readonly name: string;
  readonly url: string;
  drop(): Promise<void>;
}

function withDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

/**
 * Creates a throwaway PostgreSQL database on the same server as `baseUrl`,
 * for tests that need a second, genuinely distinct database — e.g. one with
 * no Core v2 schema at all, to prove the catastrophic-misroute case
 * (CORE_V2_DATABASE_URL pointing at a real database that is not Core v2).
 * Connects to the server's `postgres` maintenance database to issue
 * CREATE/DROP DATABASE; never touches `baseUrl`'s own database.
 */
export async function createScratchDatabase(
  baseUrl: string,
  namePrefix: string,
): Promise<ScratchDatabase> {
  const name = `${namePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const adminUrl = withDatabase(baseUrl, 'postgres');

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  return {
    name,
    url: withDatabase(baseUrl, name),
    async drop() {
      const dropAdmin = new Client({ connectionString: adminUrl });
      await dropAdmin.connect();
      try {
        await dropAdmin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      } finally {
        await dropAdmin.end();
      }
    },
  };
}

/** Runs a single raw SQL statement against `url`, for test-only DB setup/corruption. */
export async function runRawSql(url: string, sql: string): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}
