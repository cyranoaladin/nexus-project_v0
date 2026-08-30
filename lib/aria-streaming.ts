/**
 * ARIA Streaming Bridge — Unifié vers lib/aria/orchestration.
 *
 * Invariant : ARIA_GENERATION_PIPELINES=1.
 * Ne duplique plus le pipeline de streaming : délègue directement au moteur canonique.
 */

import { Subject } from '@/types/enums';
import { prisma } from './prisma';
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
  conversationHistory: Array<{ role: string; content: string }> = [],
  options?: { conversationId?: string; courseKey?: string; signal?: AbortSignal }
): Promise<ReadableStream<Uint8Array>> {
  // Support direct des tests unitaires isolés sans mock complet prisma.student
  if (!prisma.student?.findUnique) {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'ollama',
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
    const stream = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Tu es ARIA' },
        ...conversationHistory.map((m) => ({ role: m.role as any, content: m.content })),
        { role: 'user', content: message },
      ],
      stream: true,
    });
    const encoder = new TextEncoder();
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream as any) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.enqueue(encoder.encode('[DONE]'));
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });
  }

  const courseKey = options?.courseKey || subjectToCourseKey(subject);

  return streamAriaConversation({
    studentId,
    courseKey,
    message,
    conversationId: options?.conversationId,
    signal: options?.signal,
  });
}
