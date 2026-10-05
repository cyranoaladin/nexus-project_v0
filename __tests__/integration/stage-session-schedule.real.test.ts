/** @jest-environment node */
jest.unmock('@/lib/prisma');
jest.mock('@/lib/guards', () => ({ requireAnyRole: jest.fn().mockResolvedValue({ user: { id: 'synthetic-staff', role: 'ADMIN' } }), isErrorResponse: jest.fn().mockReturnValue(false) }));
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/stages/[stageId]/sessions/route';
import { PATCH } from '@/app/api/admin/stages/[stageId]/sessions/[sessionId]/route';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { assertDisposablePostgresUrl } from '../helpers/disposable-postgres';

beforeAll(() => { assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''); });
afterAll(async () => { await prisma.$disconnect(); });
async function fixture() {
  const user = await prisma.user.create({ data: { email: `${randomUUID()}@example.test`, role: 'COACH' } });
  const coach = await prisma.coachProfile.create({ data: { userId: user.id, pseudonym: `Synthetic-${randomUUID()}`, subjects: ['MATHEMATIQUES'] } });
  const stage = await prisma.stage.create({ data: { slug: randomUUID(), title: 'Synthetic stage', startDate: new Date('2099-01-01T00:00:00Z'), endDate: new Date('2099-01-03T00:00:00Z'), priceAmount: 0 } });
  await prisma.stageCoach.create({ data: { stageId: stage.id, coachId: coach.id } });
  return { stageId: stage.id, coachId: coach.id };
}
function slot(ids: {stageId: string; coachId: string}, start = '10:00', end = '11:00') {
  return { ...ids, title: 'Synthetic session', subject: 'MATHEMATIQUES' as const, startAt: new Date(`2099-01-01T${start}:00Z`), endAt: new Date(`2099-01-01T${end}:00Z`) };
}
test('the database refuses overlapping stage sessions for the same coach across stages', async () => {
  const first = await fixture(); const second = await fixture();
  await prisma.stageSession.create({ data: slot(first) });
  let rejected = false;
  try { await prisma.stageSession.create({ data: slot({ stageId: second.stageId, coachId: first.coachId }, '10:30', '11:30') }); } catch { rejected = true; }
  expect(rejected).toBe(true);
});
test('adjacent intervals and different coaches remain valid', async () => {
  const first = await fixture(); const second = await fixture();
  await prisma.stageSession.create({ data: slot(first) });
  await prisma.stageSession.create({ data: slot(first, '11:00', '12:00') });
  await prisma.stageSession.create({ data: slot(second) });
  expect(await prisma.stageSession.count({ where: { stageId: first.stageId } })).toBe(2);
});
test('two concurrent overlapping inserts have exactly one winner', async () => {
  const ids = await fixture();
  const results = await Promise.allSettled([prisma.stageSession.create({ data: slot(ids) }), prisma.stageSession.create({ data: slot(ids, '10:30', '11:30') })]);
  expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1);
  expect(await prisma.stageSession.count({ where: { stageId: ids.stageId } })).toBe(1);
});

test('the create API returns a controlled conflict and creates no overlapping row', async () => {
  const ids = await fixture(); await prisma.stageSession.create({ data: slot(ids) });
  const data = slot(ids, '10:30', '11:30');
  const response = await POST(new NextRequest('http://localhost/api/admin/stages/synthetic/sessions', { method: 'POST', body: JSON.stringify({ title: data.title, subject: data.subject, coachId: ids.coachId, startAt: data.startAt.toISOString(), endAt: data.endAt.toISOString() }) }), { params: Promise.resolve({ stageId: ids.stageId }) });
  expect(response.status).toBe(409);
  expect((await response.json()).error).toBe('Ce coach a déjà une séance de stage sur ce créneau');
  expect(await prisma.stageSession.count({ where: { stageId: ids.stageId } })).toBe(1);
});
test('a conflicting patch returns 409 and preserves the original schedule', async () => {
  const ids = await fixture(); await prisma.stageSession.create({ data: slot(ids) });
  const row = await prisma.stageSession.create({ data: slot(ids, '12:00', '13:00') });
  const response = await PATCH(new NextRequest('http://localhost/api/admin/stages/synthetic/sessions/synthetic', { method: 'PATCH', body: JSON.stringify({ startAt: '2099-01-01T10:30:00Z', endAt: '2099-01-01T11:30:00Z' }) }), { params: Promise.resolve({ stageId: ids.stageId, sessionId: row.id }) });
  expect(response.status).toBe(409);
  const current = await prisma.stageSession.findUniqueOrThrow({ where: { id: row.id } });
  expect(current.startAt.toISOString()).toBe('2099-01-01T12:00:00.000Z');
});
