import {
  buildAriaModelTransportRequest,
  resolveAriaModelTransportPolicy,
} from '@/lib/aria/infrastructure/model/transport-policy';

describe('ARIA model transport policy', () => {
  it.each(['openai/gpt-5-mini', 'gpt-5-mini'])(
    'TEST1 resolves the proven GPT-5-mini output-token field for %s, with no legacy field',
    (model) => {
      const policy = resolveAriaModelTransportPolicy(model);
      expect(policy.outputTokenParameter).toBe('max_completion_tokens');
      expect(policy.temperatureSupported).toBe(false);

      const request = buildAriaModelTransportRequest(model, { maxTokens: 500 });
      expect(request).toEqual({ max_completion_tokens: 500 });
      expect(request).not.toHaveProperty('max_tokens');
      expect(request).not.toHaveProperty('temperature');
    },
  );

  it('TEST2 resolves the current legacy-supported field for gpt-4o-mini, with no GPT-5-specific field', () => {
    const policy = resolveAriaModelTransportPolicy('gpt-4o-mini');
    expect(policy.outputTokenParameter).toBe('max_tokens');
    expect(policy.temperatureSupported).toBe(true);

    const request = buildAriaModelTransportRequest('gpt-4o-mini', { maxTokens: 500, temperature: 0.3 });
    expect(request).toEqual({ max_tokens: 500, temperature: 0.3 });
    expect(request).not.toHaveProperty('max_completion_tokens');
  });

  it('TEST3 fails closed for an unrecognised model before any network call', () => {
    expect(() => resolveAriaModelTransportPolicy('unknown-model')).toThrow(
      expect.objectContaining({
        code: 'INTERNAL_ERROR',
        internalDetails: { reasonCode: 'MODEL_TRANSPORT_POLICY_UNKNOWN' },
      }),
    );
    expect(() => buildAriaModelTransportRequest('unknown-model', { maxTokens: 500 })).toThrow(
      expect.objectContaining({
        code: 'INTERNAL_ERROR',
        internalDetails: { reasonCode: 'MODEL_TRANSPORT_POLICY_UNKNOWN' },
      }),
    );
  });

  it('never sends both max_tokens and max_completion_tokens for the same model', () => {
    for (const model of ['openai/gpt-5-mini', 'gpt-5-mini', 'gpt-4o-mini']) {
      const request = buildAriaModelTransportRequest(model, { maxTokens: 1_500 });
      const hasLegacy = Object.hasOwn(request, 'max_tokens');
      const hasModern = Object.hasOwn(request, 'max_completion_tokens');
      expect(hasLegacy && hasModern).toBe(false);
      expect(hasLegacy || hasModern).toBe(true);
    }
  });

  it('applies the deployment default output-token budget when the caller does not override it', () => {
    expect(buildAriaModelTransportRequest('gpt-4o-mini', {})).toMatchObject({ max_tokens: 1_500 });
    expect(buildAriaModelTransportRequest('gpt-5-mini', {})).toMatchObject({ max_completion_tokens: 1_500 });
  });

  it('applies the deployment default temperature only for a model whose contract supports it', () => {
    expect(buildAriaModelTransportRequest('gpt-4o-mini', {})).toMatchObject({ temperature: 0.7 });
    expect(buildAriaModelTransportRequest('gpt-5-mini', {})).not.toHaveProperty('temperature');
  });
});
