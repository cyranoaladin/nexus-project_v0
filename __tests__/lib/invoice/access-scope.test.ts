import { buildInvoiceAccessWhere, buildInvoiceScopeWhere } from '@/lib/invoice/not-found';
import { prisma } from '@/lib/prisma';

const mockParentProfileFindUnique = prisma.parentProfile.findUnique as jest.Mock;

describe('buildInvoiceAccessWhere', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'parent@test.tn', parentPhoneState: 'NONE', emailVerifiedAt: null, parentPhoneChallenges: [] });
  });

  it('allows ADMIN to scope by invoice id only', async () => {
    await expect(
      buildInvoiceAccessWhere('inv-1', { id: 'admin-1', role: 'ADMIN', email: 'admin@test.tn' }),
    ).resolves.toEqual({ id: 'inv-1' });
  });

  it.each([null, 'parent@test.tn'])('scopes parents by payer/delegation even with email=%s', async email => {
    const scope = await buildInvoiceAccessWhere('inv-1', { id: 'parent-user-1', role: 'PARENT', email });
    expect(scope).toMatchObject({ id: 'inv-1', AND: [{ OR: [
      { status: { in: ['SENT', 'PAID'] } },
      { status: 'CANCELLED', events: { array_contains: [{ type: 'INVOICE_SENT' }] } },
    ] }], OR: [
      { payerUserId: 'parent-user-1' },
      { financialDelegations: { some: { delegateUserId: 'parent-user-1', revokedAt: null,
        startsAt: { lte: expect.any(Date) }, expiresAt: { gt: expect.any(Date) } } } },
    ] });
    expect(mockParentProfileFindUnique).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
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

describe('buildInvoiceScopeWhere', () => {
  it('grants ADMIN full scope', () => {
    expect(buildInvoiceScopeWhere('inv-1', 'ADMIN', 'admin@test.tn')).toEqual({ id: 'inv-1' });
  });

  it('grants ASSISTANTE full scope (same as ADMIN)', () => {
    expect(buildInvoiceScopeWhere('inv-1', 'ASSISTANTE', null)).toEqual({ id: 'inv-1' });
  });

  it('denies parent email-only scope', () => {
    expect(buildInvoiceScopeWhere('inv-1', 'PARENT', 'parent@test.tn')).toBeNull();
  });

  it('denies PARENT without email', () => {
    expect(buildInvoiceScopeWhere('inv-1', 'PARENT', null)).toBeNull();
  });

  it('denies COACH', () => {
    expect(buildInvoiceScopeWhere('inv-1', 'COACH', 'coach@test.tn')).toBeNull();
  });

  it('denies ELEVE', () => {
    expect(buildInvoiceScopeWhere('inv-1', 'ELEVE', 'student@test.tn')).toBeNull();
  });
});
