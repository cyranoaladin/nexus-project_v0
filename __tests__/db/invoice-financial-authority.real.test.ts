/** @jest-environment node */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool, type PoolClient } from 'pg';
import { assertDisposableE2eDatabase } from '../../e2e/helpers/disposable-database';

const migration = readFileSync('prisma/migrations/20261004170000_invoice_financial_authority/migration.sql', 'utf8');

describe('additive invoice financial authority on isolated PostgreSQL predecessor', () => {
  let pool: Pool;
  let client: PoolClient;
  const namespace = `finance_authority_${randomUUID().replaceAll('-', '')}`;

  beforeAll(async () => {
    const database = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!database) throw new Error('DISPOSABLE_DATABASE_REQUIRED');
    assertDisposableE2eDatabase(database);
    pool = new Pool({ connectionString: database });
    client = await pool.connect();
    await client.query('BEGIN');
    if (!/^[a-z0-9_]+$/.test(namespace)) throw new Error('INVALID_FIXTURE_NAMESPACE');
    await client.query(`CREATE SCHEMA "${namespace}"`);
    await client.query(`SET LOCAL search_path TO "${namespace}"`);
    await client.query('CREATE TABLE users (id TEXT PRIMARY KEY)');
    await client.query('CREATE TABLE invoices (id TEXT PRIMARY KEY, status TEXT NOT NULL, "customerEmail" TEXT, "beneficiaryUserId" TEXT)');
    await client.query("INSERT INTO users (id) VALUES ('payer'), ('delegate'), ('other'), ('staff')");
    await client.query("INSERT INTO invoices (id,status) VALUES ('legacy','PAID'), ('owned','PAID'), ('draft','DRAFT')");
    // DDL interruption is rolled back before replaying the exact versioned file.
    await client.query('SAVEPOINT interrupted_expand');
    await client.query(migration.slice(0, migration.indexOf('-- CreateTable')));
    await client.query('ROLLBACK TO SAVEPOINT interrupted_expand');
    await client.query(migration);
    await client.query("UPDATE invoices SET \"payerUserId\"='payer' WHERE id IN ('owned','draft')");
  });
  beforeEach(async () => { await client.query('SAVEPOINT test_case'); });
  afterEach(async () => { await client.query('ROLLBACK TO SAVEPOINT test_case'); });
  afterAll(async () => {
    if (client) { await client.query('ROLLBACK'); client.release(); }
    if (pool) await pool.end();
  });

  const grant = (id: string, payer = 'payer', delegate = 'delegate', interval = '1 day') => client.query(
    `INSERT INTO invoice_financial_delegations (id,"invoiceId","payerUserId","delegateUserId","requestKey","expiresAt")
     VALUES ($1,'owned',$2,$3,$1,CURRENT_TIMESTAMP + $4::interval)`, [id, payer, delegate, interval]);

  it('preserves predecessor invoices and leaves ambiguous payer identities NULL', async () => {
    const rows = await client.query('SELECT id,"payerUserId" FROM invoices ORDER BY id');
    expect(rows.rowCount).toBe(3);
    expect(rows.rows.find(row => row.id === 'legacy').payerUserId).toBeNull();
  });
  it('rejects a delegation attributed to a different payer', async () => {
    await expect(grant('wrong-payer', 'other')).rejects.toMatchObject({ code: '23503' });
  });
  it('rejects duplicate delegation idempotency keys', async () => {
    await grant('one');
    await expect(grant('one')).rejects.toMatchObject({ code: '23505' });
  });
  it('rejects invalid delegation expiry', async () => {
    await expect(grant('expired-window', 'payer', 'delegate', '-1 day')).rejects.toMatchObject({ code: '23514' });
  });
  it('cannot silently change the payer of a delegated invoice', async () => {
    await grant('immutable-payer');
    await expect(client.query("UPDATE invoices SET \"payerUserId\"='other' WHERE id='owned'"))
      .rejects.toMatchObject({ code: '23503' });
  });
  it.each(['UPDATE invoice_financial_access_audits SET action=\'CHANGED\'', 'DELETE FROM invoice_financial_access_audits'])(
    'keeps financial access evidence append-only: %s', async statement => {
      await client.query(`INSERT INTO invoice_financial_access_audits (id,"invoiceId","actorUserId",action,"requestKey")
        VALUES ('audit','owned','staff','PAYER_ASSIGNED','audit-request')`);
      await expect(client.query(statement)).rejects.toMatchObject({ code: '23514' });
    });
  it('rejects self delegation', async () => {
    await expect(grant('self', 'payer', 'payer')).rejects.toMatchObject({ code: '23514' });
  });
  it('cannot attribute a delegation audit to another invoice', async () => {
    await grant('audit-bound');
    await expect(client.query(`INSERT INTO invoice_financial_access_audits
      (id,"invoiceId","delegationId","actorUserId",action,"requestKey")
      VALUES ('wrong-invoice','draft','audit-bound','staff','DELEGATION_GRANTED','wrong-invoice')`))
      .rejects.toMatchObject({ code: '23503' });
  });
  it('limits audit action to non-sensitive lifecycle codes', async () => {
    await expect(client.query(`INSERT INTO invoice_financial_access_audits
      (id,"invoiceId","actorUserId",action,"requestKey")
      VALUES ('bad-action','owned','staff','SYNTHETIC_UNSUPPORTED_ACTION','bad-action')`))
      .rejects.toMatchObject({ code: '23514' });
  });

});
