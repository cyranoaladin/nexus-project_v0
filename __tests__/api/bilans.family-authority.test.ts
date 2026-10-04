/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/guards', () => ({ requireAnyRole: jest.fn(), isErrorResponse: (value: unknown) => value instanceof Response }));
jest.mock('@/lib/families/student-access-authority', () => ({
  ...jest.requireActual('@/lib/families/student-access-authority'), resolveParentStudentAccess: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireAnyRole } from '@/lib/guards';
import { resolveParentStudentAccess } from '@/lib/families/student-access-authority';
import { GET } from '@/app/api/bilans/[id]/route';
import { GET as exportGet } from '@/app/api/bilans/[id]/export/route';
import { NextRequest } from 'next/server';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireAnyRole).mockResolvedValue({ user: { id: 'synthetic-parent', role: 'PARENT', email: 'parent@synthetic.test' } } as never);
  jest.mocked(prisma.bilan.findUnique).mockResolvedValue({ studentId: 'synthetic-student' } as never);
});

describe.each([{ label: 'detail', handler: GET }, { label: 'export', handler: exportGet }])('$label family authority', ({ handler }) => {
  test.each([
    { decision: 'DENIED' as const, status: 404 },
    { decision: 'AUTHORITY_UNAVAILABLE' as const, status: 503 },
  ])('$decision refuses before loading a private report', async ({ decision, status }) => {
    jest.mocked(resolveParentStudentAccess).mockResolvedValue({ id: 'synthetic-student', status: decision });
    const response = await handler(new NextRequest('http://localhost/api/bilans/synthetic-bilan?format=markdown&audience=parents'), { params: Promise.resolve({ id: 'synthetic-bilan' }) });
    expect(response.status).toBe(status);
    expect(prisma.bilan.findFirst).not.toHaveBeenCalled();
    expect(prisma.bilan.findUnique).toHaveBeenCalledWith({ where: { id: 'synthetic-bilan' }, select: { studentId: true } });
  });
});
