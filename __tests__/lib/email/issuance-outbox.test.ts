import { decryptEmailIntent, enqueueEmailIntentForIssuance } from '@/lib/email/outbox';

const input = {
  aggregateId: 'synthetic-user', aggregateType: 'core-v2-password-reset',
  messageType: 'PASSWORD_RESET' as const, issuanceId: 'synthetic-reset-event',
  to: 'synthetic@example.test', subject: 'Reset', html: '<p>opaque-link</p>',
};

test('retries the durable issuance without replacing encrypted content or Message-ID', async () => {
  const rows = new Map<string, { id: string; sourceEventKey: string; payload: unknown }>();
  const upsert = jest.fn(async ({ where, create }) => {
    const existing = rows.get(where.idempotencyKey);
    if (existing) return existing;
    const row = { id: 'synthetic-job', sourceEventKey: create.sourceEventKey, payload: create.payload };
    rows.set(where.idempotencyKey, row);
    return row;
  });
  const tx = { jobOutbox: { upsert } } as never;
  const first = await enqueueEmailIntentForIssuance(tx, input);
  const retry = await enqueueEmailIntentForIssuance(tx, { ...input, html: '<p>changed retry</p>' });
  expect(rows.size).toBe(1);
  expect(retry).toEqual(first);
  expect(first.messageId).toMatch(/^<[-a-f0-9]+@mail\.nexusreussite\.academy>$/);
  expect(decryptEmailIntent([...rows.values()][0].payload).content.html).toBe(input.html);
  expect(upsert.mock.calls[0][0].update).toEqual(upsert.mock.calls[0][0].where);
  expect(JSON.stringify([...rows.values()][0].payload)).not.toContain('opaque-link');
});

test('distinct durable issuances have distinct identities and no raw credential in the key', async () => {
  const upsert = jest.fn(async ({ create }) => ({ id: 'synthetic-job', sourceEventKey: create.sourceEventKey, payload: create.payload }));
  const tx = { jobOutbox: { upsert } } as never;
  await enqueueEmailIntentForIssuance(tx, input);
  await enqueueEmailIntentForIssuance(tx, { ...input, issuanceId: 'synthetic-reset-event-2' });
  const keys = upsert.mock.calls.map(([call]) => call.where.idempotencyKey);
  expect(keys[0]).not.toBe(keys[1]);
  expect(keys[0]).not.toContain(input.issuanceId);
  expect(keys[0]).toMatch(/^email:issuance:v1:[a-f0-9]{64}$/);
});

test.each(['', undefined, null, 42])('rejects invalid event identity %s before touching the outbox', async (issuanceId) => {
  const upsert = jest.fn();
  await expect(enqueueEmailIntentForIssuance({ jobOutbox: { upsert } } as never, { ...input, issuanceId: issuanceId as string }))
    .rejects.toThrow('EMAIL_ISSUANCE_ID_INVALID');
  expect(upsert).not.toHaveBeenCalled();
});
