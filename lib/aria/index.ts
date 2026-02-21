/**
 * ARIA AI System - Main exports
 * Centralized exports for the ARIA AI pedagogical assistant
 */

export {
  generateEmbedding,
  searchKnowledgeBase,
  generateAriaResponse,
  saveAriaConversation,
  generateAriaStream,
  recordAriaFeedback
} from './aria';

export {
  generateAriaResponseStream
} from './aria-streaming';

export {
  ARIA_SYSTEM_PROMPT,
  OPENAI_CONFIG,
  RAG_CONFIG,
  STREAMING_CONFIG
} from './constants';

export {
  sanitizeUserPrompt,
  sanitizeRAGContent,
  validateAriaResponse,
  detectSuspiciousActivity
} from './security';
