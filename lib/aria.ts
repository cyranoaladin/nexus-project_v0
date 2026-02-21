import { Subject } from '@/types/enums';
import OpenAI from 'openai';
import { prisma } from './prisma';
import { logger } from './logger';
import { ARIA_SYSTEM_PROMPT, OPENAI_CONFIG, RAG_CONFIG } from './aria/constants';
import { sanitizeUserPrompt, sanitizeRAGContent, validateAriaResponse, detectSuspiciousActivity } from './aria/security';

// Validate OpenAI API key in production
if (process.env.NODE_ENV === 'production' && !process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required in production');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

// Génération d'embedding (New: Phase 2)
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Si pas de clé OpenAI (dev avec Ollama), on retourne un vecteur vide pour éviter le crash
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'ollama') {
        logger.warn("ARIA: Mode Ollama détecté ou clé manquante, recherche vectorielle désactivée.");
        return []; 
    }

    const response = await openai.embeddings.create({
      model: OPENAI_CONFIG.embeddingModel,
      input: text.replace(/\n/g, ' '),
    });
    return response.data[0].embedding;
  } catch (error) {
    logger.warn("ARIA: Erreur génération embedding", { error });
    return [];
  }
}

// Recherche dans la base de connaissances (RAG Vectoriel + Fallback)
export async function searchKnowledgeBase(query: string, subject: Subject, limit: number = RAG_CONFIG.resultsLimit) {
  try {
    // 1. Tenter la recherche vectorielle
    const queryEmbedding = await generateEmbedding(query);
    
    if (queryEmbedding.length > 0) {
        const vectorQuery = `[${queryEmbedding.join(',')}]`;
        
        // Requête brute pour pgvector
        const contents: any[] = await prisma.$queryRaw`
          SELECT id, title, content, 
                 1 - (embedding_vector <=> ${vectorQuery}::vector) as similarity
          FROM "pedagogical_contents"
          WHERE subject = ${subject}::"Subject"
          AND 1 - (embedding_vector <=> ${vectorQuery}::vector) > ${RAG_CONFIG.similarityThreshold} 
          ORDER BY embedding_vector <=> ${vectorQuery}::vector ASC
          LIMIT ${limit};
        `;
        
        if (contents.length > 0) {
            logger.info(`ARIA: ${contents.length} résultats vectoriels trouvés`, { query: query.substring(0, 50) });
            return contents;
        }
    }
  } catch (error) {
      logger.error("ARIA: Échec recherche vectorielle, bascule sur recherche mot-clé.", { error });
  }

  // 2. Fallback: Recherche textuelle simple (si vectoriel échoue ou pas de résultats)
  logger.info(`ARIA: Recherche mot-clé fallback`, { query: query.substring(0, 50) });
  const contents = await prisma.pedagogicalContent.findMany({
    where: {
      subject,
      OR: [
        { title: { contains: query } },
        { content: { contains: query } },
      ]
    },
    take: limit,
    orderBy: { createdAt: 'desc' }
  });

  return contents.map(c => ({ ...c, similarity: 0 })); // Score 0 pour keyword search
}

// Génération de réponse ARIA
export async function generateAriaResponse(
  studentId: string,
  subject: Subject,
  message: string,
  conversationHistory: Array<{ role: string; content: string; }> = []
): Promise<string> {
  try {
    // Security: Detect suspicious activity
    detectSuspiciousActivity(studentId, message);
    
    // Security: Sanitize user input to prevent prompt injection
    const sanitizedMessage = sanitizeUserPrompt(message, studentId);
    
    // Recherche dans la base de connaissances
    const knowledgeBase = await searchKnowledgeBase(sanitizedMessage, subject);

    // Construction du contexte (with sanitization)
    let context = '';
    if (knowledgeBase.length > 0) {
      context = '\n\nCONTEXTE NEXUS RÉUSSITE (Sources vérifiées) :\n';
      knowledgeBase.forEach((content, index) => {
        const score = content.similarity > 0 ? `(Pertinence: ${Math.round(content.similarity * 100)}%)` : '';
        // Security: Sanitize RAG content to prevent prompt injection
        const sanitizedContent = sanitizeRAGContent(content.content);
        const sanitizedTitle = sanitizeRAGContent(content.title);
        context += `${index + 1}. ${sanitizedTitle} ${score}\n${sanitizedContent}\n\n`;
      });
    } else {
        context = '\n\nNote: Aucune source spécifique trouvée dans la base Nexus. Réponds avec tes connaissances générales de manière prudente.\n';
    }

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
        content: `Matière : ${subject}\n\nQuestion : ${sanitizedMessage}`
      }
    ];

    // Appel à OpenAI (with token usage tracking)
    const completion = await openai.chat.completions.create({
      model: OPENAI_CONFIG.model,
      messages,
      max_tokens: OPENAI_CONFIG.maxTokens,
      temperature: OPENAI_CONFIG.temperature,
      user: studentId  // OpenAI user identifier for rate limiting
    });

    const response = completion.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse.';
    
    // Token usage tracking for cost monitoring
    if (completion.usage) {
      logger.info('ARIA token usage', {
        studentId,
        subject,
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
        model: OPENAI_CONFIG.model
      });
    }
    
    // Validate response quality
    const validation = validateAriaResponse(response, subject);
    if (!validation.valid) {
      logger.warn('ARIA response validation failed', {
        studentId,
        subject,
        reason: validation.reason
      });
      // Still return response, just log the warning
    }

    return response;

  } catch (error) {
    logger.error('Erreur ARIA:', { error, studentId, subject });
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
    conversation = await prisma.ariaConversation.findUnique({
      where: { id: conversationId }
    });
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

// Génération de réponse ARIA en streaming (with timeout and security)
export async function generateAriaStream(
  studentId: string,
  subject: Subject,
  message: string,
  conversationHistory: Array<{ role: string; content: string; }> = [],
  onComplete?: (fullResponse: string) => Promise<void>
): Promise<ReadableStream> {
  // Security: Detect suspicious activity
  detectSuspiciousActivity(studentId, message);
  
  // Security: Sanitize user input to prevent prompt injection
  const sanitizedMessage = sanitizeUserPrompt(message, studentId);
  
  // Recherche dans la base de connaissances
  const knowledgeBase = await searchKnowledgeBase(sanitizedMessage, subject);

  // Construction du contexte (with sanitization)
  let context = '';
  if (knowledgeBase.length > 0) {
    context = '\n\nCONTEXTE NEXUS RÉUSSITE (Sources vérifiées) :\n';
    knowledgeBase.forEach((content, index) => {
        const score = content.similarity > 0 ? `(Pertinence: ${Math.round(content.similarity * 100)}%)` : '';
        // Security: Sanitize RAG content
        const sanitizedContent = sanitizeRAGContent(content.content);
        const sanitizedTitle = sanitizeRAGContent(content.title);
        context += `${index + 1}. ${sanitizedTitle} ${score}\n${sanitizedContent}\n\n`;
    });
  }

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
      content: `Matière : ${subject}\n\nQuestion : ${sanitizedMessage}`
    }
  ];

  const stream = await openai.chat.completions.create({
    model: OPENAI_CONFIG.model,
    messages,
    max_tokens: OPENAI_CONFIG.maxTokens,
    temperature: OPENAI_CONFIG.temperature,
    stream: true,
    user: studentId
  });

  const encoder = new TextEncoder();
  let fullResponse = '';
  const startTime = Date.now();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          // Timeout protection (30 seconds max)
          if (Date.now() - startTime > 30000) {
            logger.warn('ARIA streaming timeout', { studentId, duration: Date.now() - startTime });
            controller.close();
            break;
          }
          
          // Length protection
          if (fullResponse.length > 5000) {
            logger.warn('ARIA streaming length exceeded', { studentId, length: fullResponse.length });
            controller.close();
            break;
          }
          
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            controller.enqueue(encoder.encode(content));
          }
        }
        
        controller.close();
        
        // Log token usage (estimate for streaming - actual usage in completion)
        logger.info('ARIA streaming completed', {
          studentId,
          subject,
          responseLength: fullResponse.length,
          duration: Date.now() - startTime
        });
        
        if (onComplete) {
          await onComplete(fullResponse);
        }
      } catch (e) {
        logger.error('ARIA streaming error', { error: e, studentId });
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
