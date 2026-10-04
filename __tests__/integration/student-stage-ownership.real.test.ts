jest.unmock('@/lib/prisma');
jest.mock('@/lib/entitlement/engine', () => ({ getUserEntitlements: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/trajectory', () => ({ getActiveTrajectory: jest.fn().mockResolvedValue(null), parseMilestones: jest.fn().mockReturnValue([]) }));
jest.mock('@/lib/next-step-engine', () => ({ getNextStep: jest.fn().mockResolvedValue(null) }));
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { buildStudentDashboardPayload } from '@/lib/dashboard/student-payload';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { cleanupDisposableTestFixture } from '@/__tests__/helpers/real-db-fixture-cleanup';

const prefix = `student-stage-${randomUUID()}`;
const parentId = `${prefix}-parent`;
const studentUserId = `${prefix}-student`;
const foreignUserId = `${prefix}-foreign`;
const stageId = `${prefix}-stage`;
const email = `${studentUserId}@synthetic.test`;
let verified = false;
beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  verified = true;
  const parent = await prisma.user.create({ data: { id: parentId, role: 'PARENT', email: `${parentId}@synthetic.test`, parentProfile: { create: {} } }, include: { parentProfile: true } });
  for (const userId of [studentUserId, foreignUserId]) {
    await prisma.user.create({ data: { id: userId, role: 'ELEVE', email: `${userId}@synthetic.test`, student: { create: { id: `${userId}-profile`, parentId: parent.parentProfile!.id, gradeLevel: 'PREMIERE' } } } });
  }
  await prisma.stage.create({ data: { id: stageId, slug: stageId, title: 'Synthetic stage', startDate: new Date('2026-10-05T08:00:00Z'), endDate: new Date('2026-10-06T08:00:00Z'), priceAmount: 1 } });
  await prisma.stageReservation.createMany({ data: [
    { id: `${prefix}-owned`, studentId: `${studentUserId}-profile` },
    { id: `${prefix}-foreign`, studentId: `${foreignUserId}-profile` },
    { id: `${prefix}-unlinked`, studentId: null },
  ].map(row => ({ ...row, stageId, parentName: 'Synthetic parent', email, phone: 'synthetic', classe: 'PREMIERE', academyId: row.id, academyTitle: 'Synthetic stage', price: 1, status: 'CONFIRMED' })) });
});
afterAll(async () => {
  if (verified) {
    await prisma.stageReservation.deleteMany({ where: { id: { in: ['owned', 'foreign', 'unlinked'].map(suffix => `${prefix}-${suffix}`) } } });
    await prisma.stage.deleteMany({ where: { id: stageId } });
    await cleanupDisposableTestFixture(prisma, { userIds: [studentUserId, foreignUserId, parentId] });
  }
  await prisma.$disconnect();
});
test('matching email never overrides a foreign or missing student link', async () => {
  const payload = await buildStudentDashboardPayload(studentUserId);
  expect([...payload.upcomingStages, ...payload.pastStages].map(item => item.reservationId)).toEqual([`${prefix}-owned`]);
  expect(JSON.stringify(payload)).not.toContain(`${prefix}-foreign`);
  expect(JSON.stringify(payload)).not.toContain(`${prefix}-unlinked`);
  expect(await prisma.stageReservation.count({ where: { stageId } })).toBe(3);
  expect((await prisma.stageReservation.findUniqueOrThrow({ where: { id: `${prefix}-unlinked` } })).studentId).toBeNull();
});
test('changing the student email cannot remove an explicitly owned reservation', async () => {
  await prisma.user.update({ where: { id: studentUserId }, data: { email: `${prefix}-changed@synthetic.test` } });
  const payload = await buildStudentDashboardPayload(studentUserId);
  expect([...payload.upcomingStages, ...payload.pastStages].map(item => item.reservationId)).toEqual([`${prefix}-owned`]);
});
