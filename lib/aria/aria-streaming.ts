import { Subject } from '@/types/enums';
import OpenAI from 'openai';
import { logger } from '@/lib/logger';
import { ARIA_SYSTEM_PROMPT, OPENAI_CONFIG } from './constants';
import { sanitizeUserPrompt, sanitizeRAGContent, detectSuspiciousActivity } from './security';
import { searchKnowledgeBase } from './aria';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

export async function generateAriaResponseStream(
  studentId: string,
  subject: Subject,
  message: string,
  conversationHistory: Array<{ role: string; content: string; }> = []
): Promise<ReadableStream> {
  // Security: Detect suspicious activity and sanitize input
  detectSuspiciousActivity(studentId, message);
  const sanitizedMessage = sanitizeUserPrompt(message, studentId);
  
  // Use shared vectorial search (unified RAG implementation)
  const knowledgeBase = await searchKnowledgeBase(sanitizedMessage, subject);

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
  const startTime = Date.now();
  let fullResponse = '';

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          // Timeout protection (30 seconds)
          if (Date.now() - startTime > 30000) {
            logger.warn('ARIA streaming timeout', { studentId, duration: Date.now() - startTime });
            controller.enqueue(encoder.encode('data: [TIMEOUT]\n\n'));
            controller.close();
            break;
          }
          
          // Length protection
          if (fullResponse.length > 5000) {
            logger.warn('ARIA streaming length exceeded', { studentId, length: fullResponse.length });
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            break;
          }
          
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            fullResponse += content;
            const data = `data: ${JSON.stringify({ content })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        }
        
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        
        logger.info('ARIA streaming completed', {
          studentId,
          subject,
          responseLength: fullResponse.length,
          duration: Date.now() - startTime
        });
      } catch (error) {
        logger.error('Streaming error:', { error, studentId });
        const errorData = `data: ${JSON.stringify({ error: 'Streaming error occurred' })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    }
  });
}
