import { Subject } from '@/types/enums';
import OpenAI from 'openai';
import { prisma } from './prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Système de prompt pour ARIA
const ARIA_SYSTEM_PROMPT = `Tu es ARIA, l'assistant IA pédagogique de Nexus Réussite, spécialisé dans l'accompagnement des lycéens du système français en Tunisie.

RÈGLES IMPORTANTES :
1. Tu ne réponds QUE sur la matière demandée par l'élève
2. Tes réponses sont basées sur la base de connaissances Nexus Réussite
3. Tu adaptes ton niveau au lycée (Seconde, Première, Terminale)
4. Tu es bienveillant, encourageant et pédagogue
5. Tu proposes toujours des exemples concrets
6. Si tu ne sais pas, tu le dis et suggères de contacter un coach

STYLE :
- Utilise un ton amical mais professionnel
- Structure tes réponses clairement
- Utilise des émojis avec parcimonie
- Propose des exercices ou des méthodes pratiques

Tu représentes l'excellence de Nexus Réussite.`;

// Recherche dans la base de connaissances (RAG)
async function searchKnowledgeBase(query: string, subject: Subject, limit: number = 3) {
  // Pour le MVP, on fait une recherche textuelle simple
  // Plus tard, on implémentera la recherche vectorielle avec pgvector

  const contents = await prisma.pedagogicalContent.findMany({
    where: {
      subject,
      OR: [
        { title: { contains: query } },
        { content: { contains: query } },
        { tags: { contains: query } } // Changé de hasSome à contains pour JSON string
      ]
    },
    take: limit,
    orderBy: { createdAt: 'desc' }
  });

  return contents;
}

// Génération de réponse ARIA
export async function generateAriaResponse(
  studentId: string,
  subject: Subject,
  message: string,
  conversationHistory: Array<{ role: string; content: string; }> = []
): Promise<string> {
  try {
    // Recherche dans la base de connaissances
    const knowledgeBase = await searchKnowledgeBase(message, subject);

    // Construction du contexte
    let context = '';
    if (knowledgeBase.length > 0) {
      context = '\n\nCONTEXTE NEXUS RÉUSSITE :\n';
      knowledgeBase.forEach((content, index) => {
        context += `${index + 1}. ${content.title}\n${content.content}\n\n`;
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
        content: `Matière : ${subject}\n\nQuestion : ${message}`
      }
    ];

    // Appel à OpenAI
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const completion = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: 1000,
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

// Enregistrement du feedback utilisateur
export async function recordAriaFeedback(messageId: string, feedback: boolean) {
  return await prisma.ariaMessage.update({
    where: { id: messageId },
    data: { feedback }
  });
}
