/** @jest-environment node */
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('server-only', () => ({}));
jest.mock('@/lib/families/student-access-authority', () => ({
  ...jest.requireActual('@/lib/families/student-access-authority'), resolveParentStudentAccess: jest.fn(),
}));

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolveParentStudentAccess } from '@/lib/families/student-access-authority';
import { GET } from '@/app/api/assessments/[id]/status/route';
import { GET as resultGet } from '@/app/api/assessments/[id]/result/route';
import { GET as exportGet } from '@/app/api/assessments/[id]/export/route';
import { NextRequest } from 'next/server';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(auth).mockResolvedValue({ user: { id: 'synthetic-parent', role: 'PARENT', email: 'parent@synthetic.test' } } as never);
  jest.mocked(prisma.assessment.findUnique).mockResolvedValue({ studentId: 'synthetic-student' } as never);
  jest.mocked(prisma.assessment.findFirst).mockResolvedValue({ id: 'synthetic-assessment', status: 'PENDING', progress: 0, globalScore: null, confidenceIndex: null, errorCode: null } as never);
});

const invoke = () => GET(new NextRequest('http://localhost/api/assessments/synthetic-assessment/status'), { params: Promise.resolve({ id: 'synthetic-assessment' }) });

describe.each([{ label: 'status', handler: GET }, { label: 'result', handler: resultGet }, { label: 'export', handler: exportGet }])('$label family authority', ({ handler }) => {
test.each([
  { decision: 'DENIED' as const, status: 404 },
  { decision: 'AUTHORITY_UNAVAILABLE' as const, status: 503 },
])('a parent with $decision Core family authority cannot load legacy assessment details', async ({ decision, status }) => {
  jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-student', status: decision });
  expect((await handler(new NextRequest('http://localhost/api/assessments/synthetic-assessment'), { params: Promise.resolve({ id: 'synthetic-assessment' }) })).status).toBe(status);
  expect(prisma.assessment.findFirst).not.toHaveBeenCalled();
  expect(prisma.assessment.findUnique).toHaveBeenCalledWith({ where: { id: 'synthetic-assessment' }, select: { studentId: true } });
});
});

test('a verified Core parent read is bound to the authorized student instead of the stale V1 parent relationship', async () => {
  jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-student', status: 'CORE_VERIFIED_READ' });
  expect((await invoke()).status).toBe(200);
  expect(resolveParentStudentAccess).toHaveBeenCalledWith('synthetic-parent', 'synthetic-student', 'read');
  expect(jest.mocked(prisma.assessment.findFirst).mock.calls[0]?.[0]?.where).toEqual({ id: 'synthetic-assessment', studentId: 'synthetic-student' });
});
