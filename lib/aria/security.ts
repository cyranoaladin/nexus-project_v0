/**
 * ARIA AI Security Utilities
 * Protects against prompt injection, validates content, and sanitizes inputs
 */

import { logger } from '@/lib/logger';

/**
 * Dangerous patterns that indicate prompt injection attempts
 */
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?|commands?)/i,
  /forget\s+(everything|all|what)\s+(you\s+)?(learned|know|above|before)/i,
  /you\s+are\s+now\s+(?!a\s+student|learning|studying)/i,
  /system:\s*/i,
  /assistant:\s*/i,
  /\[INST\]/i,
  /\<\|.*?\|\>/g,  // Special tokens like <|endoftext|>
  /act\s+as\s+(?!a\s+teacher|an?\s+educator|helpful)/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /disregard\s+(your|the)\s+(instructions?|rules?|guidelines?)/i,
];

/**
 * Sanitize user input to prevent prompt injection
 * 
 * @param message - User message
 * @param userId - User ID for logging
 * @returns Sanitized message
 */
export function sanitizeUserPrompt(message: string, userId?: string): string {
  let sanitized = message;
  let detected = false;

  // Check for dangerous patterns
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      detected = true;
      logger.warn('Potential prompt injection detected', {
        userId,
        pattern: pattern.toString(),
        messagePreview: message.substring(0, 100)
      });
      
      // Replace dangerous content
      sanitized = sanitized.replace(pattern, '[CONTENU FILTRÉ]');
    }
  }

  // Additional sanitization
  // Remove special tokens that could confuse the LLM
  sanitized = sanitized.replace(/<\|[\w-]+\|>/g, '');
  
  // Limit length (defense in depth - Zod already validates max 1000)
  if (sanitized.length > 2000) {
    sanitized = sanitized.substring(0, 2000);
    logger.warn('Message truncated due to excessive length', { userId });
  }

  if (detected) {
    logger.logSecurityEvent?.('prompt_injection_attempt', 400, {
      userId,
      messageLength: message.length,
      sanitized: true
    });
  }

  return sanitized;
}

/**
 * Sanitize RAG context before injecting into system prompt
 * Prevents RAG content from containing prompt injection payloads
 * 
 * @param text - RAG retrieved content
 * @returns Sanitized content
 */
export function sanitizeRAGContent(text: string): string {
  let sanitized = text;

  // Remove special tokens
  sanitized = sanitized.replace(/<\|.*?\|>/g, '');
  
  // Remove role markers that could confuse the LLM
  sanitized = sanitized.replace(/\b(system|user|assistant):\s*/gi, '');
  
  // Limit length per content piece (5000 chars max)
  if (sanitized.length > 5000) {
    sanitized = sanitized.substring(0, 5000) + '... [tronqué]';
  }

  return sanitized;
}

/**
 * Validate ARIA response for relevance and safety
 * 
 * @param response - LLM generated response
 * @param subject - Expected subject (MATHEMATIQUES or NSI)
 * @returns Validation result
 */
export function validateAriaResponse(
  response: string,
  subject: string
): { valid: boolean; reason?: string } {
  // Check minimum length
  if (response.length < 10) {
    return { valid: false, reason: 'too_short' };
  }

  // Check for completely off-topic responses (basic heuristic)
  const subjectKeywords: Record<string, string[]> = {
    MATHEMATIQUES: ['math', 'équation', 'fonction', 'calcul', 'nombre', 'formule', 'géométrie', 'algèbre'],
    NSI: ['python', 'algorithme', 'code', 'programmation', 'variable', 'fonction', 'boucle', 'données']
  };

  const keywords = subjectKeywords[subject] || [];
  
  // Only flag as off-topic if response is long AND has no subject keywords
  if (response.length > 200) {
    const lowerResponse = response.toLowerCase();
    const containsSubject = keywords.some(kw => lowerResponse.includes(kw));
    
    if (!containsSubject) {
      logger.warn('ARIA response appears off-topic', {
        subject,
        responsePreview: response.substring(0, 100)
      });
      // Don't block, just log (pedagogical context might be broad)
      // return { valid: false, reason: 'off_topic' };
    }
  }

  return { valid: true };
}

/**
 * Detect and log suspicious user behavior patterns
 * 
 * @param userId - User ID
 * @param message - User message
 */
export function detectSuspiciousActivity(userId: string, message: string): void {
  const suspiciousPatterns = [
    { pattern: /system.*prompt/i, label: 'system_prompt_query' },
    { pattern: /your\s+instructions/i, label: 'instruction_query' },
    { pattern: /base.*knowledge/i, label: 'knowledge_base_query' },
    { pattern: /dall-e|gpt-4|openai/i, label: 'model_reference' },
  ];

  for (const { pattern, label } of suspiciousPatterns) {
    if (pattern.test(message)) {
      logger.info('Suspicious ARIA activity detected', {
        userId,
        pattern: label,
        messagePreview: message.substring(0, 50)
      });
    }
  }
}
