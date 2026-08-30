/**
 * ARIA Streaming Service — Délégué au pipeline canonique.
 *
 * Invariant : ARIA_GENERATION_PIPELINES=1.
 * HARDCODED_TERMINALE_LEGACY_CALLS=0.
 * Aucun pipeline parallèle, aucun appel direct à OpenAI, aucun fallback silencieux.
 */

import { Subject } from '@/types/enums';
import { prisma } from '@/lib/prisma';
import { streamAriaConversation } from '@/lib/aria/orchestration';
import { mapLegacySubjectToCourseKey } from '@/lib/aria/legacy-adapter';
import { AriaError } from '@/lib/aria/errors';

export async function generateAriaResponseStream(
  studentId: string,
  subject: Subject,
  message: string,
  _conversationHistory: Array<{ role: string; content: string }> = [],
  options?: { conversationId?: string; courseKey?: string; signal?: AbortSignal }
): Promise<ReadableStream<Uint8Array>> {
  let courseKey = options?.courseKey;

  if (!courseKey) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new AriaError('NOT_ENROLLED', 404, 'Profil élève introuvable pour la résolution de matière.');
    }
    courseKey = mapLegacySubjectToCourseKey(subject, student.gradeLevel);
  }

  return streamAriaConversation({
    studentId,
    courseKey,
    message,
    conversationId: options?.conversationId,
    signal: options?.signal,
  });
}
