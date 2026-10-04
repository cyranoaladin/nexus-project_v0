jest.unmock('@/lib/prisma');
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { declineLegacyStageLead } from '@/lib/stages/decline-legacy-lead';
const prefix = `synthetic-decision-${randomUUID()}`;
let actorId: string;
beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  actorId = (await prisma.user.create({ data: { email: `${prefix}@example.test`, role: 'ADMIN' } })).id;
});
// Append-only histories are deliberately not deleted. The harness destroys this
// isolated, explicitly disposable database after the suite; never use production.
afterAll(async () => { await prisma.$disconnect(); });
async function createLead(richStatus: 'PENDING' | null = null) {
  const id = randomUUID();
  return prisma.stageReservation.create({ data: { email: `${prefix}-${id}@example.test`, academyId: prefix,
    parentName: 'Synthetic Parent', phone: '55000003', classe: 'Terminale', academyTitle: 'Synthetic legacy lead', price: 350, richStatus } });
}
const command = (reservationId: string, requestId = randomUUID()) => ({ actorAuthority: 'V1' as const, actorUserId: actorId, reservationId, requestId });
test('concurrent identical retries produce one audited decision and preserve financial state', async () => {
  const lead = await createLead(); const input = command(lead.id);
  const results = await Promise.all(Array.from({ length: 8 }, () => declineLegacyStageLead(input)));
  expect(results).toEqual(Array(8).fill('DECLINED'));
  expect(await prisma.stageReservationDecisionAudit.count({ where: { reservationId: lead.id } })).toBe(1);
  const after = await prisma.stageReservation.findUniqueOrThrow({ where: { id: lead.id } });
  expect(after.status).toBe('CANCELLED');
  expect(after.richStatus).toBe('CANCELLED');
  expect(await prisma.stageReservationDecisionAudit.findFirst({ where: { reservationId: lead.id }, select: { previousRichStatus: true, nextRichStatus: true } })).toEqual({ previousRichStatus: null, nextRichStatus: 'CANCELLED' });
  expect(after.paymentStatus).toBe(lead.paymentStatus);
  expect(after.price).toBe(lead.price);
  expect(await declineLegacyStageLead(input)).toBe('DECLINED');
});
test('different concurrent commands cannot both change one pending-rich lead', async () => {
  const lead = await createLead('PENDING');
  const results = await Promise.all([declineLegacyStageLead(command(lead.id)), declineLegacyStageLead(command(lead.id))]);
  expect(results.filter(result => result === 'DECLINED')).toHaveLength(1);
  expect(results.filter(result => result === 'STATE_CONFLICT')).toHaveLength(1);
  expect(await prisma.stageReservationDecisionAudit.findFirst({ where: { reservationId: lead.id }, select: { previousRichStatus: true, nextRichStatus: true } })).toEqual({ previousRichStatus: 'PENDING', nextRichStatus: 'CANCELLED' });
  const after = await prisma.stageReservation.findUniqueOrThrow({ where: { id: lead.id } });
  expect(after.richStatus ?? after.status).toBe('CANCELLED');
  expect(await prisma.stageReservationDecisionAudit.count({ where: { reservationId: lead.id } })).toBe(1);
});
test('a reused command ID cannot cancel a second lead under concurrency', async () => {
  const leads = await Promise.all([createLead(), createLead()]); const requestId = randomUUID();
  const results = await Promise.all(leads.map(lead => declineLegacyStageLead(command(lead.id, requestId))));
  expect(results.filter(result => result === 'DECLINED')).toHaveLength(1);
  expect(results.filter(result => result === 'COMMAND_CONFLICT')).toHaveLength(1);
  const rows = await prisma.stageReservation.findMany({ where: { id: { in: leads.map(lead => lead.id) } } });
  expect(rows.filter(row => row.status === 'CANCELLED')).toHaveLength(1);
  expect(rows.filter(row => row.status === 'PENDING')).toHaveLength(1);
});
test('a failed audit FK rolls back a synthetic direct-writer transaction', async () => {
  const lead = await createLead();
  await expect(prisma.$transaction(async tx => {
    await tx.stageReservation.update({ where: { id: lead.id }, data: { status: 'CANCELLED', richStatus: 'CANCELLED' } });
    await tx.stageReservationDecisionAudit.create({ data: { reservationId: lead.id, actorUserId: 'synthetic-absent-actor',
      requestKey: `synthetic-absent-actor:${randomUUID()}`, action: 'LEAD_DECLINED', previousStatus: 'PENDING',
      nextStatus: 'CANCELLED', previousRichStatus: null, nextRichStatus: 'CANCELLED' } });
  })).rejects.toMatchObject({ code: 'P2003' });
  expect((await prisma.stageReservation.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('PENDING');
  expect(await prisma.stageReservationDecisionAudit.count({ where: { reservationId: lead.id } })).toBe(0);
});
test('database rejects rewriting or deleting decision history', async () => {
  const lead = await createLead(); await declineLegacyStageLead(command(lead.id));
  const audit = await prisma.stageReservationDecisionAudit.findFirstOrThrow({ where: { reservationId: lead.id } });
  await expect(prisma.stageReservationDecisionAudit.update({ where: { id: audit.id }, data: { action: 'LEAD_DECLINED' } })).rejects.toThrow('STAGE_RESERVATION_DECISION_AUDIT_APPEND_ONLY');
  await expect(prisma.stageReservationDecisionAudit.delete({ where: { id: audit.id } })).rejects.toThrow('STAGE_RESERVATION_DECISION_AUDIT_APPEND_ONLY');
  expect(await prisma.stageReservationDecisionAudit.count({ where: { reservationId: lead.id } })).toBe(1);
});

test('an absent actor is refused before any lead mutation', async () => {
  const lead = await createLead();
  expect(await declineLegacyStageLead({ ...command(lead.id), actorUserId: 'synthetic-absent-actor' })).toBe('FORBIDDEN');
  expect((await prisma.stageReservation.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('PENDING');
  expect(await prisma.stageReservationDecisionAudit.count({ where: { reservationId: lead.id } })).toBe(0);
});
test('a revoked staff role cannot obtain a previous successful command response', async () => {
  const lead = await createLead(); const input = command(lead.id);
  expect(await declineLegacyStageLead(input)).toBe('DECLINED');
  await prisma.user.update({ where: { id: actorId }, data: { role: 'COACH' } });
  try {
    expect(await declineLegacyStageLead(input)).toBe('FORBIDDEN');
    expect(await prisma.stageReservationDecisionAudit.count({ where: { reservationId: lead.id } })).toBe(1);
  } finally { await prisma.user.update({ where: { id: actorId }, data: { role: 'ADMIN' } }); }
});
test('a concurrent role revocation wins before the service acquires its authorization lock', async () => {
  const lead = await createLead();
  let entered!: () => void; let release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const released = new Promise<void>(resolve => { release = resolve; });
  const revocation = prisma.$transaction(async tx => {
    await tx.user.update({ where: { id: actorId }, data: { role: 'COACH' } });
    entered(); await released;
  }, { timeout: 20_000, maxWait: 5_000 });
  await started;
  const decision = declineLegacyStageLead(command(lead.id));
  try {
    const deadline = Date.now() + 5_000;
    let observed = false;
    while (Date.now() < deadline) {
      const rows = await prisma.$queryRaw<Array<{ waiting: number }>>`
        SELECT count(*)::int AS waiting FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FOR SHARE%'`;
      if (rows[0].waiting > 0) { observed = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(observed).toBe(true);
    release(); await revocation;
    expect(await decision).toBe('FORBIDDEN');
    expect((await prisma.stageReservation.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('PENDING');
  } finally {
    release(); await Promise.allSettled([revocation, decision]);
    await prisma.user.update({ where: { id: actorId }, data: { role: 'ADMIN' } });
  }
});
