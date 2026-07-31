/** @jest-environment node */

import {
  buildProviderResilienceMatrix,
  selectAlternativeProviderRoutes,
} from '@/lib/llm/openrouter/provider-resilience';

const CATALOG = {
  data: [
    {
      model_id: 'anthropic/claude-sonnet-5',
      provider_name: 'Azure',
      tag: 'azure',
      supported_parameters: [
        'response_format',
        'structured_outputs',
        'reasoning',
        'max_tokens',
      ],
    },
    {
      model_id: 'anthropic/claude-sonnet-5',
      provider_name: 'Independent Synthetic',
      tag: 'independent-synthetic/global',
      supported_parameters: [
        'response_format',
        'structured_outputs',
        'reasoning',
        'max_tokens',
      ],
    },
    {
      model_id: 'openai/gpt-5.6-terra',
      provider_name: 'Azure',
      tag: 'azure',
      supported_parameters: [
        'response_format',
        'structured_outputs',
        'reasoning',
        'max_completion_tokens',
      ],
    },
    {
      model_id: 'openai/gpt-5.6-terra',
      provider_name: 'Missing reasoning',
      tag: 'missing-reasoning',
      supported_parameters: [
        'response_format',
        'structured_outputs',
        'max_completion_tokens',
      ],
    },
  ],
};

describe('OpenRouter provider resilience classification', () => {
  it('builds a safe capability matrix from official ZDR endpoint tags', () => {
    expect(buildProviderResilienceMatrix(CATALOG)).toEqual([
      {
        model: 'anthropic/claude-sonnet-5',
        availableZdrProviders: [
          { name: 'Azure', tag: 'azure' },
          {
            name: 'Independent Synthetic',
            tag: 'independent-synthetic/global',
          },
        ],
        dataCollectionDenyCompatible: 'REQUEST_ENFORCEMENT_REQUIRED',
        structuredOutputCompatible: true,
        reasoningLowCompatible: true,
        outputTokenParameter: 'max_tokens',
        preflightStatus: 'NOT_RUN',
      },
      {
        model: 'openai/gpt-5.6-terra',
        availableZdrProviders: [
          { name: 'Azure', tag: 'azure' },
        ],
        dataCollectionDenyCompatible: 'REQUEST_ENFORCEMENT_REQUIRED',
        structuredOutputCompatible: true,
        reasoningLowCompatible: true,
        outputTokenParameter: 'max_completion_tokens',
        preflightStatus: 'NOT_RUN',
      },
    ]);
  });

  it('selects only compatible non-Azure routes with a global two-call cap', () => {
    expect(selectAlternativeProviderRoutes(CATALOG, {
      excludedProviderNames: ['Azure'],
      maxCalls: 2,
    })).toEqual([{
      model: 'anthropic/claude-sonnet-5',
      providerName: 'Independent Synthetic',
      providerTag: 'independent-synthetic/global',
      outputTokenParameter: 'max_tokens',
    }]);
  });

  it('returns no invented route when the catalog has only the current provider', () => {
    const azureOnly = {
      data: CATALOG.data.filter(({ provider_name }) =>
        provider_name === 'Azure'),
    };
    expect(selectAlternativeProviderRoutes(azureOnly, {
      excludedProviderNames: ['Azure'],
      maxCalls: 2,
    })).toEqual([]);
  });

  it('rejects malformed or duplicate endpoint tags', () => {
    expect(() => buildProviderResilienceMatrix({
      data: [
        CATALOG.data[0],
        { ...CATALOG.data[0] },
      ],
    })).toThrow();
    expect(() => buildProviderResilienceMatrix({
      data: [
        ...CATALOG.data,
        { model_id: 'unrelated/model', tag: '../ignored' },
      ],
    })).not.toThrow();
    expect(() => buildProviderResilienceMatrix({
      data: [{
        ...CATALOG.data[0],
        tag: '../private',
      }],
    })).toThrow();
  });
});
