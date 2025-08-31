import { describe, expect, it, vi } from 'vitest';
import { computeAriaMode, validateAriaEnv } from './env-validate';

describe('env-validate', () => {
  it('computes direct when DIRECT_OPENAI_DEV=1 and key present', () => {
    const prev = { DOD: process.env.DIRECT_OPENAI_DEV, KEY: process.env.OPENAI_API_KEY, ULS: process.env.USE_LLM_SERVICE };
    process.env.DIRECT_OPENAI_DEV = '1';
    process.env.OPENAI_API_KEY = 'sk-test';
    delete process.env.USE_LLM_SERVICE;
    expect(computeAriaMode()).toBe('direct');
    process.env.DIRECT_OPENAI_DEV = prev.DOD;
    process.env.OPENAI_API_KEY = prev.KEY;
    process.env.USE_LLM_SERVICE = prev.ULS;
  });

  it('forces service when USE_LLM_SERVICE=1', () => {
    const prev = process.env.USE_LLM_SERVICE;
    process.env.USE_LLM_SERVICE = '1';
    expect(computeAriaMode()).toBe('service');
    process.env.USE_LLM_SERVICE = prev;
  });

  it('throws when production without OPENAI_MODEL', () => {
    const prevNode = process.env.NODE_ENV;
    const prevModel = process.env.OPENAI_MODEL;
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.OPENAI_MODEL;
    expect(() => validateAriaEnv()).toThrow();
    if (prevNode != null) vi.stubEnv('NODE_ENV', prevNode);
    process.env.OPENAI_MODEL = prevModel;
  });

  it('requires OPENAI_API_KEY in direct mode', () => {
    const prev = { DOD: process.env.DIRECT_OPENAI_DEV, KEY: process.env.OPENAI_API_KEY };
    process.env.DIRECT_OPENAI_DEV = '1';
    delete process.env.OPENAI_API_KEY;
    expect(() => validateAriaEnv()).toThrow();
    process.env.DIRECT_OPENAI_DEV = prev.DOD;
    process.env.OPENAI_API_KEY = prev.KEY;
  });
});
