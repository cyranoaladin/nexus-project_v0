/**
 * ARIA Streaming Service — Délégué au pipeline canonique.
 *
 * Invariant : ARIA_GENERATION_PIPELINES=1.
 * Aucun pipeline parallèle, aucun appel direct à OpenAI, aucun fallback silencieux.
 */

import { Subject } from '@/types/enums';
import { streamAriaConversation } from '@/lib/aria/orchestration';
import { mapLegacySubjectToCourseKey } from '@/lib/aria/legacy-adapter';

export async function generateAriaResponseStream(
  studentId: string,
  subject: Subject,
  message: string,
  _conversationHistory: Array<{ role: string; content: string }> = [],
  options?: { conversationId?: string; courseKey?: string; signal?: AbortSignal }
): Promise<ReadableStream<Uint8Array>> {
  const courseKey = options?.courseKey || mapLegacySubjectToCourseKey(subject, 'TERMINALE');

  return streamAriaConversation({
    studentId,
    courseKey,
    message,
    conversationId: options?.conversationId,
    signal: options?.signal,
  });
}
