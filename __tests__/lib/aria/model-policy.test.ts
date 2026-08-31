import {
  getAriaModelCapabilities,
  resolveAriaModelPolicy,
  type AriaConfiguredModel,
} from '@/lib/aria/infrastructure/model/policy';

const textModel: AriaConfiguredModel = {
  provider: 'OPENAI_HOSTED',
  model: 'text-model',
  capabilityProfile: 'TEXT_STANDARD',
  capabilities: {
    vision: false,
    reasoning: false,
    structuredOutput: false,
    toolCalling: false,
    contextTokens: 16_384,
    latencyClass: 'STANDARD',
    costClass: 'STANDARD',
  },
};

const capableFallback: AriaConfiguredModel = {
  ...textModel,
  provider: 'OPENAI_COMPATIBLE_LOCAL',
  model: 'fallback-model',
};

describe('ARIA capability-based model policy', () => {
  it('rejects an unknown capability profile without synthesizing capabilities', () => {
    expect(getAriaModelCapabilities('UNKNOWN_PROFILE')).toBeNull();
  });

  it('selects a model only when every required capability is satisfied', () => {
    expect(resolveAriaModelPolicy({
      candidates: [textModel],
      fallbackAuthorized: false,
      requirements: {
        vision: false,
        reasoning: false,
        structuredOutput: false,
        toolCalling: false,
        minimumContextTokens: 8_192,
        maximumLatencyClass: 'STANDARD',
        maximumCostClass: 'STANDARD',
      },
    })).toMatchObject({ primary: { model: 'text-model' }, fallbacks: [] });
  });

  it('U046 fails closed on a capability mismatch', () => {
    expect(() => resolveAriaModelPolicy({
      candidates: [textModel],
      fallbackAuthorized: false,
      requirements: {
        vision: true,
        reasoning: false,
        structuredOutput: false,
        toolCalling: false,
        minimumContextTokens: 8_192,
        maximumLatencyClass: 'STANDARD',
        maximumCostClass: 'STANDARD',
      },
    })).toThrow(expect.objectContaining({ code: 'MODEL_UNAVAILABLE' }));
  });

  it.each([
    ['reasoning', { reasoning: true }],
    ['structured output', { structuredOutput: true }],
    ['tool calling', { toolCalling: true }],
  ] as const)('fails closed when the primary lacks required %s', (_label, override) => {
    expect(() => resolveAriaModelPolicy({
      candidates: [textModel],
      fallbackAuthorized: false,
      requirements: {
        vision: false,
        reasoning: false,
        structuredOutput: false,
        toolCalling: false,
        minimumContextTokens: 8_192,
        maximumLatencyClass: 'STANDARD',
        maximumCostClass: 'STANDARD',
        ...override,
      },
    })).toThrow(expect.objectContaining({ code: 'MODEL_UNAVAILABLE' }));
  });

  it('exposes only capability-equivalent fallbacks when explicitly authorized', () => {
    expect(resolveAriaModelPolicy({
      candidates: [textModel, capableFallback],
      fallbackAuthorized: true,
      requirements: {
        vision: false,
        reasoning: false,
        structuredOutput: false,
        toolCalling: false,
        minimumContextTokens: 8_192,
        maximumLatencyClass: 'STANDARD',
        maximumCostClass: 'STANDARD',
      },
    }).fallbacks).toEqual([capableFallback]);
    expect(resolveAriaModelPolicy({
      candidates: [textModel, capableFallback],
      fallbackAuthorized: false,
      requirements: {
        vision: false,
        reasoning: false,
        structuredOutput: false,
        toolCalling: false,
        minimumContextTokens: 8_192,
        maximumLatencyClass: 'STANDARD',
        maximumCostClass: 'STANDARD',
      },
    }).fallbacks).toEqual([]);
  });
});
