import { computeAriaMode, validateAriaEnv } from '@/lib/aria/env-validate';

describe('lib/aria/env-validate', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('computeAriaMode defaults to service', () => {
    delete process.env.USE_LLM_SERVICE;
    delete process.env.DIRECT_OPENAI_DEV;
    delete process.env.OPENAI_API_KEY;
    expect(computeAriaMode()).toBe('service');
  });

  test('computeAriaMode service when USE_LLM_SERVICE=1', () => {
    process.env.USE_LLM_SERVICE = '1';
    expect(computeAriaMode()).toBe('service');
  });

  test('computeAriaMode direct when DIRECT_OPENAI_DEV=1 and key present', () => {
    delete process.env.USE_LLM_SERVICE;
    process.env.DIRECT_OPENAI_DEV = '1';
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(computeAriaMode()).toBe('direct');
  });

  test('validateAriaEnv enforces production OPENAI_MODEL', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.OPENAI_MODEL;
    expect(() => validateAriaEnv()).toThrow('OPENAI_MODEL');
    process.env.OPENAI_MODEL = 'gpt-test';
    expect(() => validateAriaEnv()).not.toThrow();
  });

  test('validateAriaEnv enforces OPENAI_API_KEY when DIRECT_OPENAI_DEV=1', () => {
    delete process.env.USE_LLM_SERVICE;
    process.env.DIRECT_OPENAI_DEV = '1';
    delete process.env.OPENAI_API_KEY;
    expect(() => validateAriaEnv()).toThrow('OPENAI_API_KEY');
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(() => validateAriaEnv()).not.toThrow();
  });

  test('validateAriaEnv enforces LLM_SERVICE_URL when USE_LLM_SERVICE=1', () => {
    process.env.USE_LLM_SERVICE = '1';
    delete process.env.LLM_SERVICE_URL;
    expect(() => validateAriaEnv()).toThrow('LLM_SERVICE_URL');
    process.env.LLM_SERVICE_URL = 'http://localhost:8003';
    expect(() => validateAriaEnv()).not.toThrow();
  });
});
