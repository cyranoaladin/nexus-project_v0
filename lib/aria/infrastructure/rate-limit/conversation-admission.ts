import { guardRateLimitValueOnceAsync } from '@/lib/rate-limit/runtime';
import type {
  AriaConversationAdmissionDecision,
  AriaConversationAdmissionInput,
  AriaConversationAdmissionPort,
} from '../../application/conversation/ports';

function retryAfterMs(response: Response): number | undefined {
  const seconds = Number(response.headers.get('Retry-After'));
  return Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds * 1_000)
    : undefined;
}

export const ariaConversationAdmissionPort: AriaConversationAdmissionPort = Object.freeze({
  async admitExecution(
    input: AriaConversationAdmissionInput,
  ): Promise<AriaConversationAdmissionDecision> {
    const blocked = await guardRateLimitValueOnceAsync({
      preset: 'ai',
      keySuffix: 'aria-conversation-execution',
      dimension: 'actor',
      value: input.actorUserId,
      idempotencyValue: input.clientRequestId,
    });
    if (!blocked) return { status: 'ALLOWED' };
    const retry = retryAfterMs(blocked);
    if (blocked.status === 429) {
      return { status: 'DENIED', ...(retry !== undefined ? { retryAfterMs: retry } : {}) };
    }
    return { status: 'UNAVAILABLE', ...(retry !== undefined ? { retryAfterMs: retry } : {}) };
  },
});
