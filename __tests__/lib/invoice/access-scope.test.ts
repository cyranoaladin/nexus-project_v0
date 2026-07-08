import { buildInvoiceAccessWhere } from '@/lib/invoice/not-found';
import { prisma } from '@/lib/prisma';

const mockParentProfileFindUnique = prisma.parentProfile.findUnique as jest.Mock;

describe('buildInvoiceAccessWhere', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows ADMIN to scope by invoice id only', async () => {
    await expect(
      buildInvoiceAccessWhere('inv-1', { id: 'admin-1', role: 'ADMIN', email: 'admin@test.tn' }),
    ).resolves.toEqual({ id: 'inv-1' });
  });

  it('scopes PARENT invoices by child beneficiary ids and email fallback', async () => {
    mockParentProfileFindUnique.mockResolvedValue({
      children: [{ userId: 'child-user-1' }, { userId: 'child-user-2' }],
    });

    await expect(
      buildInvoiceAccessWhere('inv-1', { id: 'parent-user-1', role: 'PARENT', email: 'parent@test.tn' }),
    ).resolves.toEqual({
      id: 'inv-1',
      OR: [
        { beneficiaryUserId: { in: ['child-user-1', 'child-user-2'] } },
        { customerEmail: 'parent@test.tn' },
      ],
    });
  });

  it('keeps a legacy email fallback for PARENT when no child beneficiary exists', async () => {
    mockParentProfileFindUnique.mockResolvedValue({ children: [] });

    await expect(
      buildInvoiceAccessWhere('inv-1', { id: 'parent-user-1', role: 'PARENT', email: 'parent@test.tn' }),
    ).resolves.toEqual({
      id: 'inv-1',
      OR: [{ customerEmail: 'parent@test.tn' }],
    });
  });

  it('denies PARENT when no beneficiary and no email scope is available', async () => {
    mockParentProfileFindUnique.mockResolvedValue({ children: [] });

    await expect(
      buildInvoiceAccessWhere('inv-1', { id: 'parent-user-1', role: 'PARENT', email: null }),
    ).resolves.toBeNull();
  });

  it('grants ASSISTANTE full access and denies ELEVE, COACH and unknown roles on public invoice PDFs', async () => {
    await expect(
      buildInvoiceAccessWhere('inv-1', { id: 'staff-1', role: 'ASSISTANTE', email: null }),
    ).resolves.toEqual({ id: 'inv-1' });
    await expect(
      buildInvoiceAccessWhere('inv-1', { id: 'student-1', role: 'ELEVE', email: 'student@test.tn' }),
    ).resolves.toBeNull();
    await expect(
      buildInvoiceAccessWhere('inv-1', { id: 'coach-1', role: 'COACH', email: 'coach@test.tn' }),
    ).resolves.toBeNull();
    await expect(
      buildInvoiceAccessWhere('inv-1', { id: 'x-1', role: 'SUPERADMIN', email: 'x@test.tn' }),
    ).resolves.toBeNull();
  });
});
