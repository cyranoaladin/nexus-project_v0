import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  BILAN_MODEL_POLICY,
  BILAN_MODEL_POLICY_CHECKSUM,
  BILAN_MODEL_POLICY_CONFIG_VERSION,
} from '@/lib/llm/openrouter/policy';

describe('bilan OpenRouter model policy v1.1', () => {
  it('pins the owner-approved models and omits sampling parameters', () => {
    expect(BILAN_MODEL_POLICY_CONFIG_VERSION).toBe('bilan-model-policy-v1.1');
    expect(BILAN_MODEL_POLICY).toEqual({
      id: 'bilan-model-policy',
      version: '1.1',
      primaryModel: 'anthropic/claude-sonnet-5',
      fallbackModels: ['openai/gpt-5.6-terra'],
      temperature: { mode: 'OMIT' },
      topP: { mode: 'OMIT' },
      seed: { mode: 'OMIT' },
      reasoning: {
        mode: 'PREFLIGHT_REQUIRED',
        effort: 'low',
        excludeFromResponse: true,
      },
      requiredCapabilities: [
        'response_format',
        'structured_outputs',
        'max_tokens',
      ],
      providerPolicy: {
        requireParameters: true,
        dataCollection: 'deny',
        zdr: true,
      },
      retryPolicy: {
        id: 'bilan-retry-policy',
        version: '1',
        attemptPlan: [
          'anthropic/claude-sonnet-5',
          'openai/gpt-5.6-terra',
          'openai/gpt-5.6-terra',
        ],
        maxAttempts: 3,
      },
      automaticCapabilityEnablement: false,
    });
    expect(BILAN_MODEL_POLICY_CHECKSUM).toBe(
      '4f8633be4e26949ebdec408f3ce1fe9ef0f4ee094d2e63fb6145caa488c3c1a7',
    );
  });

  it('deep-freezes every payload-affecting policy value', () => {
    expect(Object.isFrozen(BILAN_MODEL_POLICY)).toBe(true);
    expect(Object.isFrozen(BILAN_MODEL_POLICY.fallbackModels)).toBe(true);
    expect(Object.isFrozen(BILAN_MODEL_POLICY.requiredCapabilities)).toBe(true);
    expect(Object.isFrozen(BILAN_MODEL_POLICY.temperature)).toBe(true);
    expect(Object.isFrozen(BILAN_MODEL_POLICY.topP)).toBe(true);
    expect(Object.isFrozen(BILAN_MODEL_POLICY.seed)).toBe(true);
    expect(Object.isFrozen(BILAN_MODEL_POLICY.reasoning)).toBe(true);
    expect(Object.isFrozen(BILAN_MODEL_POLICY.providerPolicy)).toBe(true);
    expect(Object.isFrozen(BILAN_MODEL_POLICY.retryPolicy)).toBe(true);
    expect(Object.isFrozen(BILAN_MODEL_POLICY.retryPolicy.attemptPlan)).toBe(
      true,
    );

    expect(Reflect.set(
      BILAN_MODEL_POLICY.providerPolicy,
      'zdr',
      false,
    )).toBe(false);
    expect(BILAN_MODEL_POLICY.providerPolicy.zdr).toBe(true);
  });

  it('keeps the checked-in policy free of auto/latest model aliases', () => {
    const policy = readFileSync(
      resolve(
        process.cwd(),
        'content/bilans/model-policies/bilan-model-policy-v1.1.json',
      ),
      'utf8',
    );

    expect(policy).not.toContain('openrouter/auto');
    expect(policy).not.toMatch(/-latest\b/);
  });
});
