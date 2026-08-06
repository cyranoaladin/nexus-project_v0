import fs from 'node:fs';
import path from 'node:path';

describe('A94 Bilan runtime real-DB CI boundary', () => {
  it('runs the renamed real-DB suite in a dedicated PostgreSQL job', () => {
    const root = process.cwd();
    const current = path.join(root, '__tests__', 'lib', 'bilan-runtime', 'bilan-schema.real.test.ts');
    const legacy = path.join(root, '__tests__', 'lib', 'bilan', 'bilan-schema.real.test.ts');
    const ci = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');

    expect(fs.existsSync(current)).toBe(true);
    expect(fs.existsSync(legacy)).toBe(false);
    expect(ci).toContain('bilan-runtime-real-db:');
    expect(ci).toContain("--testPathIgnorePatterns='/__tests__/lib/bilan-runtime/'");
    expect(ci).toContain('__tests__/lib/bilan-runtime/bilan-schema.real.test.ts');
  });
});
