import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertDisposablePostgresUrl } from './disposable-postgres';
assertDisposablePostgresUrl(process.env.DATABASE_URL ?? '');
const db = new PrismaClient();
const phase = process.argv[2]; const proof = process.argv[3];
const actor = 'synthetic-migration-stage-actor'; const lead = 'synthetic-migration-stage-lead';
async function rowHash() {
  const row = await db.stageReservation.findUniqueOrThrow({ where: { id: lead } });
  return createHash('sha256').update(JSON.stringify(row)).digest('hex');
}
async function main() {
  if (phase === 'seed') {
    await db.user.create({ data: { id: actor, email: 'synthetic-migration-actor@example.test', role: 'ADMIN' } });
    await db.stageReservation.create({ data: { id: lead, email: 'synthetic-migration-lead@example.test', academyId: 'synthetic-migration-stage',
      academyTitle: 'Synthetic legacy lead', parentName: 'Synthetic Parent', phone: '55000003', classe: 'Terminale', price: 350 } });
    writeFileSync(proof, await rowHash(), { mode: 0o600 });
    console.log('OLD_SCHEMA_SYNTHETIC_ROWS_CREATED=2');
  } else if (phase === 'interrupt') {
    const sql = readFileSync('prisma/migrations/20261004214500_stage_reservation_decision_audit/migration.sql', 'utf8');
    const connection = new Client({ connectionString: process.env.DATABASE_URL });
    await connection.connect();
    await connection.query(sql.slice(0, sql.lastIndexOf('COMMIT;')));
    await connection.end(); // Connection interruption before COMMIT must roll back all DDL.
    const rows = await db.$queryRaw<Array<{ table: string | null }>>`SELECT to_regclass('public.stage_reservation_decision_audits')::text AS "table"`;
    if (rows[0].table !== null) throw new Error('INTERRUPTED_DDL_NOT_ATOMIC');
    if (await rowHash() !== readFileSync(proof, 'utf8')) throw new Error('OLD_ROW_CHANGED');
    console.log('INTERRUPTED_TRANSACTION_ROLLED_BACK=1');
  } else if (phase === 'verify-old') {
    if (await rowHash() !== readFileSync(proof, 'utf8')) throw new Error('OLD_ROW_CHANGED');
    if (await db.user.count({ where: { id: actor } }) !== 1) throw new Error('OLD_ACTOR_LOST');
    console.log('REPRESENTATIVE_OLD_ROWS_HASH_PRESERVED=1');
  } else if (phase === 'verify-new') {
    if (await rowHash() !== readFileSync(proof, 'utf8')) throw new Error('OLD_ROW_CHANGED');
    if (await db.stageReservationDecisionAudit.count() !== 0) throw new Error('HISTORICAL_AUDIT_INVENTED');
    console.log('NEW_AUDIT_COUNT=0;OLD_ROW_HASH_PRESERVED=1');
  } else throw new Error('UNSUPPORTED_FIXTURE_PHASE');
}
main().finally(() => db.$disconnect()).catch(error => { console.error('FIXTURE_VERIFICATION_FAILED', typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'NO_DRIVER_CODE'); process.exitCode = 1; });
