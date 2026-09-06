import { createHmac } from 'node:crypto';
import { mergeWhatsAppDelivery, verifyMetaWebhookSignature, applyWhatsAppStatusEvents } from '@/lib/whatsapp/webhook';
import { enqueueParentWhatsAppInvitation } from '@/lib/whatsapp/invitation-outbox';

const secret = 'test-meta-app-secret-'.repeat(3);
test('validates HMAC over exact raw bytes and rejects tampering/absent signature', () => {
  const raw = '{"entry":[]}';
  const signature = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  expect(verifyMetaWebhookSignature(raw, signature, secret)).toBe(true);
  expect(verifyMetaWebhookSignature(raw + ' ', signature, secret)).toBe(false);
  expect(verifyMetaWebhookSignature(raw, null, secret)).toBe(false);
  expect(verifyMetaWebhookSignature(raw, signature, '')).toBe(false);
});
test('status merging is monotone and duplicate events are no-ops', () => {
  const delivered = { state: 'DELIVERED' as const, providerMessageId: 'wamid.1', eventTimestamp: 20 };
  expect(mergeWhatsAppDelivery(delivered, { status: 'sent', id: 'wamid.1', timestamp: 30 })).toBeNull();
  expect(mergeWhatsAppDelivery(delivered, { status: 'failed', id: 'wamid.1', timestamp: 30 })).toBeNull();
  expect(mergeWhatsAppDelivery(delivered, { status: 'delivered', id: 'wamid.1', timestamp: 20 })).toBeNull();
  expect(mergeWhatsAppDelivery(delivered, { status: 'read', id: 'wamid.1', timestamp: 25 })?.state).toBe('READ');
  expect(mergeWhatsAppDelivery(delivered, { status: 'read', id: 'wamid.other', timestamp: 25 })).toBeNull();
});

test('signed status processing correlates only our sender and writes with CAS (no recipient PII retained)', async () => {
  const oldKey = process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY;
  process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY = secret;
  let job: any;
  try {
    await enqueueParentWhatsAppInvitation({ jobOutbox: { create: async ({ data }: any) => { job = { ...data, id: 'j1', status: 'AMBIGUOUS' }; return job; } } } as never,
      { userId: 'u1', challengeId: 'c1', rawToken: 'ppact_' + 'x'.repeat(43), phoneNormalized: '99123456', phoneVersion: 1, purpose: 'ACTIVATION', expiresAt: new Date('2099-01-01') });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const db = { jobOutbox: { findFirst: jest.fn(async () => job), updateMany } } as any;
    const value = { metadata: { phone_number_id: '123' }, statuses: [{ id: 'wamid.1', status: 'delivered', timestamp: '100', recipient_id: '21699123456', biz_opaque_callback_data: job.sourceEventKey }] };
    const body = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value }] }] };
    expect(await applyWhatsAppStatusEvents(body, 'other-sender', db)).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
    expect(await applyWhatsAppStatusEvents(body, '123', db)).toBe(1);
    const args = updateMany.mock.calls[0][0];
    expect(args.where.payload.equals).toEqual(job.payload);
    expect(args.data.status).toBe('COMPLETED');
    expect(args.data).not.toHaveProperty('leaseOwner');
    expect(args.data).not.toHaveProperty('leaseExpiresAt');
    expect(args.data.payload.delivery.state).toBe('DELIVERED');
    expect(JSON.stringify(args.data)).not.toContain('21699123456');
  } finally { if (oldKey === undefined) delete process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY; else process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY = oldKey; }
});
