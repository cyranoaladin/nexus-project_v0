/**
 * TEST-ONLY canonical disposal mechanism for real-database fixtures.
 *
 * ## Why this exists
 *
 * Every real-DB suite used to hand-write its own teardown: delete these rows,
 * then those, then the users. That works only while the schema's ON DELETE
 * actions stay put. When #273 converted the account-history foreign keys from
 * CASCADE to RESTRICT, six CI lanes went red at once and roughly fifty more
 * teardown sites were one schema change away from the same failure — the
 * teardown order had been duplicated across the suite, so every copy had to be
 * found and corrected by hand.
 *
 * This module removes that duplication. Deletion order is DERIVED from the
 * live schema at runtime, so a future FK change is absorbed automatically
 * rather than discovered as a P2003 in someone's CI run.
 *
 * ## Three authorities, deliberately separate
 *
 * - `data/security/account-deletion-fk-manifest.json` is the BUSINESS policy
 *   authority: which account relations are protected, and why.
 * - `pg_constraint` on the migrated disposable database is the TECHNICAL
 *   dependency truth, and the only thing this module orders deletions by. The
 *   policy manifest is deliberately NOT used here: it classifies the protected
 *   account subset (107 entries) while the real schema carries far more edges
 *   (187 at the time of writing), and ordering by the smaller set would miss
 *   the transitive dependencies that broke the lanes in the first place.
 * - This module is the TEST FIXTURE DISPOSAL mechanism. It decides nothing
 *   about policy and defines no schema.
 *
 * ## Ownership rule
 *
 * A row belongs to the fixture when it is reachable from a declared fixture
 * root by following RESTRICT/NO ACTION or CASCADE edges downward:
 *
 * - CASCADE means the child dies with the parent — ownership.
 * - RESTRICT/NO ACTION means the child blocks the parent — it must be removed
 *   first, and in a disposable database it exists because the fixture made it.
 * - SET NULL is NOT followed. Such a reference is incidental, not ownership
 *   (`student_academic_enrollments.verifiedById` points at the admin who
 *   verified an enrollment; the enrollment belongs to the student, not to that
 *   admin). The database nulls those columns itself.
 *
 * Reachability is seeded ONLY from explicitly declared root ids. Nothing is
 * inferred from a table name, so shared reference data — course catalogues,
 * academic reference tables, configuration — is never in scope: no edge leads
 * to it from a fixture root.
 */
import type { Pool } from 'pg';
import { assertDisposablePostgresUrl } from './disposable-postgres';

/**
 * Most real-database suites hold a Prisma client; the ARIA lanes hold a `pg`
 * Pool. Both are accepted, because a helper only half the suites can call is
 * not a single authority — it is a second dialect plus the old duplication.
 */
export type FixtureDatabase = Pool | PrismaLikeClient;

interface PrismaLikeClient {
  $transaction<T>(fn: (tx: PrismaLikeTransaction) => Promise<T>): Promise<T>;
}

interface PrismaLikeTransaction {
  $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]): Promise<T[]>;
}

/** The only database surface this module needs, on one connection. */
interface FixtureTransaction {
  exec(sql: string, params?: readonly unknown[]): Promise<number>;
  select<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}

function isPrismaLike(db: FixtureDatabase): db is PrismaLikeClient {
  return typeof (db as PrismaLikeClient).$transaction === 'function';
}

/**
 * Run `fn` inside one transaction on one connection — required, because the
 * fixture scope lives in a TEMP TABLE that must outlive every statement in the
 * plan and vanish when the transaction ends.
 */
async function withFixtureTransaction<T>(
  db: FixtureDatabase,
  fn: (tx: FixtureTransaction) => Promise<T>,
): Promise<T> {
  if (isPrismaLike(db)) {
    return db.$transaction(async (tx) =>
      fn({
        exec: (sql, params = []) => tx.$executeRawUnsafe(sql, ...params),
        select: <R>(sql: string, params: readonly unknown[] = []) =>
          tx.$queryRawUnsafe<R>(sql, ...params),
      }),
    );
  }

  const client = await (db as Pool).connect();
  try {
    await client.query('BEGIN');
    const result = await fn({
      exec: async (sql, params = []) => (await client.query(sql, [...params])).rowCount ?? 0,
      select: async <R>(sql: string, params: readonly unknown[] = []) =>
        (await client.query(sql, [...params])).rows as R[],
    });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Root identities a fixture owns. Every cleanup must name its own scope. */
export interface DisposableFixtureScope {
  readonly userIds?: readonly string[];
  readonly studentIds?: readonly string[];
  readonly parentProfileIds?: readonly string[];
  readonly coachProfileIds?: readonly string[];
}

export interface FixtureCleanupReport {
  /** Tables the plan visited, in the order rows were removed. */
  readonly deletionOrder: readonly string[];
  /** Rows removed per table; tables with no fixture rows are omitted. */
  readonly deleted: Readonly<Record<string, number>>;
  /** FK edges nulled to break a dependency cycle, as `table.column`. */
  readonly clearedCycleEdges: readonly string[];
}

interface ForeignKeyEdge {
  readonly conname: string;
  readonly child: string;
  readonly parent: string;
  readonly childColumn: string;
  readonly action: 'RESTRICT' | 'NO ACTION' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
  readonly nullable: boolean;
}

interface SchemaGraph {
  readonly edges: readonly ForeignKeyEdge[];
  /**
   * Multi-column foreign keys. Scoping walks single-column references only —
   * a composite key would change what "the rows below this one" means — so
   * these are kept purely to prove they cost no reachability.
   */
  readonly compositeEdges: readonly Omit<ForeignKeyEdge, 'childColumn'>[];
  readonly primaryKey: Readonly<Record<string, string>>;
}

const ROOT_TABLE_BY_SCOPE_KEY = {
  userIds: 'users',
  studentIds: 'students',
  parentProfileIds: 'parent_profiles',
  coachProfileIds: 'coach_profiles',
} as const;

/** Edges that establish fixture ownership. SET NULL is deliberately absent. */
const OWNERSHIP_ACTIONS = new Set(['RESTRICT', 'NO ACTION', 'CASCADE']);

const ACTION_BY_CODE: Record<string, ForeignKeyEdge['action']> = {
  a: 'NO ACTION',
  r: 'RESTRICT',
  c: 'CASCADE',
  n: 'SET NULL',
  d: 'SET DEFAULT',
};

const graphCache = new WeakMap<object, Promise<SchemaGraph>>();

/**
 * Drop the cached foreign-key graph for a pool.
 *
 * The graph is read once per pool because the schema is fixed for the life of
 * a normal test process: migrations run before jest starts. A test that issues
 * DDL of its own is the exception, and must say so explicitly rather than
 * silently disposing fixtures against a stale graph.
 */
export function resetSchemaGraphCache(db: FixtureDatabase): void {
  graphCache.delete(db as object);
}

/**
 * Read the real foreign-key graph. Single-column foreign keys only: every
 * table in the account subgraph has a single-column `id` primary key and
 * single-column references, and a composite key would silently change the
 * scoping semantics, so it is rejected rather than guessed at.
 */
async function loadSchemaGraph(tx: FixtureTransaction): Promise<SchemaGraph> {
  const rows = await tx.select<{
    conname: string;
    child: string;
    parent: string;
    child_columns: string;
    confdeltype: string;
    child_notnull: boolean;
  }>(`
    SELECT c.conname,
           child.relname  AS child,
           parent.relname AS parent,
           (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
              FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS child_columns,
           c.confdeltype,
           (SELECT bool_and(a.attnotnull)
              FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS child_notnull
      FROM pg_constraint c
      JOIN pg_class child   ON child.oid  = c.conrelid
      JOIN pg_class parent  ON parent.oid = c.confrelid
      JOIN pg_namespace n   ON n.oid = child.relnamespace
     WHERE c.contype = 'f' AND n.nspname = 'public'
  `);

  const edges: ForeignKeyEdge[] = rows
    .filter((row) => !row.child_columns.includes(','))
    .map((row) => ({
      conname: row.conname,
      child: row.child,
      parent: row.parent,
      childColumn: row.child_columns,
      action: ACTION_BY_CODE[row.confdeltype] ?? 'NO ACTION',
      nullable: !row.child_notnull,
    }));

  const compositeEdges = rows
    .filter((row) => row.child_columns.includes(','))
    .map((row) => ({
      conname: row.conname,
      child: row.child,
      parent: row.parent,
      action: ACTION_BY_CODE[row.confdeltype] ?? ('NO ACTION' as const),
      nullable: !row.child_notnull,
    }));

  const pkRows = await tx.select<{ table_name: string; columns: string }>(`
    SELECT rel.relname AS table_name,
           (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
              FROM unnest(con.conkey) WITH ORDINALITY k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum) AS columns
      FROM pg_constraint con
      JOIN pg_class rel   ON rel.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
     WHERE con.contype = 'p' AND n.nspname = 'public'
  `);

  const primaryKey: Record<string, string> = {};
  for (const row of pkRows) {
    if (row.columns && !row.columns.includes(',')) primaryKey[row.table_name] = row.columns;
  }

  return { edges, compositeEdges, primaryKey };
}

/**
 * Order the tables reachable from `roots` so that every child is removed
 * before its parent, and report the cycle edges that had to be nulled first.
 *
 * A cycle is broken only at a NULLABLE foreign key, which is a change the
 * schema already permits. Constraints are never disabled, deferred, or
 * reordered arbitrarily: if no edge in a cycle is nullable, the plan fails and
 * names the cycle rather than guessing.
 */
export function planFixtureDeletion(
  graph: SchemaGraph,
  roots: readonly string[],
): { order: readonly string[]; cycleEdges: readonly ForeignKeyEdge[] } {
  const owning = graph.edges.filter((edge) => OWNERSHIP_ACTIONS.has(edge.action));
  const childrenOf = new Map<string, ForeignKeyEdge[]>();
  for (const edge of owning) {
    if (!childrenOf.has(edge.parent)) childrenOf.set(edge.parent, []);
    childrenOf.get(edge.parent)!.push(edge);
  }

  const order: string[] = [];
  const settled = new Set<string>();
  const cycleEdges: ForeignKeyEdge[] = [];
  const brokenEdges = new Set<string>();

  const visit = (table: string, stack: readonly string[]): void => {
    if (settled.has(table)) return;

    for (const edge of childrenOf.get(table) ?? []) {
      if (brokenEdges.has(edge.conname)) continue;

      if (stack.includes(edge.child) || edge.child === table) {
        // A cycle: prefer to break it here if this edge is optional.
        if (edge.nullable) {
          brokenEdges.add(edge.conname);
          cycleEdges.push(edge);
          continue;
        }
        const loop = [...stack.slice(stack.indexOf(edge.child)), table, edge.child];
        throw new Error(
          `REAL_DB_FIXTURE_CLEANUP_UNBREAKABLE_CYCLE: ${loop.join(' -> ')} ` +
            `(via ${edge.conname}; every edge in the cycle is NOT NULL, so no ` +
            `schema-respecting break point exists — resolve it in the schema, ` +
            `never by disabling constraints)`
        );
      }

      visit(edge.child, [...stack, table]);
    }

    settled.add(table);
    order.push(table);
  };

  for (const root of roots) visit(root, []);

  // Composite references are not walked, which is only safe while every table
  // they own is reachable some other way. Assert that rather than assume it:
  // a future composite-only relation would otherwise be skipped in silence,
  // and resurface as a P2003 in whichever lane happened to seed that row.
  const reachable = new Set(order);
  const unreachable = (graph.compositeEdges ?? [])
    .filter((edge) => OWNERSHIP_ACTIONS.has(edge.action))
    .filter((edge) => reachable.has(edge.parent) && !reachable.has(edge.child))
    .map((edge) => `${edge.child} (via ${edge.conname})`);
  if (unreachable.length > 0) {
    throw new Error(
      `REAL_DB_FIXTURE_CLEANUP_COMPOSITE_ONLY_DEPENDENCY: ${unreachable.join(', ')} ` +
        `is owned through a multi-column foreign key and by no single-column one, ` +
        `so fixture scoping cannot reach it. Give it a single-column reference or ` +
        `clean it explicitly in the suite that seeds it.`
    );
  }

  return { order, cycleEdges };
}

function quote(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`REAL_DB_FIXTURE_CLEANUP_UNSAFE_IDENTIFIER: ${identifier}`);
  }
  return `"${identifier}"`;
}

/**
 * Remove exactly the rows belonging to one fixture, and nothing else.
 *
 * Refuses to run unless the connection is positively identified as a
 * disposable test database by the shared guard.
 */
export async function cleanupDisposableTestFixture(
  db: FixtureDatabase,
  scope: DisposableFixtureScope,
  options: { databaseUrl?: string } = {},
): Promise<FixtureCleanupReport> {
  const databaseUrl =
    options.databaseUrl ?? process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
  // Fail closed: destructive by design, so identity must be proven, not assumed.
  assertDisposablePostgresUrl(databaseUrl);

  const seeds = Object.entries(ROOT_TABLE_BY_SCOPE_KEY)
    .map(([key, table]) => ({ table, ids: scope[key as keyof DisposableFixtureScope] ?? [] }))
    .filter((seed) => seed.ids.length > 0);

  if (seeds.length === 0) {
    throw new Error('REAL_DB_FIXTURE_CLEANUP_EMPTY_SCOPE: a fixture scope must name its own roots');
  }

  return withFixtureTransaction(db, async (tx) => {
    if (!graphCache.has(db as object)) graphCache.set(db as object, loadSchemaGraph(tx));
    const graph = await graphCache.get(db as object)!;

    const { order, cycleEdges } = planFixtureDeletion(graph, seeds.map((seed) => seed.table));

    await tx.exec(
      'CREATE TEMP TABLE _fixture_scope (tbl text NOT NULL, id text NOT NULL, PRIMARY KEY (tbl, id)) ON COMMIT DROP',
    );

    for (const seed of seeds) {
      await tx.exec(
        'INSERT INTO _fixture_scope (tbl, id) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING',
        [seed.table, [...seed.ids]],
      );
    }

    // Widen the scope parent-first, so a child is only ever collected after the
    // parent that owns it — this is what carries transitive ownership down
    // chains such as user -> student -> conversation -> turn.
    const owning = graph.edges.filter((edge) => OWNERSHIP_ACTIONS.has(edge.action));
    for (const table of [...order].reverse()) {
      for (const edge of owning.filter((candidate) => candidate.parent === table)) {
        const childKey = graph.primaryKey[edge.child];
        if (!childKey) continue;
        await tx.exec(
          `INSERT INTO _fixture_scope (tbl, id)
           SELECT $1, child.${quote(childKey)}::text
             FROM ${quote(edge.child)} child
            WHERE child.${quote(edge.childColumn)}::text IN (SELECT id FROM _fixture_scope WHERE tbl = $2)
           ON CONFLICT DO NOTHING`,
          [edge.child, edge.parent],
        );
      }
    }

    // Break each cycle at its optional edge before anything is removed.
    for (const edge of cycleEdges) {
      await tx.exec(
        `UPDATE ${quote(edge.child)}
            SET ${quote(edge.childColumn)} = NULL
          WHERE ${quote(graph.primaryKey[edge.child])}::text IN (SELECT id FROM _fixture_scope WHERE tbl = $1)`,
        [edge.child],
      );
    }

    const deleted: Record<string, number> = {};
    for (const table of order) {
      const key = graph.primaryKey[table];
      if (!key) continue;
      let removed: number;
      try {
        removed = await tx.exec(
          `DELETE FROM ${quote(table)}
            WHERE ${quote(key)}::text IN (SELECT id FROM _fixture_scope WHERE tbl = $1)`,
          [table],
        );
      } catch (error) {
        // 23503 here means the derived order did not account for some edge —
        // almost always a schema that changed after the graph was read. Say so,
        // instead of surfacing a bare P2003 from a teardown and leaving the
        // next reader to rediscover this whole investigation.
        const code = (error as { code?: string }).code;
        const message = (error as { message?: string }).message ?? '';
        if (code === '23503' || /foreign key constraint/i.test(message)) {
          throw new Error(
            `REAL_DB_FIXTURE_CLEANUP_ORDER_INCOMPLETE: deleting "${table}" violated ` +
              `${(error as { constraint?: string }).constraint ?? (message || 'a foreign key')}. ` +
              `The cached schema graph no longer matches the database — call ` +
              `resetSchemaGraphCache(db) after any DDL, or re-run migrations.`,
            { cause: error as Error },
          );
        }
        throw error;
      }
      if (removed) deleted[table] = removed;
    }

    return {
      deletionOrder: order,
      deleted,
      clearedCycleEdges: cycleEdges.map((edge) => `${edge.child}.${edge.childColumn}`),
    };
  });
}
