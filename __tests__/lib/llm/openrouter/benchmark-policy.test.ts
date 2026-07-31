import {
  BILAN_BENCHMARK_POLICY,
  BILAN_BENCHMARK_POLICY_CHECKSUM,
  benchmarkOutputTokenParameter,
} from '@/lib/llm/openrouter/benchmark-policy';

describe('OpenRouter benchmark policy', () => {
  it('pins all candidates and transport parameters explicitly', () => {
    expect(BILAN_BENCHMARK_POLICY.models).toEqual([
      {
        id: 'openai/gpt-5.6-luna',
        outputTokenParameter: 'max_completion_tokens',
      },
      {
        id: 'openai/gpt-5.6-terra',
        outputTokenParameter: 'max_completion_tokens',
      },
      {
        id: 'anthropic/claude-sonnet-5',
        outputTokenParameter: 'max_tokens',
      },
    ]);
    expect(benchmarkOutputTokenParameter('openai/gpt-5.6-luna'))
      .toBe('max_completion_tokens');
    expect(BILAN_BENCHMARK_POLICY).toMatchObject({
      id: 'bilan-model-benchmark-policy',
      version: '1',
      maxOutputTokens: 2048,
      retryCount: 0,
      providerPolicy: {
        requireParameters: true,
        dataCollection: 'deny',
        zdr: true,
      },
    });
    expect(BILAN_BENCHMARK_POLICY_CHECKSUM).toMatch(/^[a-f0-9]{64}$/);
  });

  it('never contains auto/latest routing or sampling parameters', () => {
    const serialized = JSON.stringify(BILAN_BENCHMARK_POLICY);
    expect(serialized).not.toMatch(/openrouter\/auto|-latest/i);
    expect(serialized).not.toMatch(/temperature|topP|top_p|seed/i);
  });
});
