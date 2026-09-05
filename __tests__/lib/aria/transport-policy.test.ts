import {
  buildAriaModelTransportRequest,
  resolveAriaModelTransportPolicy,
  type AriaModelIdentity,
} from '@/lib/aria/infrastructure/model/transport-policy';

const hosted = (model: string): AriaModelIdentity => ({ provider: 'OPENAI_HOSTED', model });
const local = (model: string): AriaModelIdentity => ({ provider: 'OPENAI_COMPATIBLE_LOCAL', model });

describe('ARIA model transport policy', () => {
  it.each(['openai/gpt-5-mini', 'gpt-5-mini'])(
    'TEST1 resolves the proven GPT-5-mini output-token field for %s, with no legacy field',
    (model) => {
      const policy = resolveAriaModelTransportPolicy(hosted(model));
      expect(policy.outputTokenParameter).toBe('max_completion_tokens');
      expect(policy.temperatureSupported).toBe(false);

      const request = buildAriaModelTransportRequest(hosted(model), { maxTokens: 500 });
      expect(request).toEqual({ max_completion_tokens: 500 });
      expect(request).not.toHaveProperty('max_tokens');
      expect(request).not.toHaveProperty('temperature');
    },
  );

  it('TEST2 resolves the current legacy-supported field for gpt-4o-mini, with no GPT-5-specific field', () => {
    const policy = resolveAriaModelTransportPolicy(hosted('gpt-4o-mini'));
    expect(policy.outputTokenParameter).toBe('max_tokens');
    expect(policy.temperatureSupported).toBe(true);

    const request = buildAriaModelTransportRequest(hosted('gpt-4o-mini'), { maxTokens: 500, temperature: 0.3 });
    expect(request).toEqual({ max_tokens: 500, temperature: 0.3 });
    expect(request).not.toHaveProperty('max_completion_tokens');
  });

  it('TEST3 fails closed for an unrecognised hosted model before any network call', () => {
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

  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
    'fails closed for the hosted prototype-property name %s instead of returning an inherited value',
    (model) => {
      expect(() => resolveAriaModelTransportPolicy(hosted(model))).toThrow(
        expect.objectContaining({
          code: 'INTERNAL_ERROR',
          internalDetails: { reasonCode: 'MODEL_TRANSPORT_POLICY_UNKNOWN' },
        }),
      );
    },
  );

  it('never sends both max_tokens and max_completion_tokens for the same model', () => {
    for (const model of ['openai/gpt-5-mini', 'gpt-5-mini', 'gpt-4o-mini']) {
      const request = buildAriaModelTransportRequest(hosted(model), { maxTokens: 1_500 });
      const hasLegacy = Object.hasOwn(request, 'max_tokens');
      const hasModern = Object.hasOwn(request, 'max_completion_tokens');
      expect(hasLegacy && hasModern).toBe(false);
      expect(hasLegacy || hasModern).toBe(true);
    }
  });

  it('applies the deployment default output-token budget when the caller does not override it', () => {
    expect(buildAriaModelTransportRequest(hosted('gpt-4o-mini'), {})).toMatchObject({ max_tokens: 1_500 });
    expect(buildAriaModelTransportRequest(hosted('gpt-5-mini'), {})).toMatchObject({ max_completion_tokens: 1_500 });
  });

  it('applies the deployment default temperature only for a model whose contract supports it', () => {
    expect(buildAriaModelTransportRequest(hosted('gpt-4o-mini'), {})).toMatchObject({ temperature: 0.7 });
    expect(buildAriaModelTransportRequest(hosted('gpt-5-mini'), {})).not.toHaveProperty('temperature');
  });

  it('keeps a known model on its explicit shape regardless of which provider serves it', () => {
    expect(resolveAriaModelTransportPolicy(local('gpt-4o-mini'))).toMatchObject({
      outputTokenParameter: 'max_tokens',
      temperatureSupported: true,
    });
  });

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
