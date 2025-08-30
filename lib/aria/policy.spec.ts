import { describe, it, expect } from 'vitest';
import { getGenerationParams } from './policy';

describe('getGenerationParams', () => {
  it('returns tutor defaults with temperature 0.2', () => {
    const p = getGenerationParams('tutor');
    expect(p.temperature).toBe(0.2);
    expect(p.top_p).toBe(1);
    expect(p.presence_penalty).toBe(0);
    expect(p.max_tokens).toBeGreaterThan(0);
  });

  it('caps max_tokens via OPENAI_MAX_TOKENS for summary', () => {
    const prev = process.env.OPENAI_MAX_TOKENS;
    process.env.OPENAI_MAX_TOKENS = '500';
    const p = getGenerationParams('summary');
    expect(p.max_tokens).toBeLessThanOrEqual(600);
    expect(p.max_tokens).toBe(500);
    process.env.OPENAI_MAX_TOKENS = prev;
  });

  it('caps pdf max_tokens to <= 800', () => {
    const prev = process.env.OPENAI_MAX_TOKENS;
    process.env.OPENAI_MAX_TOKENS = '5000';
    const p = getGenerationParams('pdf');
    expect(p.max_tokens).toBe(800);
    process.env.OPENAI_MAX_TOKENS = prev;
  });
});


