import { getGenerationParams, getSystemPrefix } from '@/lib/aria/policy';

describe('lib/aria/policy', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('getGenerationParams returns correct presets for intents with env default', () => {
    process.env.OPENAI_MAX_TOKENS = '1200';

    const tutor = getGenerationParams('tutor');
    expect(tutor).toEqual({ temperature: 0.2, top_p: 1, presence_penalty: 0, max_tokens: 1200 });

    const summary = getGenerationParams('summary');
    expect(summary).toEqual({ temperature: 0.1, top_p: 1, presence_penalty: 0, max_tokens: 600 });

    const pdf = getGenerationParams('pdf');
    expect(pdf).toEqual({ temperature: 0.0, top_p: 1, presence_penalty: 0, max_tokens: 800 });

    const fallback = getGenerationParams('tutor' as any, 900);
    expect(fallback.max_tokens).toBe(900);
  });

  test('getSystemPrefix contains core safety guidance', () => {
    const prefix = getSystemPrefix();
    expect(prefix).toContain('ARIA');
    expect(prefix).toContain('français');
    expect(prefix).toContain('Ne divulgue jamais');
    expect(prefix).toContain('N\'effectue aucune action réseau');
  });
});
