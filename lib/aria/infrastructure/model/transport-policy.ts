import { AriaError } from '../../kernel/errors';
import type { AriaModelProvider } from './policy';

/**
 * The Chat Completions field that carries the output-token budget. `max_tokens`
 * is deprecated and incompatible with reasoning-tier models (OpenAI's own SDK
 * documents this); those models require `max_completion_tokens` instead. The
 * two must never be sent together.
 */
export type AriaModelOutputTokenParameter = 'max_tokens' | 'max_completion_tokens';

export interface AriaModelTransportPolicy {
  readonly model: string;
  readonly outputTokenParameter: AriaModelOutputTokenParameter;
  readonly temperatureSupported: boolean;
}

export interface AriaModelIdentity {
  readonly provider: AriaModelProvider;
  readonly model: string;
}

const DEFAULT_MAX_TOKENS = 1_500;
const DEFAULT_TEMPERATURE = 0.7;

/** Today's shape, unchanged by this policy: max_tokens + temperature. */
const LEGACY_TRANSPORT_SHAPE = Object.freeze({
  outputTokenParameter: 'max_tokens' as const,
  temperatureSupported: true,
});

/**
 * Explicit, exact-identity allowlist -- never a family regex. A model family
 * sharing a name prefix does not prove it shares a transport contract (see
 * nexus-project_v0 PR #193, where Sonnet and GPT-5.6 Terra needed different
 * output-token fields despite both being current-generation models).
 *
 * `openai/gpt-5-mini` (OpenRouter-routed) and `gpt-5-mini` (direct) are
 * GPT-5-family reasoning models: OpenAI's Chat Completions SDK documents
 * `max_tokens` as "not compatible with o-series/reasoning models", and this
 * organisation's own authenticated preflight evidence for a sibling GPT-5
 * reasoning model (`openai/gpt-5.6-terra`, nexus-project_v0 PR #193) confirms
 * both `max_completion_tokens` and omitting `temperature` entirely (the
 * policy there sets `temperature: { mode: 'OMIT' }`). That evidence is the
 * strongest available signal short of a live call against this exact model --
 * closed out by the one authorized post-merge synthetic canary call.
 *
 * Scoped to real, billed OPENAI_HOSTED identities only: sending the wrong
 * output-token field to one of these is a hard provider error. A
 * self-hosted OPENAI_COMPATIBLE_LOCAL endpoint (Ollama, vLLM, a disposable
 * E2E fixture) is never one of these identities -- see
 * `resolveAriaModelTransportPolicy` for why it still resolves safely.
 */
const ARIA_MODEL_TRANSPORT_POLICIES: Readonly<Record<string, AriaModelTransportPolicy>> = Object.freeze({
  'openai/gpt-5-mini': Object.freeze({
    model: 'openai/gpt-5-mini',
    outputTokenParameter: 'max_completion_tokens',
    temperatureSupported: false,
  }),
  'gpt-5-mini': Object.freeze({
    model: 'gpt-5-mini',
    outputTokenParameter: 'max_completion_tokens',
    temperatureSupported: false,
  }),
  'gpt-4o-mini': Object.freeze({
    model: 'gpt-4o-mini',
    outputTokenParameter: 'max_tokens',
    temperatureSupported: true,
  }),
});

/**
 * Fails closed before any network call for a real hosted identity: an
 * unrecognised OPENAI_HOSTED model never falls back to a guessed shape.
 *
 * OPENAI_COMPATIBLE_LOCAL is different in kind, not merely unregistered: it
 * is an operator-controlled, generically OpenAI-compatible endpoint (Ollama,
 * vLLM, a disposable E2E fixture) with no fixed model catalogue to allowlist
 * against, and every such endpoint this codebase has ever pointed at uses the
 * classic max_tokens + temperature shape -- exactly what every configured
 * local model already received before this policy existed. A local model
 * outside the explicit allowlist gets that unchanged legacy shape rather
 * than failing closed; only a real hosted identity that isn't proven is
 * refused.
 *
 * The allowlist only ever applies to OPENAI_HOSTED: an operator's local
 * endpoint sharing a name with a real hosted identity (e.g. a self-hosted
 * server labelled `gpt-5-mini` that is not actually OpenAI's model) must
 * never inherit that identity's proven contract on name alone -- it gets
 * the local legacy shape regardless of what it happens to be called.
 */
export function resolveAriaModelTransportPolicy(identity: AriaModelIdentity): AriaModelTransportPolicy {
  if (identity.provider === 'OPENAI_HOSTED' && Object.hasOwn(ARIA_MODEL_TRANSPORT_POLICIES, identity.model)) {
    return ARIA_MODEL_TRANSPORT_POLICIES[identity.model];
  }
  if (identity.provider === 'OPENAI_COMPATIBLE_LOCAL') {
    return Object.freeze({ model: identity.model, ...LEGACY_TRANSPORT_SHAPE });
  }
  throw new AriaError(
    'INTERNAL_ERROR',
    500,
    'Le service d’intelligence pédagogique ARIA est mal configuré.',
    { reasonCode: 'MODEL_TRANSPORT_POLICY_UNKNOWN' },
  );
}

export interface AriaModelTransportRequestOptions {
  readonly maxTokens?: number;
  readonly temperature?: number;
}

/**
 * The exact Chat Completions request fragment for one model: the correct
 * output-token field name, and `temperature` only when the model's proven
 * contract accepts it.
 */
export function buildAriaModelTransportRequest(
  identity: AriaModelIdentity,
  options: AriaModelTransportRequestOptions,
): Readonly<Record<string, number>> {
  const policy = resolveAriaModelTransportPolicy(identity);
  const tokenLimit = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  return Object.freeze({
    [policy.outputTokenParameter]: tokenLimit,
    ...(policy.temperatureSupported
      ? { temperature: options.temperature ?? DEFAULT_TEMPERATURE }
      : {}),
  });
}
