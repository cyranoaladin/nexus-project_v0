describe('lib/aria/openai selectModel + getFallbackModel', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD }; });
  afterEach(() => { process.env = OLD; });

  it('selectModel: returns default dev model when not set and not prod', () => {
    delete process.env.OPENAI_MODEL;
    delete process.env.NODE_ENV;
    const { selectModel } = require('@/lib/aria/openai');
    const m = selectModel();
    expect(m).toBe('gpt-latest');
  });

  it('selectModel: throws in production when OPENAI_MODEL missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.OPENAI_MODEL;
    const { selectModel } = require('@/lib/aria/openai');
    expect(() => selectModel()).toThrow('OPENAI_MODEL required in production');
  });

  it('getFallbackModel: returns null by default or provided value', () => {
    const { getFallbackModel } = require('@/lib/aria/openai');
    delete process.env.OPENAI_FALLBACK_MODEL;
    expect(getFallbackModel()).toBeNull();
    process.env.OPENAI_FALLBACK_MODEL = 'gpt-4o-mini';
    expect(getFallbackModel()).toBe('gpt-4o-mini');
  });
});

