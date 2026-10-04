import { deliverCoreV2Invitation } from '@/lib/email/core-v2-invitation';
import { deliverCoreV2PasswordReset } from '@/lib/email/core-v2-password-reset';
import { enqueueEmailIntentForIssuance } from '@/lib/email/outbox';

jest.mock('@/lib/auth/parent-activation', () => ({ getTrustedApplicationOrigin: () => 'https://synthetic.test' }));
jest.mock('@/lib/email/outbox', () => ({ enqueueEmailIntentForIssuance: jest.fn(async () => ({ messageId: '<stable@synthetic.test>' })) }));
jest.mock('@/lib/email/outbox-scheduler', () => ({ kickEmailOutboxDrain: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn(async fn => fn({ jobOutbox: {} })) } }));
const issued = { userId: 'synthetic-account', email: 'synthetic@example.test', displayName: 'Synthetic', rawToken: 'synthetic-opaque-proof', expiresAt: new Date('2026-10-05T08:00:00Z') };
beforeEach(() => jest.clearAllMocks());
test('reset delivery carries only the durable event identity as deduplication input', async () => {
  expect(await deliverCoreV2PasswordReset({ ...issued, resetId: 'synthetic-reset' })).toEqual({ messageId: '<stable@synthetic.test>' });
  const input = jest.mocked(enqueueEmailIntentForIssuance).mock.calls[0][1];
  expect(input.issuanceId).toBe('synthetic-reset');
  expect(input).not.toHaveProperty('dedupeKey');
  expect(input).not.toHaveProperty('tokenHash');
  expect(input.html).toContain('synthetic-opaque-proof');
});
test('invitation delivery uses its persistent invitation identity and returns stored Message-ID', async () => {
  expect(await deliverCoreV2Invitation({ ...issued, role: 'ELEVE', invitationId: 'synthetic-invitation' })).toEqual({ messageId: '<stable@synthetic.test>' });
  const input = jest.mocked(enqueueEmailIntentForIssuance).mock.calls[0][1];
  expect(input).toMatchObject({ issuanceId: 'synthetic-invitation', messageType: 'STUDENT_ACTIVATION' });
  expect(input).not.toHaveProperty('dedupeKey');
  expect(input).not.toHaveProperty('tokenHash');
});
