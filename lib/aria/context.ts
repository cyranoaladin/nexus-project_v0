/**
 * Compatibility-free public location for the canonical conversation context.
 * New imports should use application/conversation/public; no studentId-based
 * resolver or legacy entitlement parser is exposed here.
 */
export {
  buildAriaConversationContext,
  type AriaConversationContext,
  type BuildAriaConversationContextInput,
} from './application/conversation/public';
