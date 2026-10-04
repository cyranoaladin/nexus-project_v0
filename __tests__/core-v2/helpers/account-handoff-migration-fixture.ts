import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Client } from 'pg';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { requireCoreV2Client, disconnectCoreV2Client } from '@/lib/core-v2/client';
import { CoreV2AriaConversationRepository } from '@/lib/core-v2/aria/conversation-repository';

assertDisposablePostgresUrl(process.env.CORE_V2_DATABASE_URL ?? '');
const phase = process.argv[2]; const proof = process.argv[3];
const userId = 'synthetic-core-migration-user';
const householdId = 'synthetic-core-migration-household';
const studentId = 'synthetic-core-migration-student';
async function main() {
  const db = await requireCoreV2Client();
  async function fixtureHash() {
    const rows = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: userId } }),
      db.household.findUniqueOrThrow({ where: { id: householdId } }),
      db.student.findUniqueOrThrow({ where: { id: studentId } }),
      db.ariaConversationCoreV2.findMany({ where: { studentId }, orderBy: { id: 'asc' } }),
      db.ariaConversationTurnCoreV2.findMany({ where: { subjectStudentId: studentId }, orderBy: { id: 'asc' } }),
      db.ariaMessageCoreV2.findMany({ where: { conversation: { studentId } }, orderBy: { id: 'asc' } }),
      db.coreV2JobOutbox.findMany({ where: { aggregateType: 'AriaConversationTurnCoreV2' }, orderBy: { id: 'asc' } }),
    ]);
    return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  }
  if (phase === 'seed') {
    await db.household.create({ data: { id: householdId } });
    await db.user.create({ data: { id: userId, role: 'ELEVE', email: 'synthetic-core-migration@example.test', accountStatus: 'ACTIVE' } });
    await db.student.create({ data: { id: studentId, householdId, userId } });
    await new CoreV2AriaConversationRepository(db).reserveTurn({
      actorUserId: userId, subjectStudentId: studentId, clientRequestId: 'synthetic-migration-command',
      requestFingerprint: 'e'.repeat(64), courseKey: 'philosophie-terminale',
      message: 'Synthetic migration fixture only', academicSnapshot: { gradeLevel: 'TERMINALE' },
      pedagogicalMode: 'DISCOVERY', agentRole: 'TUTOR', modelPolicy: { policyId: 'synthetic-fixture' },
      now: new Date('2099-01-01T00:00:00Z'), pendingRecoveryAt: new Date('2099-01-01T00:00:30Z'),
    });
    writeFileSync(proof, await fixtureHash(), { mode: 0o600 });
    console.log('OLD_CORE_NATIVE_ARIA_FIXTURE_SEEDED=1');
  } else if (phase === 'interrupt') {
    const sql = readFileSync('core-v2/prisma/migrations/0024_core_v2_account_email_handoff/migration.sql', 'utf8');
    const connection = new Client({ connectionString: process.env.CORE_V2_DATABASE_URL });
    await connection.connect();
    await connection.query(sql.slice(0, sql.lastIndexOf('COMMIT;')));
    await connection.end();
    const rows = await db.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'CoreV2JobType' AND e.enumlabel = 'ACCOUNT_EMAIL_HANDOFF'`;
    if (rows[0].count !== 0) throw new Error('CORE_INTERRUPTED_ENUM_NOT_ROLLED_BACK');
    if (await fixtureHash() !== readFileSync(proof, 'utf8')) throw new Error('CORE_OLD_ROWS_CHANGED');
    console.log('CORE_INTERRUPTED_ENUM_AND_CONSTRAINT_ROLLED_BACK=1');
  } else if (phase === 'verify') {
    if (await fixtureHash() !== readFileSync(proof, 'utf8')) throw new Error('CORE_OLD_ROWS_CHANGED');
    console.log('CORE_OLD_NATIVE_ROWS_HASH_PRESERVED=1');
  } else throw new Error('CORE_FIXTURE_PHASE_INVALID');
}
main().finally(() => disconnectCoreV2Client()).catch(() => {
  console.error('CORE_ACCOUNT_HANDOFF_MIGRATION_FIXTURE_FAILED'); process.exitCode = 1;
});
