import { Subject } from '@/types/enums';
import OpenAI from 'openai';
import { ragSearch, buildRAGContext } from '@/lib/rag-client';
import { ARIA_SYSTEM_PROMPT, ARIA_MAX_MESSAGE_LENGTH, getAriaModel } from '@/lib/aria/prompt';
import { serializeError } from '@/lib/utils/serialize-error';
import {
  ARIA_RAG_EMPTY_NOTICE,
  ARIA_RAG_UNAVAILABLE_MESSAGE,
  getSuccessfulRagHits,
} from '@/lib/aria/rag-state';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

// ARIA_SYSTEM_PROMPT imported from '@/lib/aria/prompt' — single source of truth

async function searchKnowledgeBase(query: string, subject: Subject, limit: number = 3) {
  // Use canonical RAG circuit (ChromaDB via ragSearch)
  const hits = await ragSearch({
    query,
    k: limit,
    filters: { subject: subject.toLowerCase() },
  });
  return hits;
}

export async function generateAriaResponseStream(
  studentId: string,
  subject: Subject,
  message: string,
  conversationHistory: Array<{ role: string; content: string; }> = []
): Promise<ReadableStream> {
  const ragResult = await searchKnowledgeBase(message, subject);
  const encoder = new TextEncoder();
  if (ragResult.status === 'error') {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ content: ARIA_RAG_UNAVAILABLE_MESSAGE })}\n\n`)
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
  }
  const hits = getSuccessfulRagHits(ragResult);
  const context = buildRAGContext(hits);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: ARIA_SYSTEM_PROMPT + context
    },
    ...conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    {
      role: 'user',
      content: `Matière : ${subject}\n\nQuestion : ${message}`
    }
  ];

  const stream = await openai.chat.completions.create({
    model: getAriaModel(),
    messages,
    max_tokens: ARIA_MAX_MESSAGE_LENGTH,
    temperature: 0.7,
    stream: true
  });

  return new ReadableStream({
    async start(controller) {
      try {
        if (ragResult.status === 'empty') {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: `${ARIA_RAG_EMPTY_NOTICE}\n\n` })}\n\n`)
          );
        }
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            const data = `data: ${JSON.stringify({ content })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        }
        
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        console.error('Streaming error:', serializeError(error));
        const errorData = `data: ${JSON.stringify({ error: 'Streaming error occurred' })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    }
  });
}
