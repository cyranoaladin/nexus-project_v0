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
const command = (reservationId: string, requestId = randomUUID()) => ({ actorUserId: actorId, reservationId, requestId });
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
test('a failed audit FK rolls back the lead mutation', async () => {
  const lead = await createLead();
  await expect(declineLegacyStageLead({ ...command(lead.id), actorUserId: 'synthetic-absent-actor' })).rejects.toThrow();
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
