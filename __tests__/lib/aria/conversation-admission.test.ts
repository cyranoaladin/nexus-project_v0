jest.mock('@/lib/rate-limit/runtime', () => ({
  guardRateLimitValueOnceAsync: jest.fn(),
}));

import { guardRateLimitValueOnceAsync } from '@/lib/rate-limit/runtime';
import { ariaConversationAdmissionPort } from '@/lib/aria/infrastructure/rate-limit/conversation-admission';

describe('ARIA distributed conversation admission adapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('CODEX_IDEMPOTENT_ADMISSION uses the client request key in the canonical AI identity bucket', async () => {
    (guardRateLimitValueOnceAsync as jest.Mock).mockResolvedValueOnce(null);
    await expect(ariaConversationAdmissionPort.admitExecution({
      actorUserId: 'actor-1', requestId: 'request-1', clientRequestId: 'client-request-1',
    })).resolves.toEqual({ status: 'ALLOWED' });
    expect(guardRateLimitValueOnceAsync).toHaveBeenCalledWith({
      preset: 'ai', keySuffix: 'aria-conversation-execution',
      dimension: 'actor', value: 'actor-1', idempotencyValue: 'client-request-1',
    });
  });

  it.each([
    [429, 'DENIED'],
    [503, 'UNAVAILABLE'],
  ] as const)('maps central limiter status %i to %s', async (status, expected) => {
    (guardRateLimitValueOnceAsync as jest.Mock).mockResolvedValueOnce(
      new Response(null, { status, headers: { 'Retry-After': '7' } }),
    );
    await expect(ariaConversationAdmissionPort.admitExecution({
      actorUserId: 'actor-1', requestId: 'request-1', clientRequestId: 'client-request-1',
    })).resolves.toEqual({ status: expected, retryAfterMs: 7_000 });
  });

  it('fails closed on an unexpected limiter response', async () => {
    (guardRateLimitValueOnceAsync as jest.Mock).mockResolvedValueOnce(
      new Response(null, { status: 418 }),
    );
    await expect(ariaConversationAdmissionPort.admitExecution({
      actorUserId: 'actor-1', requestId: 'request-1', clientRequestId: 'client-request-1',
    })).resolves.toEqual({ status: 'UNAVAILABLE' });
  });

  it('returns a stable denial when Retry-After is absent or invalid', async () => {
    (guardRateLimitValueOnceAsync as jest.Mock).mockResolvedValueOnce(
      new Response(null, { status: 429, headers: { 'Retry-After': 'invalid' } }),
    );
    await expect(ariaConversationAdmissionPort.admitExecution({
      actorUserId: 'actor-1', requestId: 'request-1', clientRequestId: 'client-request-1',
    })).resolves.toEqual({ status: 'DENIED' });
  });
});
