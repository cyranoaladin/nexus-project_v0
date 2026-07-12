import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const auditScript = join(root, 'scripts/pre-rentree/final-public-release-audit.mjs');

describe('Pré-rentrée final public release gates', () => {
  it('scans public source files without leaking internal campaign tokens or copied business facts', () => {
    expect(() => execFileSync(process.execPath, [auditScript, '--source'], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    })).not.toThrow();
  });

  it('provides build artifact and rendered payload scan modes', () => {
    const source = readFileSync(auditScript, 'utf8');

    expect(source).toContain('--artifacts');
    expect(source).toContain('--rendered');
    expect(source).toContain('.next/static');
    expect(source).toContain('.next/server');
  });
});
