import { randomBytes } from 'node:crypto';
function generateRuntimePassword() { return randomBytes(32).toString('hex'); }
import { getLatestParentWhatsAppInvitationStatus, getWhatsAppInvitationStatus } from '@/lib/whatsapp/invitation-status';
import { enqueueParentWhatsAppInvitation } from '@/lib/whatsapp/invitation-outbox';

test('no invitation remains absent, not fabricated as sent', async () => {
  const db = { jobOutbox: { findFirst: jest.fn().mockResolvedValue(null) } } as any;
  expect(await getLatestParentWhatsAppInvitationStatus('parent-1', db)).toBeNull();
  expect(db.jobOutbox.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { jobType: 'WHATSAPP_SEND', aggregateType: 'USER', aggregateId: 'parent-1' } }));
});
test.each([
  ['PENDING', null, 'PENDING'], ['AMBIGUOUS', null, 'AMBIGUOUS'],
  ['RETRY_SCHEDULED', 'WHATSAPP_SERVICE_UNAVAILABLE', 'SERVICE_UNAVAILABLE'],
  ['RETRY_SCHEDULED', 'WHATSAPP_RATE_LIMITED', 'RETRY_SCHEDULED'],
  ['FAILED_FINAL', null, 'FAILED'], ['CANCELLED', null, 'CANCELLED'],
])('dispatch %s/%s has honest public state %s', (status, lastError, expected) => {
  expect(getWhatsAppInvitationStatus({ status, payload: {}, lastError } as any)).toBe(expected);
});
test('last invitation exposes dates and delivery state only, not encrypted content or identifiers', async () => {
  const saved = process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY;
  process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY = generateRuntimePassword();
  try {
    let row: any;
    await enqueueParentWhatsAppInvitation({ jobOutbox: { create: async ({ data }: any) => { row = data; return data; } } } as never, { userId: 'p1', challengeId: 'c1', rawToken: 'ppact_' + 'x'.repeat(43), phoneNormalized: '99123456', phoneVersion: 1, purpose: 'ACTIVATION', expiresAt: new Date('2099-01-01') });
    const createdAt = new Date('2026-09-06');
    row = { ...row, status: 'COMPLETED', createdAt, updatedAt: createdAt, lastError: null, payload: { ...row.payload, delivery: { state: 'ACCEPTED', providerMessageId: 'wamid.1' } } };
    const db = { jobOutbox: { findFirst: jest.fn().mockResolvedValue(row) } } as any;
    expect(await getLatestParentWhatsAppInvitationStatus('p1', db)).toEqual({ status: 'ACCEPTED', queuedAt: createdAt.toISOString(), updatedAt: createdAt.toISOString() });
    row.payload.delivery.state = 'DELIVERED';
    expect(getWhatsAppInvitationStatus(row)).toBe('DELIVERED');
    expect(JSON.stringify(await getLatestParentWhatsAppInvitationStatus('p1', db))).not.toMatch(/wamid|99123456|ciphertext|ppact_/);
  } finally { if (saved === undefined) delete process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY; else process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY = saved; }
});
