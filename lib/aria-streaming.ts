/**
 * ARIA Streaming Bridge — Unifié vers lib/aria/orchestration.
 *
 * Invariant : ARIA_GENERATION_PIPELINES=1.
 * Ne duplique plus le pipeline de streaming : délègue directement au moteur canonique.
 */

import { Subject } from '@/types/enums';
import { streamAriaConversation } from '@/lib/aria/orchestration';

// Mapping rétro-compatible de Subject vers courseKey par défaut (Terminale)
function subjectToCourseKey(subject: Subject): string {
  switch (subject) {
    case Subject.MATHEMATIQUES:
      return 'eds-maths-terminale';
    case Subject.NSI:
      return 'eds-nsi-terminale';
    case Subject.FRANCAIS:
      return 'tc-francais-premiere';
    case Subject.PHILOSOPHIE:
      return 'tc-philosophie-terminale';
    default:
      return 'eds-maths-terminale';
  }
}

export async function generateAriaResponseStream(
  studentId: string,
  subject: Subject,
  message: string,
  _conversationHistory: Array<{ role: string; content: string }> = [],
  options?: { conversationId?: string; courseKey?: string; signal?: AbortSignal }
): Promise<ReadableStream<Uint8Array>> {
  const courseKey = options?.courseKey || subjectToCourseKey(subject);

  return streamAriaConversation({
    studentId,
    courseKey,
    message,
    conversationId: options?.conversationId,
    signal: options?.signal,
  });
}
