import {
  buildAriaModelTransportRequest,
  resolveAriaModelTransportPolicy,
  type AriaModelIdentity,
} from '@/lib/aria/infrastructure/model/transport-policy';

const hosted = (model: string): AriaModelIdentity => ({ provider: 'OPENAI_HOSTED', model });
const openrouter = (model: string): AriaModelIdentity => ({ provider: 'OPENROUTER_HOSTED', model });
const local = (model: string): AriaModelIdentity => ({ provider: 'OPENAI_COMPATIBLE_LOCAL', model });

describe('ARIA model transport policy', () => {
  it('TEST1a resolves the proven GPT-5-mini output-token field for OPENAI_HOSTED gpt-5-mini, with no legacy field', () => {
    const policy = resolveAriaModelTransportPolicy(hosted('gpt-5-mini'));
    expect(policy.outputTokenParameter).toBe('max_completion_tokens');
    expect(policy.temperatureSupported).toBe(false);

    const request = buildAriaModelTransportRequest(hosted('gpt-5-mini'), { maxTokens: 500 });
    expect(request).toEqual({ max_completion_tokens: 500 });
    expect(request).not.toHaveProperty('max_tokens');
    expect(request).not.toHaveProperty('temperature');
  });

  it('TEST1b resolves the proven GPT-5-mini output-token field for OPENROUTER_HOSTED openai/gpt-5-mini, with no legacy field', () => {
    const policy = resolveAriaModelTransportPolicy(openrouter('openai/gpt-5-mini'));
    expect(policy.outputTokenParameter).toBe('max_completion_tokens');
    expect(policy.temperatureSupported).toBe(false);

    const request = buildAriaModelTransportRequest(openrouter('openai/gpt-5-mini'), { maxTokens: 500 });
    expect(request).toEqual({ max_completion_tokens: 500 });
    expect(request).not.toHaveProperty('max_tokens');
    expect(request).not.toHaveProperty('temperature');
  });

  it('TEST2 resolves the current legacy-supported field for gpt-4o-mini, with no GPT-5-specific field', () => {
    const policy = resolveAriaModelTransportPolicy(hosted('gpt-4o-mini'));
    expect(policy.outputTokenParameter).toBe('max_tokens');
    expect(policy.temperatureSupported).toBe(true);

    const request = buildAriaModelTransportRequest(hosted('gpt-4o-mini'), { maxTokens: 500, temperature: 0.3 });
    expect(request).toEqual({ max_tokens: 500, temperature: 0.3 });
    expect(request).not.toHaveProperty('max_completion_tokens');
  });

  it('TEST3a fails closed for an unrecognised OPENAI_HOSTED model before any network call', () => {
    expect(() => resolveAriaModelTransportPolicy(hosted('unknown-model'))).toThrow(
      expect.objectContaining({
        code: 'INTERNAL_ERROR',
        internalDetails: { reasonCode: 'MODEL_TRANSPORT_POLICY_UNKNOWN' },
      }),
    );
    expect(() => buildAriaModelTransportRequest(hosted('unknown-model'), { maxTokens: 500 })).toThrow(
      expect.objectContaining({
        code: 'INTERNAL_ERROR',
        internalDetails: { reasonCode: 'MODEL_TRANSPORT_POLICY_UNKNOWN' },
      }),
    );
  });

  it('TEST3b fails closed for an unrecognised OPENROUTER_HOSTED model before any network call', () => {
    expect(() => resolveAriaModelTransportPolicy(openrouter('unknown/model'))).toThrow(
      expect.objectContaining({
        code: 'INTERNAL_ERROR',
        internalDetails: { reasonCode: 'MODEL_TRANSPORT_POLICY_UNKNOWN' },
      }),
    );
  });

  it('scopes each allowlist to its own provider: neither provider inherits the other\'s model names', () => {
    // openai/gpt-5-mini is an OpenRouter routing identity -- never a valid
    // model string against api.openai.com directly -- and gpt-5-mini bare is
    // OpenAI's own direct identity, never OpenRouter's routing convention.
    expect(() => resolveAriaModelTransportPolicy(hosted('openai/gpt-5-mini'))).toThrow(
      expect.objectContaining({ internalDetails: { reasonCode: 'MODEL_TRANSPORT_POLICY_UNKNOWN' } }),
    );
    expect(() => resolveAriaModelTransportPolicy(openrouter('gpt-5-mini'))).toThrow(
      expect.objectContaining({ internalDetails: { reasonCode: 'MODEL_TRANSPORT_POLICY_UNKNOWN' } }),
    );
  });

  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
    'fails closed for the prototype-property name %s on both hosted providers instead of returning an inherited value',
    (model) => {
      expect(() => resolveAriaModelTransportPolicy(hosted(model))).toThrow(
        expect.objectContaining({
          code: 'INTERNAL_ERROR',
          internalDetails: { reasonCode: 'MODEL_TRANSPORT_POLICY_UNKNOWN' },
        }),
      );
      expect(() => resolveAriaModelTransportPolicy(openrouter(model))).toThrow(
        expect.objectContaining({
          code: 'INTERNAL_ERROR',
          internalDetails: { reasonCode: 'MODEL_TRANSPORT_POLICY_UNKNOWN' },
        }),
      );
    },
  );

  it('never sends both max_tokens and max_completion_tokens for the same model', () => {
    for (const identity of [hosted('gpt-5-mini'), openrouter('openai/gpt-5-mini'), hosted('gpt-4o-mini')]) {
      const request = buildAriaModelTransportRequest(identity, { maxTokens: 1_500 });
      const hasLegacy = Object.hasOwn(request, 'max_tokens');
      const hasModern = Object.hasOwn(request, 'max_completion_tokens');
      expect(hasLegacy && hasModern).toBe(false);
      expect(hasLegacy || hasModern).toBe(true);
    }
  });

  it('applies the deployment default output-token budget when the caller does not override it', () => {
    expect(buildAriaModelTransportRequest(hosted('gpt-4o-mini'), {})).toMatchObject({ max_tokens: 1_500 });
    expect(buildAriaModelTransportRequest(hosted('gpt-5-mini'), {})).toMatchObject({ max_completion_tokens: 1_500 });
    expect(buildAriaModelTransportRequest(openrouter('openai/gpt-5-mini'), {})).toMatchObject({
      max_completion_tokens: 1_500,
    });
  });

  it('applies the deployment default temperature only for a model whose contract supports it', () => {
    expect(buildAriaModelTransportRequest(hosted('gpt-4o-mini'), {})).toMatchObject({ temperature: 0.7 });
    expect(buildAriaModelTransportRequest(hosted('gpt-5-mini'), {})).not.toHaveProperty('temperature');
    expect(buildAriaModelTransportRequest(openrouter('openai/gpt-5-mini'), {})).not.toHaveProperty('temperature');
  });

  it.each(['gpt-5-mini', 'openai/gpt-5-mini', 'gpt-4o-mini'])(
    'gives a self-hosted endpoint merely named %s the local legacy shape, never a hosted contract',
    (model) => {
      // A local server sharing a name with a real hosted identity is not
      // that identity -- it must not inherit a contract it was never
      // proven to implement (cubic P1).
      const policy = resolveAriaModelTransportPolicy(local(model));
      expect(policy.outputTokenParameter).toBe('max_tokens');
      expect(policy.temperatureSupported).toBe(true);
      expect(buildAriaModelTransportRequest(local(model), {})).toMatchObject({
        max_tokens: 1_500,
        temperature: 0.7,
      });
    },
  );

  it.each(['aria-e2e', 'llama3.2', 'phi3:mini', 'qwen2.5-coder:7b'])(
    'gives an unregistered OPENAI_COMPATIBLE_LOCAL model %s the unchanged legacy shape instead of failing closed',
    (model) => {
      // Regression proof: docker-compose.e2e.yml configures ARIA_MODEL=aria-e2e
      // for the disposable OPENAI_COMPATIBLE_LOCAL fixture provider, and an
      // operator may point ARIA_MODEL_FALLBACK at any self-hosted Ollama/vLLM
      // model name -- neither is a real OpenAI catalogue identity, and there
      // is no fixed list to allowlist a self-hosted endpoint against. Every
      // local model received this exact shape before this policy existed.
      const policy = resolveAriaModelTransportPolicy(local(model));
      expect(policy).toMatchObject({ outputTokenParameter: 'max_tokens', temperatureSupported: true });
      expect(buildAriaModelTransportRequest(local(model), { maxTokens: 500, temperature: 0.4 })).toEqual({
        max_tokens: 500,
        temperature: 0.4,
      });
    },
  );
});
