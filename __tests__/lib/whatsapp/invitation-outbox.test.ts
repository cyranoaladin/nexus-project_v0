import { enqueueParentWhatsAppInvitation, decryptWhatsAppInvitation } from '@/lib/whatsapp/invitation-outbox';

const input = { userId: 'parent-1', challengeId: 'challenge-1', rawToken: 'pwa_' + 'x'.repeat(43), phoneNormalized: '99123456', phoneVersion: 2, purpose: 'ACTIVATION' as const, expiresAt: new Date('2099-01-01') };
const beforeEnv = process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY;
beforeEach(() => { process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY = 'test-only-whatsapp-key-'.repeat(3); });
afterAll(() => { if (beforeEnv === undefined) delete process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY; else process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY = beforeEnv; });

test('stores an authenticated encrypted invitation atomically in the existing job outbox', async () => {
  const create = jest.fn().mockResolvedValue({ id: 'job-1', sourceEventKey: 'event-1' });
  await enqueueParentWhatsAppInvitation({ jobOutbox: { create } } as never, input);
  const data = create.mock.calls[0][0].data;
  expect(data.jobType).toBe('WHATSAPP_SEND');
  expect(data.status).toBe('PENDING');
  expect(JSON.stringify(data)).not.toContain(input.rawToken);
  expect(JSON.stringify(data)).not.toContain(input.phoneNormalized);
  expect(decryptWhatsAppInvitation(data.payload)).toEqual({ ...input, expiresAt: input.expiresAt.toISOString() });
  expect(data.payload.schemaVersion).toBe('whatsapp-invitation/v1');
});

test('same challenge/purpose/version gives stable dedupe, different challenge changes it', async () => {
  const create = jest.fn().mockResolvedValue({ id: 'job' });
  const tx = { jobOutbox: { create } } as never;
  await enqueueParentWhatsAppInvitation(tx, input);
  await enqueueParentWhatsAppInvitation(tx, input);
  await enqueueParentWhatsAppInvitation(tx, { ...input, challengeId: 'challenge-2' });
  expect(create.mock.calls[0][0].data.idempotencyKey).toBe(create.mock.calls[1][0].data.idempotencyKey);
  expect(create.mock.calls[0][0].data.idempotencyKey).not.toBe(create.mock.calls[2][0].data.idempotencyKey);
});

test('rejects tampered encrypted content and absent encryption config without a write', async () => {
  const create = jest.fn().mockResolvedValue({ id: 'job' });
  await enqueueParentWhatsAppInvitation({ jobOutbox: { create } } as never, input);
  const payload = create.mock.calls[0][0].data.payload;
  expect(() => decryptWhatsAppInvitation({ ...payload, correlationId: 'tampered' })).toThrow();
  delete process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY;
  create.mockClear();
  await expect(enqueueParentWhatsAppInvitation({ jobOutbox: { create } } as never, input)).rejects.toThrow('WHATSAPP_OUTBOX_ENCRYPTION_KEY_INVALID');
  expect(create).not.toHaveBeenCalled();
});
