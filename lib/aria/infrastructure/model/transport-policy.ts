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

function legacyPolicy(model: string): AriaModelTransportPolicy {
  return Object.freeze({ model, ...LEGACY_TRANSPORT_SHAPE });
}

/**
 * Explicit, exact-identity allowlists -- never a family regex, and never
 * shared by name across providers. A model family sharing a name prefix does
 * not prove it shares a transport contract (see nexus-project_v0 PR #193,
 * where Sonnet and GPT-5.6 Terra needed different output-token fields despite
 * both being current-generation models), and a name is not a provider: a
 * self-hosted endpoint merely labelled `gpt-5-mini` is not OpenAI's model and
 * must never inherit its contract, so each allowlist is keyed by the exact
 * (provider, model) pair via two separate provider-scoped maps rather than
 * one map shared across providers.
 *
 * `gpt-5-mini` direct on OPENAI_HOSTED and `openai/gpt-5-mini` routed through
 * OPENROUTER_HOSTED are GPT-5-family reasoning models: OpenAI's Chat
 * Completions SDK documents `max_tokens` as "not compatible with
 * o-series/reasoning models", and this organisation's own authenticated
 * preflight evidence for a sibling GPT-5 reasoning model
 * (`openai/gpt-5.6-terra`, nexus-project_v0 PR #193) confirms both
 * `max_completion_tokens` and omitting `temperature` entirely (the policy
 * there sets `temperature: { mode: 'OMIT' }`). That evidence is the strongest
 * available signal short of a live call against this exact model -- closed
 * out by the one authorized post-merge synthetic canary call.
 */
const OPENAI_HOSTED_TRANSPORT_POLICIES: Readonly<Record<string, AriaModelTransportPolicy>> = Object.freeze({
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
 * OpenRouter uses its own `provider/model` routing convention -- `openai/gpt-5-mini`
 * is an OpenRouter-specific identity, never a valid model string against
 * api.openai.com directly, so it is never registered under OPENAI_HOSTED.
 */
const OPENROUTER_HOSTED_TRANSPORT_POLICIES: Readonly<Record<string, AriaModelTransportPolicy>> = Object.freeze({
  'openai/gpt-5-mini': Object.freeze({
    model: 'openai/gpt-5-mini',
    outputTokenParameter: 'max_completion_tokens',
    temperatureSupported: false,
  }),
});

/**
 * Fails closed before any network call for a real hosted identity
 * (OPENAI_HOSTED or OPENROUTER_HOSTED): an unrecognised model on either never
 * falls back to a guessed shape.
 *
 * OPENAI_COMPATIBLE_LOCAL is different in kind, not merely unregistered: it
 * is an operator-controlled, generically OpenAI-compatible endpoint (Ollama,
 * vLLM, a disposable E2E fixture) with no fixed model catalogue to allowlist
 * against, and every such endpoint this codebase has ever pointed at uses the
 * classic max_tokens + temperature shape -- exactly what every configured
 * local model already received before this policy existed. A local model
 * gets that unchanged legacy shape regardless of what it happens to be
 * named, even if the name collides with a real hosted identity's -- a local
 * endpoint sharing a name with a real hosted model is not that model and
 * must never inherit a contract it was never proven to implement.
 */
export function resolveAriaModelTransportPolicy(identity: AriaModelIdentity): AriaModelTransportPolicy {
  if (identity.provider === 'OPENAI_COMPATIBLE_LOCAL') {
    return legacyPolicy(identity.model);
  }
  const allowlist = identity.provider === 'OPENAI_HOSTED'
    ? OPENAI_HOSTED_TRANSPORT_POLICIES
    : OPENROUTER_HOSTED_TRANSPORT_POLICIES;
  if (Object.hasOwn(allowlist, identity.model)) {
    return allowlist[identity.model];
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
