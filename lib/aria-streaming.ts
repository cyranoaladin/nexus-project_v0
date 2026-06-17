import { Subject } from '@/types/enums';
import OpenAI from 'openai';
import { ragSearch, buildRAGContext } from '@/lib/rag-client';
import { ARIA_SYSTEM_PROMPT, ARIA_MAX_MESSAGE_LENGTH, getAriaModel } from '@/lib/aria/prompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

// ARIA_SYSTEM_PROMPT imported from '@/lib/aria/prompt' — single source of truth

async function searchKnowledgeBase(query: string, subject: Subject, limit: number = 3) {
  // F26: Use canonical RAG circuit (ChromaDB via ragSearch)
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
  const hits = await searchKnowledgeBase(message, subject);
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

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
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
        console.error('Streaming error:', error);
        const errorData = `data: ${JSON.stringify({ error: 'Streaming error occurred' })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    }
  });
}
