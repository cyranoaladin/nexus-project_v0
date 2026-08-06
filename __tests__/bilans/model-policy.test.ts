import policy from '@/data/bilans/model-policy.json';
import { requireAllowedBilanModel } from '@/lib/bilans/llm/model-policy';

describe('versioned bilan model policy', () => {
  it('explicitly allowlists the OpenRouter models wired for bilan generation', () => {
    expect(policy.allowedModels).toEqual(['mistralai/mistral-large-2512', 'openai/gpt-4o-mini']);
  });

  it('accepts an allowlisted model', () => {
    expect(requireAllowedBilanModel(policy, 'mistralai/mistral-large-2512')).toBe('mistralai/mistral-large-2512');
  });

  it('refuses a model that is not on the allowlist', () => {
    expect(() => requireAllowedBilanModel(policy, 'some/unvetted-model')).toThrow(/allowlist/i);
  });

  it('refuses an undefined model', () => {
    expect(() => requireAllowedBilanModel(policy, undefined)).toThrow(/allowlist/i);
  });
});
