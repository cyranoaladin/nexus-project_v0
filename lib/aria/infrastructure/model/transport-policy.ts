import { AriaError } from '../../kernel/errors';

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

const DEFAULT_MAX_TOKENS = 1_500;
const DEFAULT_TEMPERATURE = 0.7;

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

/** Fails closed before any network call: an unrecognised model never falls back to a guessed shape. */
export function resolveAriaModelTransportPolicy(model: string): AriaModelTransportPolicy {
  const policy = ARIA_MODEL_TRANSPORT_POLICIES[model];
  if (!policy) {
    throw new AriaError(
      'INTERNAL_ERROR',
      500,
      'Le service d’intelligence pédagogique ARIA est mal configuré.',
      { reasonCode: 'MODEL_TRANSPORT_POLICY_UNKNOWN' },
    );
  }
  return policy;
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
  model: string,
  options: AriaModelTransportRequestOptions,
): Readonly<Record<string, number>> {
  const policy = resolveAriaModelTransportPolicy(model);
  const tokenLimit = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  return Object.freeze({
    [policy.outputTokenParameter]: tokenLimit,
    ...(policy.temperatureSupported
      ? { temperature: options.temperature ?? DEFAULT_TEMPERATURE }
      : {}),
  });
}
