import { Subject } from '@/types/enums';
import OpenAI from 'openai';
import { prisma } from './prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
  baseURL: process.env.OPENAI_BASE_URL || undefined,
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

// Génération d'embedding (New: Phase 2)
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Si pas de clé OpenAI (dev avec Ollama), on retourne un vecteur vide pour éviter le crash
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'ollama') {
        console.warn("ARIA: Mode Ollama détecté ou clé manquante, recherche vectorielle désactivée.");
        return []; 
    }

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.replace(/\n/g, ' '),
    });
    return response.data[0].embedding;
  } catch (error) {
    console.warn("ARIA: Erreur génération embedding", error);
    return [];
  }
}

// Recherche dans la base de connaissances (RAG Vectoriel + Fallback)
async function searchKnowledgeBase(query: string, subject: Subject, limit: number = 3) {
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
          AND 1 - (embedding_vector <=> ${vectorQuery}::vector) > 0.4 
          ORDER BY embedding_vector <=> ${vectorQuery}::vector ASC
          LIMIT ${limit};
        `;
        
        if (contents.length > 0) {
            console.log(`ARIA: ${contents.length} résultats vectoriels trouvés pour "${query}"`);
            return contents;
        }
    }
  } catch (error) {
      console.error("ARIA: Échec recherche vectorielle, bascule sur recherche mot-clé.", error);
  }

  // 2. Fallback: Recherche textuelle simple (si vectoriel échoue ou pas de résultats)
  console.log(`ARIA: Recherche mot-clé fallback pour "${query}"`);
  const contents = await prisma.pedagogicalContent.findMany({
    where: {
      subject,
      OR: [
        { title: { contains: query } }, // removed mode: insensitive as it might not be supported by all adapters or types
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
    // Recherche dans la base de connaissances
    const knowledgeBase = await searchKnowledgeBase(message, subject);

    // Construction du contexte
    let context = '';
    if (knowledgeBase.length > 0) {
      context = '\n\nCONTEXTE NEXUS RÉUSSITE (Sources vérifiées) :\n';
      knowledgeBase.forEach((content, index) => {
        const score = content.similarity > 0 ? `(Pertinence: ${Math.round(content.similarity * 100)}%)` : '';
        context += `${index + 1}. ${content.title} ${score}\n${content.content}\n\n`;
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
        content: `Matière : ${subject}\n\nQuestion : ${message}`
      }
    ];

    // Appel à OpenAI
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
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

// Génération de réponse ARIA en streaming
export async function generateAriaStream(
  studentId: string,
  subject: Subject,
  message: string,
  conversationHistory: Array<{ role: string; content: string; }> = [],
  onComplete?: (fullResponse: string) => Promise<void>
): Promise<ReadableStream> {
  // Recherche dans la base de connaissances
  const knowledgeBase = await searchKnowledgeBase(message, subject);

  // Construction du contexte
  let context = '';
  if (knowledgeBase.length > 0) {
    context = '\n\nCONTEXTE NEXUS RÉUSSITE (Sources vérifiées) :\n';
    knowledgeBase.forEach((content, index) => {
        const score = content.similarity > 0 ? `(Pertinence: ${Math.round(content.similarity * 100)}%)` : '';
      context += `${index + 1}. ${content.title} ${score}\n${content.content}\n\n`;
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
