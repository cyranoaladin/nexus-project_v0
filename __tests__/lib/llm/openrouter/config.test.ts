import {
  parseOpenRouterConfig,
  type OpenRouterEnvironment,
} from '@/lib/llm/openrouter/config';
import {
  OpenRouterError,
  type OpenRouterErrorCode,
} from '@/lib/llm/openrouter/errors';

const requiredEnvironment = (
  overrides: OpenRouterEnvironment = {},
): OpenRouterEnvironment => ({
  NODE_ENV: 'test',
  BILAN_REPORT_GENERATION_MODE: 'OPENROUTER_REQUIRED',
  OPENROUTER_API_KEY: 'synthetic-test-key',
  OPENROUTER_BASE_URL: 'http://127.0.0.1:43123/api/v1',
  BILAN_OPENROUTER_PRIMARY_MODEL: 'anthropic/claude-sonnet-5',
  BILAN_OPENROUTER_FALLBACK_MODELS: '["openai/gpt-5.6-terra"]',
  BILAN_OPENROUTER_MODEL_POLICY_VERSION: 'bilan-model-policy-v1.1',
  BILAN_OPENROUTER_TIMEOUT_MS: '90000',
  BILAN_OPENROUTER_MAX_ATTEMPTS: '3',
  BILAN_OPENROUTER_MAX_OUTPUT_TOKENS: '2048',
  BILAN_OPENROUTER_MAX_COST_USD_PER_REPORT: '0.50',
  BILAN_OPENROUTER_DAILY_BUDGET_USD: '25',
  ...overrides,
});

describe('OpenRouter configuration', () => {
  it('is disabled by default and does not require a key', () => {
    expect(parseOpenRouterConfig({ NODE_ENV: 'test' })).toMatchObject({
      mode: 'DISABLED',
      apiKey: null,
      primaryModel: 'anthropic/claude-sonnet-5',
      fallbackModels: ['openai/gpt-5.6-terra'],
    });
  });

  it('parses the complete required configuration without exposing the key', () => {
    const config = parseOpenRouterConfig(requiredEnvironment());

    expect(config.mode).toBe('OPENROUTER_REQUIRED');
    expect(config.apiKey).toBe('synthetic-test-key');
    expect(config.baseUrl).toBe('http://127.0.0.1:43123/api/v1/');
    expect(JSON.stringify(config.redacted)).not.toContain('synthetic-test-key');
  });

  it.each([
    [{ OPENROUTER_API_KEY: '' }, 'OPENROUTER_NOT_CONFIGURED'],
    [{ BILAN_LLM_ENRICHMENT_ENABLED: 'false' }, 'OPENROUTER_POLICY_REJECTED'],
    [{ BILAN_OPENROUTER_PRIMARY_MODEL: 'openrouter/auto' }, 'OPENROUTER_POLICY_REJECTED'],
    [{ BILAN_OPENROUTER_PRIMARY_MODEL: 'anthropic/claude-sonnet-latest' }, 'OPENROUTER_POLICY_REJECTED'],
    [{ BILAN_OPENROUTER_TEMPERATURE: '0' }, 'OPENROUTER_POLICY_REJECTED'],
    [{ BILAN_OPENROUTER_TOP_P: '1' }, 'OPENROUTER_POLICY_REJECTED'],
    [{ BILAN_OPENROUTER_SEED: '42' }, 'OPENROUTER_POLICY_REJECTED'],
    [{ BILAN_REPORT_GENERATION_PROVIDER: 'OPENROUTER' }, 'OPENROUTER_POLICY_REJECTED'],
    [{ BILAN_REPORT_MISTRAL_ENABLED: 'false' }, 'OPENROUTER_POLICY_REJECTED'],
    [{ OPENROUTER_BASE_URL: 'https://user:password@openrouter.ai/api/v1' }, 'OPENROUTER_POLICY_REJECTED'],
    [{ BILAN_OPENROUTER_MAX_ATTEMPTS: '0' }, 'OPENROUTER_POLICY_REJECTED'],
    [{ BILAN_OPENROUTER_MAX_COST_USD_PER_REPORT: '-1' }, 'OPENROUTER_POLICY_REJECTED'],
    [{
      BILAN_OPENROUTER_MAX_COST_USD_PER_REPORT: '26',
      BILAN_OPENROUTER_DAILY_BUDGET_USD: '25',
    }, 'OPENROUTER_BUDGET_EXCEEDED'],
  ] as const)('rejects unsafe environment %o', (overrides, code: OpenRouterErrorCode) => {
    expect(() => parseOpenRouterConfig(requiredEnvironment(overrides))).toThrow(
      expect.objectContaining<Partial<OpenRouterError>>({ code }),
    );
  });

  it('requires HTTPS outside tests', () => {
    expect(() =>
      parseOpenRouterConfig(
        requiredEnvironment({
          NODE_ENV: 'production',
          OPENROUTER_BASE_URL: 'http://127.0.0.1:43123/api/v1',
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'OPENROUTER_POLICY_REJECTED' }));
  });

  it('pins the non-test endpoint to the canonical OpenRouter API', () => {
    expect(() =>
      parseOpenRouterConfig(
        requiredEnvironment({
          NODE_ENV: 'development',
          OPENROUTER_BASE_URL: 'https://provider-proxy.example/api/v1',
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'OPENROUTER_POLICY_REJECTED' }));
  });

  it('requires bounded production budgets', () => {
    const environment = requiredEnvironment({
      NODE_ENV: 'production',
      OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    });
    delete environment.BILAN_OPENROUTER_DAILY_BUDGET_USD;

    expect(() => parseOpenRouterConfig(environment)).toThrow(
      expect.objectContaining({ code: 'OPENROUTER_BUDGET_EXCEEDED' }),
    );
  });
});
