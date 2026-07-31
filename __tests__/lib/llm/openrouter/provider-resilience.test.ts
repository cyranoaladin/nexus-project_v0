/** @jest-environment node */

import {
  buildProviderResilienceMatrix,
  reconcileProviderAuditAttemptCost,
  returnedProviderMatchesRoute,
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
const PROVIDERS = {
  data: [
    { name: 'Azure', slug: 'azure' },
    { name: 'Independent Synthetic', slug: 'independent-synthetic' },
    { name: 'Missing reasoning', slug: 'missing-reasoning' },
  ],
};

describe('OpenRouter provider resilience classification', () => {
  it('builds a safe capability matrix from official ZDR endpoint tags', () => {
    expect(buildProviderResilienceMatrix(CATALOG, PROVIDERS)).toEqual([
      {
        model: 'anthropic/claude-sonnet-5',
        availableZdrProviders: [
          { name: 'Azure', tag: 'azure', slug: 'azure' },
          {
            name: 'Independent Synthetic',
            tag: 'independent-synthetic/global',
            slug: 'independent-synthetic',
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
          { name: 'Azure', tag: 'azure', slug: 'azure' },
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
    expect(selectAlternativeProviderRoutes(CATALOG, PROVIDERS, {
      excludedProviderNames: ['Azure'],
      maxCalls: 2,
    })).toEqual([{
      model: 'anthropic/claude-sonnet-5',
      providerName: 'Independent Synthetic',
      providerTag: 'independent-synthetic/global',
      providerRoutingSlug: 'independent-synthetic',
      outputTokenParameter: 'max_tokens',
    }]);
  });

  it('returns no invented route when the catalog has only the current provider', () => {
    const azureOnly = {
      data: CATALOG.data.filter(({ provider_name }) =>
        provider_name === 'Azure'),
    };
    expect(selectAlternativeProviderRoutes(azureOnly, PROVIDERS, {
      excludedProviderNames: ['Azure'],
      maxCalls: 2,
    })).toEqual([]);
  });

  it('accepts a route only when the returned provider matches its identity', () => {
    const [route] = selectAlternativeProviderRoutes(CATALOG, PROVIDERS, {
      excludedProviderNames: ['Azure'],
      maxCalls: 1,
    });
    expect(returnedProviderMatchesRoute('Independent Synthetic', route))
      .toBe(true);
    expect(returnedProviderMatchesRoute('independent synthetic', route))
      .toBe(true);
    expect(returnedProviderMatchesRoute('Azure', route)).toBe(false);
    expect(returnedProviderMatchesRoute(null, route)).toBe(false);
  });

  it('rejects malformed or duplicate endpoint tags', () => {
    expect(() => buildProviderResilienceMatrix({
      data: [
        CATALOG.data[0],
        { ...CATALOG.data[0] },
      ],
    }, PROVIDERS)).toThrow();
    expect(() => buildProviderResilienceMatrix({
      data: [
        ...CATALOG.data,
        { model_id: 'unrelated/model', tag: '../ignored' },
      ],
    }, PROVIDERS)).not.toThrow();
    expect(() => buildProviderResilienceMatrix({
      data: [{
        ...CATALOG.data[0],
        tag: '../private',
      }],
    }, PROVIDERS)).toThrow();
  });

  it('counts a received response cost only once after a provider mismatch', () => {
    expect(reconcileProviderAuditAttemptCost({
      currentTotalMicrosUsd: 1_000,
      attemptCostMicrosUsd: 2_500,
      responseCostAlreadyCounted: true,
    })).toBe(1_000);
    expect(reconcileProviderAuditAttemptCost({
      currentTotalMicrosUsd: 1_000,
      attemptCostMicrosUsd: 2_500,
      responseCostAlreadyCounted: false,
    })).toBe(3_500);
  });
});
