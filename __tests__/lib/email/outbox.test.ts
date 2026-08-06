import { enqueueEmailIntent, decryptEmailIntent } from '@/lib/email/outbox';

describe('durable email intent', () => {
  test('stores only encrypted content and a stable opaque Message-ID', async () => {
    const create = jest.fn(async ({ data }) => ({ id: 'job-1', sourceEventKey: data.sourceEventKey, data }));
    const result = await enqueueEmailIntent({ jobOutbox: { create } } as never, {
      aggregateId: 'user-1',
      messageType: 'PARENT_ACTIVATION',
      dedupeKey: 'opaque-transition-1',
      to: 'synthetic-parent@example.test',
      subject: 'Activate',
      html: '<a href="https://example.test/activate?token=recognizable-secret">Activate</a>',
      text: 'recognizable-secret',
    });
    expect(result.id).toBe('job-1');
    const data = create.mock.calls[0][0].data;
    const serialized = JSON.stringify(data.payload);
    expect(serialized).not.toContain('synthetic-parent@example.test');
    expect(serialized).not.toContain('recognizable-secret');
    const first = decryptEmailIntent(data.payload);
    const second = decryptEmailIntent(data.payload);
    expect(first.content.messageId).toMatch(/^<[-a-f0-9]+@mail\.nexusreussite\.academy>$/);
    expect(second).toEqual(first);
    expect(first.content.text).toBe('recognizable-secret');
  });

  test('rejects tampering fail-closed', async () => {
    const create = jest.fn(async ({ data }) => data);
    const data = await enqueueEmailIntent({ jobOutbox: { create } } as never, {
      aggregateId: 'user-2', messageType: 'PASSWORD_RESET', dedupeKey: 'reset-1',
      to: 'synthetic@example.test', subject: 'Reset', html: '<p>Reset</p>',
    }) as unknown as { payload: Record<string, string> };
    expect(() => decryptEmailIntent({ ...data.payload, ciphertext: `${data.payload.ciphertext}A` })).toThrow();
  });
});
