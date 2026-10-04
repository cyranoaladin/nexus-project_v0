jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn().mockResolvedValue({ success: false, error: 'NOT_FOUND' }) } }));
jest.mock('@/lib/families/student-access-authority', () => ({ resolveParentStudentAccess: jest.fn() }));
import { prisma } from '@/lib/prisma';
import { resolveParentStudentAccess } from '@/lib/families/student-access-authority';
import { initiateParentOwnedStudentActivation } from '@/lib/services/student-activation.service';

beforeEach(() => jest.clearAllMocks());
it.each(['DENIED', 'CORE_VERIFIED_READ'] as const)('refuses V1 token mutation for %s before starting a transaction', async status => {
  jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-child', status });
  expect(await initiateParentOwnedStudentActivation({ parentUserId: 'synthetic-parent', studentId: 'synthetic-child' }))
    .toEqual({ success: false, error: 'NOT_FOUND' });
  expect(resolveParentStudentAccess).toHaveBeenCalledWith('synthetic-parent', 'synthetic-child', 'mutation');
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
it('returns an authority outage without issuing or rotating any token', async () => {
  jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-child', status: 'AUTHORITY_UNAVAILABLE' });
  expect(await initiateParentOwnedStudentActivation({ parentUserId: 'synthetic-parent', studentId: 'synthetic-child' }))
    .toEqual({ success: false, error: 'AUTHORITY_UNAVAILABLE' });
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
