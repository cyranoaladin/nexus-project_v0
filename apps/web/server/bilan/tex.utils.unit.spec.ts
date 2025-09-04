import { describe, it, expect } from 'vitest';
import { texEscape } from './orchestrator';

function occurs(hay: string, needle: string) {
  return (hay.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
}

describe('texEscape truth table', () => {
  it('escapes all special chars', () => {
    const s = String.raw`# $ % _ { } ^ ~ \ &`;
    const out = texEscape(s);
    expect(out).toContain('\\#');
    expect(out).toContain('\\$');
    expect(out).toContain('\\%');
    expect(out).toContain('\\_');
    expect(out).toContain('\\{');
    expect(out).toContain('\\}');
    expect(out).toContain('\\textasciicircum ');
    expect(out).toContain('\\textasciitilde ');
    expect(out).toContain('\\textbackslash ');
    expect(out).toContain('\\&');
  });

  it('multiple occurrences are all escaped (no partials)', () => {
    const out = texEscape('___$$$%%%');
    expect(occurs(out, '\\_')).toBe(3);
    expect(occurs(out, '\\$')).toBe(3);
    expect(occurs(out, '\\%')).toBe(3);
  });

  it('truncates to 8000 chars and appends ellipsis', () => {
    const long = 'A'.repeat(8100);
    const out = texEscape(long);
    expect(out.length).toBe(8001); // 8000 + …
    expect(out.endsWith('…')).toBe(true);
  });
});

