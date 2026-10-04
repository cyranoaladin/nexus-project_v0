import { buildInvoiceAccessWhere, buildInvoiceListAccessWhere, buildInvoiceScopeWhere } from '@/lib/invoice/not-found';
import { prisma } from '@/lib/prisma';

const now = new Date('2026-10-04T12:00:00Z');

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ children: [{ userId: 'synthetic-child' }] });
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'synthetic-parent@example.invalid', parentPhoneState: 'NONE', emailVerifiedAt: now, parentPhoneChallenges: [] });
});

it('requires payer or explicit active financial delegation, never beneficiary or matching email', async () => {
  const scope = await buildInvoiceListAccessWhere({ id: 'synthetic-parent', role: 'PARENT', email: 'synthetic-parent@example.invalid' });
  const serialized = JSON.stringify(scope);
  expect(serialized).not.toContain('beneficiaryUserId');
  expect(serialized).not.toContain('customerEmail');
  expect(serialized).toContain('payerUserId');
  expect(serialized).toContain('financialDelegations');
  expect(scope).toMatchObject({ status: { not: 'DRAFT' } });
  expect(prisma.parentProfile.findUnique).not.toHaveBeenCalled();
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
});

it('retains the authenticated payer ID when email is absent', async () => {
  await expect(buildInvoiceAccessWhere('synthetic-invoice', { id: 'synthetic-parent', role: 'PARENT' }))
    .resolves.toMatchObject({ id: 'synthetic-invoice', OR: expect.arrayContaining([{ payerUserId: 'synthetic-parent' }]) });
});

it('cannot grant legacy email-only authority without a verified payer identifier', () => {
  expect(buildInvoiceScopeWhere('synthetic-invoice', 'PARENT', 'synthetic-parent@example.invalid')).toBeNull();
});

it.each(['ELEVE', 'COACH', 'SUPPORT', undefined])('denies finance for %s', async role => {
  await expect(buildInvoiceAccessWhere('synthetic-invoice', { id: 'synthetic-user', role })).resolves.toBeNull();
});

it('bounds delegation by the server clock and excludes revoked grants before the database read', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(now);
  try {
    await expect(buildInvoiceListAccessWhere({ id: 'synthetic-delegate', role: 'PARENT' })).resolves.toEqual({
      status: { not: 'DRAFT' }, OR: [
        { payerUserId: 'synthetic-delegate' },
        { financialDelegations: { some: { delegateUserId: 'synthetic-delegate', revokedAt: null,
          startsAt: { lte: now }, expiresAt: { gt: now } } } },
      ],
    });
  } finally { jest.useRealTimers(); }
});

it('denies an empty authenticated identifier', async () => {
  await expect(buildInvoiceListAccessWhere({ id: '', role: 'PARENT' })).resolves.toBeNull();
});
