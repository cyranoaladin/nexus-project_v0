import policy from '@/data/bilans/model-policy.json';
import { requireAllowedBilanModel } from '@/lib/bilans/llm/model-policy';

describe('versioned bilan model policy', () => {
  it('keeps providers disabled until a model is explicitly allowlisted', () => {
    expect(policy.allowedModels).toEqual([]);
    expect(() => requireAllowedBilanModel(policy, process.env.BILAN_LLM_MODEL)).toThrow(/allowlist/i);
  });
});
