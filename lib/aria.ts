import { Subject } from '@prisma/client';
import OpenAI from 'openai';
import { prisma } from './prisma';

function getOpenAI(): { chat: { completions: { create: (args: any) => Promise<{ choices: { message: { content: string } }[] }> } } } {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    const client = new OpenAI({ apiKey });
    // Adapter pour retourner une forme homogène
    return {
      chat: {
        completions: {
          create: async (args: any) => {
            const res = await (client as any).chat.completions.create(args);
            return res;
          },
        },
      },
    } as any;
  }
  // Fallback sûr sans clé: renvoyer une réponse simulée
  return {
    chat: {
      completions: {
        create: async (_args: any) => ({ choices: [{ message: { content: 'Réponse simulée.' } }] }),
      },
    },
  } as any;
}

// Système de prompt pour ARIA
const ARIA_SYSTEM_PROMPT = `Tu es ARIA, l'assistant IA pédagogique de Nexus Réussite, spécialisé dans l'accompagnement des lycéens du système français en Tunisie.

RÈGLES IMPORTANTES :
1. Tu ne réponds QUE sur la matière demandée par l'élève.
2. Tes réponses sont basées sur la base de connaissances Nexus Réussite fournie dans le contexte.
3. Tu adaptes ton niveau au lycée (Seconde, Première, Terminale).
4. Tu es bienveillant, encourageant et pédagogue.
5. Tu proposes toujours des exemples concrets et détaillés.
6. Si tu ne sais pas, tu le dis et suggères de contacter un coach.

STYLE :
- Utilise un ton amical mais professionnel.
- Structure tes réponses clairement avec des titres et des listes.
- Utilise des émojis avec parcimonie pour illustrer tes points.
- Propose des exercices ou des méthodes pratiques à la fin de tes explications.

FORMAT SPÉCIFIQUE "FICHE DE COURS" :
Si un élève demande une "fiche de cours", "résumé de cours", ou un sujet similaire, tu dois générer une réponse particulièrement structurée. Utilise le format Markdown suivant :
- Un titre principal (ex: "# 📝 Fiche de Cours : [Nom du Chapitre]").
- Des sections claires avec des sous-titres (ex: "## 1. Concepts Clés", "## 2. Formules Essentielles", "## 3. Exemple Concret", "## 4. Exercice d'Application").
- Utilise des listes à puces pour les définitions.
- Encadre les formules mathématiques avec des backticks simples pour le LaTeX en ligne (ex: \`\\( E = mc^2 \\)\`).
- Conclus toujours par un encouragement.

Tu représentes l'excellence de Nexus Réussite.`;

// Recherche dans la base de connaissances (RAG)
async function searchKnowledgeBase(query: string, subject: Subject, limit: number = 3) {
  // Pour le MVP, on fait une recherche textuelle simple
  // Plus tard, on implémentera la recherche vectorielle avec pgvector

  const contents = await prisma.pedagogicalContent.findMany({
    where: {
      OR: [
        { title: { contains: query } },
        { content: { contains: query } }
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
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 1000,
      temperature: 0.7
    });

    return completion.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse.';

  } catch (error) {
    console.error('Erreur ARIA:', error);
    // Si c'est une erreur de permission, on la relance pour que l'API renvoie un statut d'erreur
    if (error instanceof OpenAI.APIError && error.status === 403) {
      throw error;
    }
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
        subject
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
