/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/families/student-access-authority', () => ({
  ...jest.requireActual('@/lib/families/student-access-authority'), resolveParentStudentAccess: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { resolveParentStudentAccess } from '@/lib/families/student-access-authority';
import { resolveAssessmentReadAuthority, resolveBilanReadAuthority } from '@/lib/security/academic-read-authority';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(prisma.assessment.findUnique).mockResolvedValue({ studentId: 'synthetic-student' } as never);
  jest.mocked(prisma.bilan.findUnique).mockResolvedValue({ studentId: 'synthetic-student' } as never);
});

test.each(['LEGACY_ALLOWED', 'CORE_VERIFIED_READ'] as const)('%s retains published-report gating and student binding', async status => {
  jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-student', status });
  const result = await resolveBilanReadAuthority('synthetic-bilan', { id: 'synthetic-parent', role: 'PARENT' });
  expect(result).toEqual({ where: { id: 'synthetic-bilan', studentId: 'synthetic-student', isPublished: true } });
});

test.each([null, { studentId: null }])('an absent or unlinked assessment never authorizes a parent', async scope => {
  jest.mocked(prisma.assessment.findUnique).mockResolvedValue(scope as never);
  expect(await resolveAssessmentReadAuthority('synthetic-assessment', { id: 'synthetic-parent', role: 'PARENT' })).toEqual({ where: null });
  expect(resolveParentStudentAccess).not.toHaveBeenCalled();
});

test('staff reading uses its existing permission scope without claiming parent ownership', async () => {
  expect(await resolveBilanReadAuthority('synthetic-bilan', { id: 'synthetic-admin', role: 'ADMIN' })).toEqual({ where: { id: 'synthetic-bilan' } });
  expect(prisma.bilan.findUnique).not.toHaveBeenCalled();
  expect(resolveParentStudentAccess).not.toHaveBeenCalled();
});
