import { describe, it, expect } from 'vitest';
import { selectModel, getFallbackModel } from './openai';

describe('selectModel', () => {
  it('returns gpt-latest by default in dev', () => {
    const prevNode = process.env.NODE_ENV;
    const prevModel = process.env.OPENAI_MODEL;
    delete process.env.OPENAI_MODEL;
    process.env.NODE_ENV = 'development';
    const model = selectModel();
    expect(model).toBe('gpt-latest');
    process.env.NODE_ENV = prevNode;
    process.env.OPENAI_MODEL = prevModel;
  });

  it('throws in production without OPENAI_MODEL', () => {
    const prevNode = process.env.NODE_ENV;
    const prevModel = process.env.OPENAI_MODEL;
    process.env.NODE_ENV = 'production';
    delete process.env.OPENAI_MODEL;
    expect(() => selectModel()).toThrow();
    process.env.NODE_ENV = prevNode;
    process.env.OPENAI_MODEL = prevModel;
  });
});

describe('getFallbackModel', () => {
  it('returns fallback or null', () => {
    const prev = process.env.OPENAI_FALLBACK_MODEL;
    delete process.env.OPENAI_FALLBACK_MODEL;
    expect(getFallbackModel()).toBeNull();
    process.env.OPENAI_FALLBACK_MODEL = 'gpt-4o-mini';
    expect(getFallbackModel()).toBe('gpt-4o-mini');
    process.env.OPENAI_FALLBACK_MODEL = prev;
  });
});


