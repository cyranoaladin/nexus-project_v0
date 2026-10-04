jest.unmock('@/lib/prisma');
jest.mock('@/lib/entitlement/engine', () => ({ getUserEntitlements: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/trajectory', () => ({ getActiveTrajectory: jest.fn().mockResolvedValue(null), parseMilestones: jest.fn().mockReturnValue([]) }));
jest.mock('@/lib/next-step-engine', () => ({ getNextStep: jest.fn().mockResolvedValue(null) }));
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { buildStudentDashboardPayload } from '@/lib/dashboard/student-payload';
import { STUDENT_DOCUMENT_SCOPES } from '@/lib/documents/student-visibility';
import { readAuthorizedDocument } from '@/lib/documents/read-authority';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { cleanupDisposableTestFixture } from '@/__tests__/helpers/real-db-fixture-cleanup';

const prefix = `student-document-${randomUUID()}`;
const parentId = `${prefix}-parent`;
const studentId = `${prefix}-student`;
let verified = false;
beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  verified = true;
  const parent = await prisma.user.create({ data: { id: parentId, role: 'PARENT', email: `${parentId}@synthetic.test`, parentProfile: { create: {} } }, include: { parentProfile: true } });
  await prisma.user.create({ data: { id: studentId, role: 'ELEVE', email: `${studentId}@synthetic.test`, student: { create: { parentId: parent.parentProfile!.id, gradeLevel: 'PREMIERE' } } } });
  await prisma.userDocument.createMany({ data: [
    ...STUDENT_DOCUMENT_SCOPES.map(scope => ({ id: `${prefix}-${scope}`, userId: studentId, title: scope, originalName: `${scope}.pdf`, localPath: `${prefix}-${scope}.pdf`, mimeType: 'application/pdf', sizeBytes: 32, visibilityScope: scope, createdAt: new Date('2026-10-03T08:00:00Z') })),
    ...Array.from({ length: 11 }, (_, index) => ({ id: `${prefix}-admin-${index}`, userId: studentId, title: `PRIVATE-ADMIN-${index}`, originalName: `PRIVATE-ADMIN-${index}.pdf`, description: 'PRIVATE-ADMIN-METADATA', localPath: `${prefix}-admin-${index}.pdf`, mimeType: 'application/pdf', sizeBytes: 32, visibilityScope: 'ADMIN_ONLY' as const, createdAt: new Date('2026-10-04T08:00:00Z') })),
  ] });
});
afterAll(async () => {
  if (verified) await cleanupDisposableTestFixture(prisma, { userIds: [studentId, parentId] });
  await prisma.$disconnect();
});
test('visibility is applied by PostgreSQL before pagination and aligns metadata with download authorization', async () => {
  const payload = await buildStudentDashboardPayload(studentId);
  expect(payload.resources).toHaveLength(4);
  expect(payload.resources.map(resource => resource.id).sort()).toEqual(STUDENT_DOCUMENT_SCOPES.map(scope => `${prefix}-${scope}`).sort());
  expect(JSON.stringify(payload)).not.toContain('PRIVATE-ADMIN');
  const denied = await readAuthorizedDocument(`${prefix}-admin-0`, { id: studentId, role: 'ELEVE' });
  expect(denied.status).toBe('DENIED');
  for (const scope of STUDENT_DOCUMENT_SCOPES) {
    expect((await readAuthorizedDocument(`${prefix}-${scope}`, { id: studentId, role: 'ELEVE' })).status).toBe('ALLOWED');
    expect(JSON.stringify(payload.hub)).toContain(`/api/student/documents/${prefix}-${scope}/download`);
  }
});
