import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('pre-rentree pytest snapshot prerequisite', () => {
  it('regenerates the snapshot before every collection instead of trusting stale output', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'scripts/pre-rentree/tests/conftest.py'),
      'utf8',
    );

    expect(source).toContain('["npm", "run", "pre-rentree:snapshot", "--silent"]');
    expect(source).not.toMatch(/if\s+SNAPSHOT_PATH\.is_file\(\):\s*\n\s*return/);
  });
});
