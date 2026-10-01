import {
  assertNotExcludedEndpoint,
  ExcludedProviderError,
  withExcludedProviders,
} from '@/lib/llm/provider-exclusion';

describe('OpenRouter provider exclusion', () => {
  it('always ignores chutes and keeps every other routing constraint', () => {
    const provider = withExcludedProviders({
      zdr: true,
      data_collection: 'deny',
      require_parameters: true,
      allow_fallbacks: false,
      only: ['Azure'],
    });
    expect(provider).toEqual({
      zdr: true,
      data_collection: 'deny',
      require_parameters: true,
      allow_fallbacks: false,
      only: ['Azure'],
      ignore: ['chutes'],
    });
  });

  it('merges with an existing ignore list without duplicating or dropping entries', () => {
    expect(withExcludedProviders({ ignore: ['Foo', 'CHUTES'] }).ignore).toEqual(['Foo', 'CHUTES']);
    expect(withExcludedProviders({ ignore: ['Foo'] }).ignore).toEqual(['Foo', 'chutes']);
    expect(withExcludedProviders().ignore).toEqual(['chutes']);
  });

  it('fails explicitly when a constraint asks for the excluded provider', () => {
    expect(() => withExcludedProviders({ only: ['Chutes'] })).toThrow(ExcludedProviderError);
    expect(() => withExcludedProviders({ order: ['azure', 'chutes'] })).toThrow(ExcludedProviderError);
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(withExcludedProviders())).toBe(true);
  });

  it('refuses a direct endpoint on the excluded provider domains', () => {
    expect(() => assertNotExcludedEndpoint('https://llm.chutes.ai/v1')).toThrow(ExcludedProviderError);
    expect(() => assertNotExcludedEndpoint('https://api.chutes.ai')).toThrow(ExcludedProviderError);
    expect(() => assertNotExcludedEndpoint('not a url')).toThrow(ExcludedProviderError);
    expect(() => assertNotExcludedEndpoint('https://openrouter.ai/api/v1')).not.toThrow();
  });
});
