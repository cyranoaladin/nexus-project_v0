import { Subject } from '@/types/enums';
import OpenAI from 'openai';
import { prisma } from './prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

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

async function searchKnowledgeBase(query: string, subject: Subject, limit: number = 3) {
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

  return contents;
}

export async function generateAriaResponseStream(
  studentId: string,
  subject: Subject,
  message: string,
  conversationHistory: Array<{ role: string; content: string; }> = []
): Promise<ReadableStream> {
  const knowledgeBase = await searchKnowledgeBase(message, subject);

  let context = '';
  if (knowledgeBase.length > 0) {
    context = '\n\nCONTEXTE NEXUS RÉUSSITE :\n';
    knowledgeBase.forEach((content, index) => {
      context += `${index + 1}. ${content.title}\n${content.content}\n\n`;
    });
  }

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
