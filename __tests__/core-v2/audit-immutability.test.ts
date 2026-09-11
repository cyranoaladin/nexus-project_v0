/**
 * §Z — the audit trail is append-only at the DATABASE level: Prisma update /
 * delete and raw SQL UPDATE / DELETE are all refused by the trigger, so no
 * application path can rewrite history.
 */
import { appendAuditEvent } from '@/lib/core-v2/audit';
import { setupServiceHarness } from './helpers/service-harness';

const h = setupServiceHarness();

describe('audit_events is append-only', () => {
  test('insert succeeds; every mutation path is refused; the row is unchanged afterwards', async () => {
    const { client } = h;
    await appendAuditEvent(client, {
      actorUserId: h.admin.userId,
      action: 'household.created',
      subjectType: 'Household',
      subjectId: 'h1',
      correlationId: 'c1',
      metadata: { primaryContactUserId: 'p1' },
    });
    const row = await client.auditEvent.findFirstOrThrow({ where: { subjectId: 'h1' } });

    await expect(client.auditEvent.update({ where: { id: row.id }, data: { action: 'household.parent_attached' } })).rejects.toThrow(/append-only/);
    await expect(client.auditEvent.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/);
    await expect(client.auditEvent.updateMany({ data: { correlationId: 'rewritten' } })).rejects.toThrow(/append-only/);
    await expect(client.auditEvent.deleteMany({})).rejects.toThrow(/append-only/);
    await expect(client.$executeRawUnsafe(`UPDATE "audit_events" SET "subjectId" = 'x'`)).rejects.toThrow(/append-only/);
    await expect(client.$executeRawUnsafe(`DELETE FROM "audit_events"`)).rejects.toThrow(/append-only/);

    const after = await client.auditEvent.findUniqueOrThrow({ where: { id: row.id } });
    expect(after).toEqual(row);
    expect(await client.auditEvent.count()).toBe(1);
  });

  test('the actor column is not a foreign key: an audit row outlives its actor account', async () => {
    const { client } = h;
    const ghost = await client.user.create({ data: { role: 'ASSISTANTE', email: 'ghost@synthetic.test' } });
    await appendAuditEvent(client, { actorUserId: ghost.id, action: 'student.created', subjectType: 'Student', subjectId: 's1', correlationId: 'c2' });
    await client.user.delete({ where: { id: ghost.id } });
    expect((await client.auditEvent.findFirstOrThrow({ where: { subjectId: 's1' } })).actorUserId).toBe(ghost.id);
  });
});
