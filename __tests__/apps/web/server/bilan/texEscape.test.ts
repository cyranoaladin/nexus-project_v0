import { texEscape } from '@/apps/web/server/bilan/orchestrator';
import { describe, expect, it } from 'vitest';

describe('texEscape', () => {
  it('escapes text but preserves inline math $...$', () => {
    const s = "Prix: 50% pour x$^2$ et y_1";
    const out = texEscape(s);
    expect(out).toContain('50\\%');
    expect(out).toContain('$^2$');
    expect(out).toContain('y\\_1');
  });
  it('preserves \\(...\\) and \\[...\\]', () => {
    const s = "Formules \\(a+b\) et \\[c=d\] fin";
    const out = texEscape(s);
    expect(out).toContain('\\(a+b\\)');
    expect(out).toContain('\\[c=d\\]');
  });
});
