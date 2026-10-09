jest.unmock('@/lib/prisma');
const mockAuth = jest.fn();
jest.mock('@/auth', () => ({ auth: () => mockAuth() }));
jest.mock('@/lib/entitlement/engine', () => ({ getUserEntitlements: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/trajectory', () => ({ getActiveTrajectory: jest.fn().mockResolvedValue(null), parseMilestones: jest.fn().mockReturnValue([]) }));
jest.mock('@/lib/next-step-engine', () => ({ getNextStep: jest.fn().mockResolvedValue(null) }));
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { NextRequest } from 'next/server';
import { GET as downloadStudentDocument } from '@/app/api/student/documents/[id]/download/route';
import { openSecureDocument } from '@/lib/documents/secure-file-access';
jest.mock('@/lib/documents/secure-file-access', () => ({
  ...jest.requireActual('@/lib/documents/secure-file-access'), openSecureDocument: jest.fn(),
}));
import { prisma } from '@/lib/prisma';
import { buildStudentDashboardPayload } from '@/lib/dashboard/student-payload';
import { STUDENT_DOCUMENT_SCOPES } from '@/lib/documents/student-visibility';
import { readAuthorizedDocument } from '@/lib/documents/read-authority';
import { GET as listStudentDocuments } from '@/app/api/student/documents/route';
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
test('direct student listing reads the same authorized scopes from PostgreSQL', async () => {
  mockAuth.mockResolvedValue({ user: { id: studentId, email: `${studentId}@synthetic.test`, role: 'ELEVE' } });
  const response = await listStudentDocuments();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  const body = await response.json();
  expect(body.documents).toHaveLength(4);
  expect(JSON.stringify(body)).not.toContain('PRIVATE-ADMIN');
});

test('the student download URL refuses owned ADMIN_ONLY before touching storage', async () => {
  mockAuth.mockResolvedValue({ user: { id: studentId, email: `${studentId}@synthetic.test`, role: 'ELEVE' } });
  const id = `${prefix}-admin-0`;
  (openSecureDocument as jest.Mock).mockClear();
  const response = await downloadStudentDocument(new NextRequest(`http://localhost/api/student/documents/${id}/download`), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(404);
  expect(openSecureDocument).not.toHaveBeenCalled();
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
test.each(STUDENT_DOCUMENT_SCOPES)('the student download URL serves an authorized %s file', async scope => {
  mockAuth.mockResolvedValue({ user: { id: studentId, email: `${studentId}@synthetic.test`, role: 'ELEVE' } });
  const id = `${prefix}-${scope}`;
  (openSecureDocument as jest.Mock).mockResolvedValue({ handle: { createReadStream: () => Readable.from(Buffer.from('synthetic')), close: jest.fn().mockResolvedValue(undefined) }, sizeBytes: 9 });
  const response = await downloadStudentDocument(new NextRequest(`http://localhost/api/student/documents/${id}/download`), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('synthetic');
});

test('direct parent ownership cannot override an administrative-only scope', async () => {
  const id = `${prefix}-parent-private`;
  await prisma.userDocument.create({ data: { id, userId: parentId, title: 'Synthetic admin note', originalName: 'synthetic.pdf', localPath: 'synthetic.pdf', mimeType: 'application/pdf', sizeBytes: 9, visibilityScope: 'ADMIN_ONLY' } });
  const decision = await readAuthorizedDocument(id, { id: parentId, role: 'PARENT' });
  expect(decision.status).toBe('DENIED');
  if (decision.status !== 'DENIED') throw new Error('Expected administrative privacy refusal');
  expect(decision.response.status).toBe(404);
});
