/**
 * Pure unit tests for the C2 AI pilot preflight (mission §5) — no DB, no
 * real network. The ZDR fixture below is a trimmed copy of the REAL rows
 * captured from a live `GET /api/v1/endpoints/zdr` call on 2026-09-22 for
 * anthropic/claude-sonnet-4.5 (4 rows: 2 Amazon Bedrock tags, which support
 * response_format, and 2 Google Vertex tags, which do not) — never
 * fabricated pricing or capability data.
 */
import { buildCompliantProviderPreferences, runOpenRouterPreflight } from '@/lib/core-v2/diagnostics/openrouter-preflight';

const REAL_ZDR_ROWS_FOR_SONNET_45 = [
  {
    model_id: 'anthropic/claude-sonnet-4.5',
    provider_name: 'Amazon Bedrock',
    tag: 'amazon-bedrock/eu-west-1',
    pricing: { prompt: '0.0000033', completion: '0.0000165' },
    supported_parameters: ['reasoning', 'max_tokens', 'temperature', 'top_p', 'tools', 'tool_choice', 'structured_outputs', 'response_format'],
  },
  {
    model_id: 'anthropic/claude-sonnet-4.5',
    provider_name: 'Google',
    tag: 'google-vertex/us-east5',
    pricing: { prompt: '0.0000033', completion: '0.0000165' },
    supported_parameters: ['max_tokens', 'temperature', 'top_p', 'tools', 'tool_choice'],
  },
  {
    model_id: 'anthropic/claude-sonnet-4.5',
    provider_name: 'Amazon Bedrock',
    tag: 'amazon-bedrock',
    pricing: { prompt: '0.000003', completion: '0.000015' },
    supported_parameters: ['reasoning', 'max_tokens', 'temperature', 'top_p', 'tools', 'tool_choice', 'structured_outputs', 'response_format'],
  },
  {
    model_id: 'anthropic/claude-sonnet-4.5',
    provider_name: 'Google',
    tag: 'google-vertex/global',
    pricing: { prompt: '0.000003', completion: '0.000015' },
    supported_parameters: ['max_tokens', 'temperature', 'top_p', 'tools', 'tool_choice'],
  },
];

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function fakeFetch(
  handlers: Readonly<{ key?: () => Response | Promise<Response>; zdr?: () => Response | Promise<Response> }>,
): jest.Mock {
  return jest.fn(async (url: string) => {
    if (url.endsWith('/auth/key')) return (handlers.key ?? (() => jsonResponse(200, { data: {} })))();
    if (url.endsWith('/endpoints/zdr')) return (handlers.zdr ?? (() => jsonResponse(200, { data: [] })))();
    throw new Error(`Unexpected URL in test: ${url}`);
  });
}

describe('runOpenRouterPreflight', () => {
  test('refuses outright with no network call when the API key is blank', async () => {
    const fetchImpl = fakeFetch({});
    const result = await runOpenRouterPreflight({ apiKey: '', estimatedPromptTokens: 100, maxOutputTokens: 2048, fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'OPENROUTER_API_KEY_MISSING', compliantEndpoints: [], worstCaseCostUsd: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('refuses when maxOutputTokens is not a positive number', async () => {
    const fetchImpl = fakeFetch({});
    const result = await runOpenRouterPreflight({ apiKey: 'sk-or-test', estimatedPromptTokens: 100, maxOutputTokens: 0, fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('MAX_OUTPUT_TOKENS_INVALID');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('reports the exact HTTP status when the key check fails (e.g. revoked key)', async () => {
    const fetchImpl = fakeFetch({ key: () => jsonResponse(401, { error: 'unauthorized' }) });
    const result = await runOpenRouterPreflight({ apiKey: 'sk-or-test', estimatedPromptTokens: 100, maxOutputTokens: 2048, fetchImpl });
    expect(result).toEqual({ ok: false, reason: 'OPENROUTER_KEY_CHECK_HTTP_401', compliantEndpoints: [], worstCaseCostUsd: null });
  });

  test('reports a network error distinctly from an HTTP error', async () => {
    const fetchImpl = fakeFetch({
      key: () => {
        throw new Error('ECONNRESET');
      },
    });
    const result = await runOpenRouterPreflight({ apiKey: 'sk-or-test', estimatedPromptTokens: 100, maxOutputTokens: 2048, fetchImpl });
    expect(result.reason).toBe('OPENROUTER_KEY_CHECK_NETWORK_ERROR');
  });

  test('refuses when no ZDR row exists at all for the pilot model', async () => {
    const fetchImpl = fakeFetch({ zdr: () => jsonResponse(200, { data: [{ model_id: 'some/other-model', provider_name: 'X', tag: 't', pricing: { prompt: '0.000001', completion: '0.000002' }, supported_parameters: ['response_format'] }] }) });
    const result = await runOpenRouterPreflight({ apiKey: 'sk-or-test', estimatedPromptTokens: 100, maxOutputTokens: 2048, fetchImpl });
    expect(result).toEqual({
      ok: false,
      reason: 'NO_ZDR_ENDPOINT_SUPPORTS_STRUCTURED_OUTPUT_FOR_THIS_MODEL',
      compliantEndpoints: [],
      worstCaseCostUsd: null,
    });
  });

  test('refuses when the only ZDR rows for this model do not support response_format (e.g. Google-only)', async () => {
    const fetchImpl = fakeFetch({
      zdr: () => jsonResponse(200, { data: REAL_ZDR_ROWS_FOR_SONNET_45.filter((r) => r.provider_name === 'Google') }),
    });
    const result = await runOpenRouterPreflight({ apiKey: 'sk-or-test', estimatedPromptTokens: 100, maxOutputTokens: 2048, fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('NO_ZDR_ENDPOINT_SUPPORTS_STRUCTURED_OUTPUT_FOR_THIS_MODEL');
  });

  test('against the real captured ZDR fixture: finds exactly the 2 Bedrock endpoints, excludes both Google ones', async () => {
    const fetchImpl = fakeFetch({ zdr: () => jsonResponse(200, { data: REAL_ZDR_ROWS_FOR_SONNET_45 }) });
    const result = await runOpenRouterPreflight({ apiKey: 'sk-or-test', estimatedPromptTokens: 5_000, maxOutputTokens: 2_048, fetchImpl });

    expect(result.ok).toBe(true);
    expect(result.compliantEndpoints).toHaveLength(2);
    expect(result.compliantEndpoints.every((e) => e.providerName === 'Amazon Bedrock')).toBe(true);

    // Worst case must be computed from the CHEAPEST compliant endpoint (tag "amazon-bedrock": 3e-6 / 15e-6).
    const expectedCost = 5_000 * 0.000003 + 2_048 * 0.000015;
    expect(result.worstCaseCostUsd).toBeCloseTo(expectedCost, 10);
    expect(result.worstCaseCostUsd).toBeLessThan(0.05); // sanity: comfortably inside every mission budget cap
  });

  test('never mutates the estimate into a silently-truncated prompt budget: rejects a negative estimate', async () => {
    const fetchImpl = fakeFetch({ zdr: () => jsonResponse(200, { data: REAL_ZDR_ROWS_FOR_SONNET_45 }) });
    const result = await runOpenRouterPreflight({ apiKey: 'sk-or-test', estimatedPromptTokens: -1, maxOutputTokens: 2048, fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ESTIMATED_PROMPT_TOKENS_INVALID');
  });
});

describe('buildCompliantProviderPreferences', () => {
  test('pins the request to exactly the selected endpoint, with every mandatory policy flag set', () => {
    const preferences = buildCompliantProviderPreferences({
      providerName: 'Amazon Bedrock',
      tag: 'amazon-bedrock',
      promptUsdPerToken: 0.000003,
      completionUsdPerToken: 0.000015,
    });
    expect(preferences).toEqual({
      zdr: true,
      data_collection: 'deny',
      require_parameters: true,
      allow_fallbacks: false,
      only: ['Amazon Bedrock'],
    });
  });
});
