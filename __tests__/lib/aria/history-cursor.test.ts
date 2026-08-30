import { AriaError } from '@/lib/aria/errors';
import {
  decodeAriaPageCursor,
  encodeAriaPageCursor,
} from '@/lib/aria/transport/cursor';

describe('ARIA opaque history cursor', () => {
  it('round-trips a versioned cursor without losing the deterministic tie-breaker', () => {
    const timestamp = new Date('2026-08-30T14:00:00.000Z');
    const encoded = encodeAriaPageCursor('MESSAGES', { timestamp, id: 'message-42' });
    expect(decodeAriaPageCursor('MESSAGES', encoded)).toEqual({
      timestamp,
      id: 'message-42',
    });
  });

  it.each([
    'not-base64-json',
    Buffer.from(JSON.stringify({ version: 2 }), 'utf8').toString('base64url'),
    encodeAriaPageCursor('CONVERSATIONS', {
      timestamp: new Date('2026-08-30T14:00:00.000Z'),
      id: 'conversation-1',
    }),
  ])('fails typed and closed for an invalid or cross-endpoint cursor', (cursor) => {
    try {
      decodeAriaPageCursor('MESSAGES', cursor);
      throw new Error('ARIA_TEST_CURSOR_REJECTION_REQUIRED');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AriaError);
      expect(error).toMatchObject({ code: 'BAD_REQUEST', status: 400 });
    }
  });
});
