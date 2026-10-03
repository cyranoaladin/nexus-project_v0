/** @jest-environment node */
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool, type PoolClient } from 'pg';
import { registerForAriaWorkshop } from '@/lib/aria/application/workshop/register-for-workshop';
import { scheduleAriaWorkshopSession } from '@/lib/aria/application/workshop/schedule-workshop';
import { assertDisposablePostgresUrl } from '../helpers/disposable-postgres';
import { seedAriaRealDbFixture, cleanupAriaRealDbFixture, type AriaRealDbFixtureIds } from '../helpers/aria-real-db';
import { cleanupDisposableTestFixture } from '../helpers/real-db-fixture-cleanup';

const courseKey = 'eds-maths-premiere';
const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
describe('workshop admission concurrency and durable notification', () => {
 let pool: Pool;
 let children: AriaRealDbFixtureIds[];
 let staff: string;
 const sessions: string[] = [];
 beforeAll(async () => {
  assertDisposablePostgresUrl(databaseUrl);
  pool = new Pool({ connectionString: databaseUrl });
  children = [await seedAriaRealDbFixture(pool, courseKey), await seedAriaRealDbFixture(pool, courseKey)];
  for (const child of children) {
   await pool.query(`UPDATE entitlements SET "ariaTier"='ARIA_SUIVI' WHERE id=$1`, [child.entitlement]);
   await pool.query(`UPDATE users SET "firstName"='Synthétique' WHERE id=ANY($1::text[])`, [[child.parentUser, child.studentUser]]);
  }
  staff = randomUUID();
  await pool.query(`INSERT INTO users(id,email,role,"updatedAt") VALUES($1,$2,'ASSISTANTE',NOW())`, [staff, `staff-${staff}@invalid.test`]);
 });
 afterAll(async () => {
  await pool.query(`DELETE FROM canonical_job_outbox WHERE "jobType"='SEND_EMAIL' AND "aggregateId"=ANY($1::text[])`, [children.map(c => c.parentUser)]);
  await pool.query(`DELETE FROM aria_workshop_attendees WHERE "sessionId"=ANY($1::text[])`, [sessions]);
  await pool.query(`DELETE FROM aria_workshop_sessions WHERE id=ANY($1::text[])`, [sessions]);
  for (const child of children) await cleanupAriaRealDbFixture(pool, child);
  await cleanupDisposableTestFixture(pool, { userIds: [staff] });
  await pool.end();
 });
 async function workshop(capacity: number | null = 1) {
  const session = await scheduleAriaWorkshopSession({ actor: { userId: staff, role: 'ASSISTANTE' }, courseKey,
   title: 'Atelier synthétique concurrence', scheduledDate: new Date('2026-11-10T00:00:00Z'),
   startTime: '14:00', endTime: '15:00', modality: 'ONLINE', capacity });
  sessions.push(session.id); return session;
 }
 function register(sessionId: string, child = children[0]) {
  return registerForAriaWorkshop({ actor: { userId: child.studentUser, role: 'ELEVE' }, workshopSessionId: sessionId });
 }
 async function blockedAdmissions(expected: number) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
   const { rows } = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM pg_stat_activity
    WHERE datname=current_database() AND wait_event_type='Lock'
    AND (query LIKE '%aria_workshop_sessions%' OR query LIKE '%aria_workshop_attendees%')`);
   if (Number(rows[0].count) >= expected) return;
   await delay(10);
  }
  throw new Error('SYNTHETIC_ADMISSIONS_NOT_BLOCKED');
 }
 async function hold(sessionId: string): Promise<PoolClient> {
  const client = await pool.connect(); await client.query('BEGIN');
  await client.query('SELECT id FROM aria_workshop_sessions WHERE id=$1 FOR UPDATE', [sessionId]); return client;
 }
 it('admits exactly one of two eligible students competing for the final place', async () => {
  const session = await workshop(); const lock = await hold(session.id);
  const results = Promise.allSettled(children.map(child => register(session.id, child)));
  try { await blockedAdmissions(2); } finally { await lock.query('COMMIT'); lock.release(); }
  const outcomes = await results;
  expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.filter(r => r.status === 'rejected')).toHaveLength(1);
  const rejected = outcomes.find(r => r.status === 'rejected');
  if (rejected?.status === 'rejected') expect(rejected.reason).toMatchObject({ status: 409 });
  expect((await pool.query('SELECT id FROM aria_workshop_attendees WHERE "sessionId"=$1', [session.id])).rowCount).toBe(1);
 });
 it('replays concurrent registration without an error, duplicate admission or duplicate intent', async () => {
  const session = await workshop();
  const beforeIntents = (await pool.query('SELECT id FROM canonical_job_outbox WHERE \"aggregateId\"=$1 AND \"jobType\"=\'SEND_EMAIL\'', [children[0].parentUser])).rowCount ?? 0;
  const lock = await hold(session.id);
  const results = Promise.allSettled([register(session.id), register(session.id)]);
  try { await blockedAdmissions(2); } finally { await lock.query('COMMIT'); lock.release(); }
  expect((await results).every(r => r.status === 'fulfilled')).toBe(true);
  expect((await pool.query('SELECT id FROM aria_workshop_attendees WHERE "sessionId"=$1', [session.id])).rowCount).toBe(1);
  const { rows } = await pool.query('SELECT id FROM canonical_job_outbox WHERE \"aggregateId\"=$1 AND \"jobType\"=\'SEND_EMAIL\'', [children[0].parentUser]);
  expect(rows).toHaveLength(beforeIntents + 1);
 });
 it('does not admit a student after cancellation committed while registration was blocked', async () => {
  const session = await workshop(); const lock = await hold(session.id);
  await lock.query(`UPDATE aria_workshop_sessions SET status='CANCELLED' WHERE id=$1`, [session.id]);
  const outcome = Promise.allSettled([register(session.id)]);
  try { await blockedAdmissions(1); } finally { await lock.query('COMMIT'); lock.release(); }
  const results = await outcome;
  expect(results[0].status).toBe('rejected');
  expect((await pool.query('SELECT id FROM aria_workshop_attendees WHERE "sessionId"=$1', [session.id])).rowCount).toBe(0);
 });
 it('does not admit under a course that changed while authorization was in flight', async () => {
  const session = await workshop(); const lock = await hold(session.id);
  await lock.query('UPDATE aria_workshop_sessions SET "courseKey"=$1 WHERE id=$2', ['eds-nsi-premiere', session.id]);
  const outcome = Promise.allSettled([register(session.id)]);
  try { await blockedAdmissions(1); } finally { await lock.query('COMMIT'); lock.release(); }
  expect((await outcome)[0].status).toBe('rejected');
  expect((await pool.query('SELECT id FROM aria_workshop_attendees WHERE "sessionId"=$1', [session.id])).rowCount).toBe(0);
 });
 it('rejects direct SQL admission to a cancelled session', async () => {
  const session = await workshop();
  await pool.query(`UPDATE aria_workshop_sessions SET status='CANCELLED' WHERE id=$1`, [session.id]);
  await expect(pool.query(`INSERT INTO aria_workshop_attendees(id,"sessionId","studentId","updatedAt") VALUES($1,$2,$3,NOW())`, [randomUUID(), session.id, children[0].student])).rejects.toMatchObject({ code: '23514', constraint: 'aria_workshop_admission_status' });
 });
 it('rejects a non-positive new capacity at the database boundary', async () => {
  const session = await workshop();
  await expect(pool.query('UPDATE aria_workshop_sessions SET capacity=0 WHERE id=$1', [session.id])).rejects.toMatchObject({ code: '23514', constraint: 'aria_workshop_capacity_positive' });
 });
 it('protects capacity against simultaneous direct SQL admissions too', async () => {
  const session = await workshop(); const lock = await hold(session.id);
  const results = Promise.allSettled(children.map(child => pool.query(`INSERT INTO aria_workshop_attendees
   (id,"sessionId","studentId",status,"registeredAt","updatedAt") VALUES($1,$2,$3,'REGISTERED',NOW(),NOW())`, [randomUUID(), session.id, child.student])));
  try { await blockedAdmissions(2); } finally { await lock.query('COMMIT'); lock.release(); }
  const outcomes = await results;
  for (const result of outcomes) if (result.status === 'rejected') console.info({ event: 'SYNTHETIC_DIRECT_ADMISSION_REFUSAL', code: result.reason.code, constraint: result.reason.constraint });
  expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect((await pool.query('SELECT id FROM aria_workshop_attendees WHERE "sessionId"=$1', [session.id])).rowCount).toBe(1);
 });
 it('rejects admission from a stale REPEATABLE READ snapshot', async () => {
  const session = await workshop();
  const first = await pool.connect(), second = await pool.connect();
  let secondError: { code?: string } | undefined;
  try {
   for (const client of [first, second]) {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    expect((await client.query('SELECT id FROM aria_workshop_attendees WHERE "sessionId"=$1', [session.id])).rowCount).toBe(0);
   }
   const sql = `INSERT INTO aria_workshop_attendees(id,"sessionId","studentId","updatedAt") VALUES($1,$2,$3,NOW())`;
   await first.query(sql, [randomUUID(), session.id, children[0].student]); await first.query('COMMIT');
   try {
    await second.query(sql, [randomUUID(), session.id, children[1].student]); await second.query('COMMIT');
   } catch (error) { secondError = error as { code?: string }; await second.query('ROLLBACK'); }
   expect(secondError).toMatchObject({ code: '40001' });
   expect((await pool.query('SELECT id FROM aria_workshop_attendees WHERE "sessionId"=$1', [session.id])).rowCount).toBe(1);
  } finally {
   await first.query('ROLLBACK'); await second.query('ROLLBACK'); first.release(); second.release();
  }
 });
 it('rejects reducing capacity below existing attendance without rewriting history', async () => {
  const session = await workshop(2);
  await register(session.id, children[0]); await register(session.id, children[1]);
  await expect(pool.query('UPDATE aria_workshop_sessions SET capacity=1 WHERE id=$1', [session.id])).rejects.toMatchObject({ code: '23514' });
  expect((await pool.query('SELECT capacity FROM aria_workshop_sessions WHERE id=$1', [session.id])).rows[0].capacity).toBe(2);
 });
 it('rolls back admission when its durable email intent cannot be persisted, then retries once', async () => {
  const session = await workshop();
  // Only this disposable fixture parent is affected; no production SQL.
  await pool.query(`CREATE FUNCTION recovery_test_workshop_email_failure() RETURNS trigger LANGUAGE plpgsql AS $$
   BEGIN IF NEW."aggregateId"='${children[0].parentUser}' AND NEW."jobType"='SEND_EMAIL' THEN
    RAISE EXCEPTION 'SYNTHETIC_EMAIL_INTENT_UNAVAILABLE'; END IF; RETURN NEW; END $$`);
  await pool.query('CREATE TRIGGER recovery_test_workshop_email_failure BEFORE INSERT ON canonical_job_outbox FOR EACH ROW EXECUTE FUNCTION recovery_test_workshop_email_failure()');
  try {
   await expect(register(session.id)).rejects.toThrow();
   expect((await pool.query('SELECT id FROM aria_workshop_attendees WHERE "sessionId"=$1', [session.id])).rowCount).toBe(0);
  } finally {
   await pool.query('DROP TRIGGER recovery_test_workshop_email_failure ON canonical_job_outbox');
   await pool.query('DROP FUNCTION recovery_test_workshop_email_failure()');
  }
  await expect(register(session.id)).resolves.toEqual({ status: 'REGISTERED' });
  expect((await pool.query('SELECT id FROM aria_workshop_attendees WHERE "sessionId"=$1', [session.id])).rowCount).toBe(1);
 });
});
