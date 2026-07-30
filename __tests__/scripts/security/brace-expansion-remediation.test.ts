import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const repositoryRoot = path.resolve(__dirname, '../../..');
const requireFromRepository = createRequire(
  path.join(repositoryRoot, 'package.json'),
);

describe('brace-expansion dependency remediation', () => {
  it('rejects every installed brace-expansion version below 5.0.8', () => {
    expect(() => execFileSync(
      process.execPath,
      ['scripts/security/verify-brace-expansion-remediation.mjs'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      },
    )).not.toThrow();
  });

  it('keeps the CommonJS minimatch brace API operational', () => {
    const minimatch = requireFromRepository('minimatch') as {
      braceExpand(pattern: string): string[];
    };

    expect(minimatch.braceExpand('module-{parent,student}.json')).toEqual([
      'module-parent.json',
      'module-student.json',
    ]);
  });

  it('loads the upstream 5.0.8 memory bound and truncates hostile input', () => {
    const braceExpansion = requireFromRepository('brace-expansion') as {
      EXPANSION_MAX_LENGTH?: number;
      expand?: (
        pattern: string,
        options?: { max?: number; maxLength?: number },
      ) => string[];
    };

    expect(braceExpansion.EXPANSION_MAX_LENGTH).toBe(4_000_000);
    expect(braceExpansion.expand).toBeInstanceOf(Function);

    const expanded = braceExpansion.expand?.(
      '{a,b}'.repeat(120),
      { max: 2_000, maxLength: 12_000 },
    );

    expect(expanded).toBeDefined();
    expect(
      expanded?.reduce((length, item) => length + item.length, 0),
    ).toBeLessThanOrEqual(12_000);
  });
});
