/**
 * Temporary public barrel for the canonical conversation prompt builder.
 * The implementation lives at the application use-case boundary.
 */
export {
  ARIA_MAX_MESSAGE_LENGTH,
  ARIA_SYSTEM_PROMPT,
  buildAriaPromptEnvelope,
  type AriaPromptContextParams,
  type FormattedPromptMessage,
} from './application/conversation/build-prompt';

export function getAriaModel(): string {
  return process.env.ARIA_MODEL || process.env.OPENAI_MODEL || 'gpt-4o';
}
