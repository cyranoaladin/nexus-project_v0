import { Subject } from '@/types/enums';
import OpenAI from 'openai';
import { prisma } from './prisma';
import { ragSearch, buildRAGContext } from '@/lib/rag-client';
import { ARIA_SYSTEM_PROMPT, ARIA_MAX_MESSAGE_LENGTH, getAriaModel } from '@/lib/aria/prompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

// ARIA_SYSTEM_PROMPT imported from '@/lib/aria/prompt' — single source of truth

// Recherche dans la base de connaissances (RAG canonique via ChromaDB)
// pgvector désactivé — ChromaDB est le seul backend RAG actif
// Ingestion ChromaDB opérée hors-repo par infra-ingestor-1 (voir docs/RAG_ARCHITECTURE.md)
async function searchKnowledgeBase(query: string, subject: Subject, limit: number = 3) {
  const hits = await ragSearch({
    query,
    k: limit,
    filters: { subject: subject.toLowerCase() },
  });
  return hits;
}

// Génération de réponse ARIA
export async function generateAriaResponse(
  studentId: string,
  subject: Subject,
  message: string,
  conversationHistory: Array<{ role: string; content: string; }> = []
): Promise<string> {
  try {
    // Recherche dans la base de connaissances (RAG canonique)
    const hits = await searchKnowledgeBase(message, subject);
    const context = buildRAGContext(hits);

    // Construction des messages pour OpenAI
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

    // Appel à OpenAI
    const completion = await openai.chat.completions.create({
      model: getAriaModel(),
      messages,
      max_tokens: ARIA_MAX_MESSAGE_LENGTH,
      temperature: 0.7
    });

    return completion.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse.';

  } catch (error) {
    console.error('Erreur ARIA:', error);
    return 'Je rencontre une difficulté technique. Veuillez réessayer ou contacter un coach.';
  }
}

// Sauvegarde d'une conversation ARIA
export async function saveAriaConversation(
  studentId: string,
  subject: Subject,
  userMessage: string,
  ariaResponse: string,
  conversationId?: string
) {
  let conversation;

  if (conversationId) {
    conversation = await prisma.ariaConversation.findFirst({
      where: {
        id: conversationId,
        studentId
      }
    });

    if (!conversation) {
      throw new Error('ARIA_CONVERSATION_NOT_FOUND');
    }
  }

  if (!conversation) {
    conversation = await prisma.ariaConversation.create({
      data: {
        studentId,
        subject,
        title: userMessage.substring(0, 50) + '...'
      }
    });
  }

  // Sauvegarde du message utilisateur
  await prisma.ariaMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: userMessage
    }
  });

  // Sauvegarde de la réponse ARIA
  const ariaMessage = await prisma.ariaMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: ariaResponse
    }
  });

  return { conversation, ariaMessage };
}

// Génération de réponse ARIA en streaming
export async function generateAriaStream(
  studentId: string,
  subject: Subject,
  message: string,
  conversationHistory: Array<{ role: string; content: string; }> = [],
  onComplete?: (fullResponse: string) => Promise<void>
): Promise<ReadableStream> {
  // Recherche dans la base de connaissances (RAG canonique)
  const hits = await searchKnowledgeBase(message, subject);
  const context = buildRAGContext(hits);

  // Construction des messages pour OpenAI
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
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages,
    max_tokens: 1000,
    temperature: 0.7,
    stream: true,
  });

  const encoder = new TextEncoder();
  let fullResponse = '';

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
        if (onComplete) {
          await onComplete(fullResponse);
        }
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

// Enregistrement du feedback utilisateur
export async function recordAriaFeedback(messageId: string, feedback: boolean) {
  return await prisma.ariaMessage.update({
    where: { id: messageId },
    data: { feedback }
  });
}
