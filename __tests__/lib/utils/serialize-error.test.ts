import { serializeError } from '@/lib/utils/serialize-error';

describe('serializeError', () => {
  it('turns circular Error objects into JSON-safe payloads', () => {
    const error = new Error('PDF tool failed') as Error & { error?: unknown };
    error.error = error;

    const serialized = serializeError(error);

    expect(serialized).toEqual(
      expect.objectContaining({
        name: 'Error',
        message: 'PDF tool failed',
      }),
    );
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });
});
