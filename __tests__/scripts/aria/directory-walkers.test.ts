import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sourceFiles } from '@/scripts/aria/check-security';
import { filesUnder } from '@/scripts/aria/check-integrity';

function fixtureRoot(): string {
  return mkdtempSync(join(tmpdir(), 'aria-walker-'));
}

function write(root: string, path: string, value: string): void {
  const absolute = join(root, path);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, value);
}

describe('ARIA governance script directory walkers share the same security contract', () => {
  it('SECURITY_WALKER_REJECTS_SYMLINKED_SOURCE_ENTRY', () => {
    const root = fixtureRoot();
    const outside = fixtureRoot();
    write(outside, 'escape.ts', 'export const escaped = true;');
    mkdirSync(join(root, 'lib/aria'), { recursive: true });
    symlinkSync(join(outside, 'escape.ts'), join(root, 'lib/aria/escape.ts'));

    expect(() => sourceFiles(root)).toThrow('ARIA_SECURITY_SOURCE_ENTRY_INVALID:');
  });

  it('SECURITY_WALKER_EXCLUDES_TOOLING_TREES', () => {
    const root = fixtureRoot();
    write(root, 'lib/aria/core.ts', 'export const core = true;');
    write(root, 'node_modules/some-dep/index.ts', 'export const dep = true;');
    write(root, '.next/generated.ts', 'export const generated = true;');
    write(root, '.git/hooks/pre-commit.ts', 'export const hook = true;');

    const files = sourceFiles(root).map((path) => path.split('/').pop());
    expect(files).toContain('core.ts');
    expect(files).not.toContain('index.ts');
    expect(files).not.toContain('generated.ts');
    expect(files).not.toContain('pre-commit.ts');
  });

  it('INTEGRITY_WALKER_REJECTS_SYMLINKED_SOURCE_ENTRY', () => {
    const root = fixtureRoot();
    const outside = fixtureRoot();
    write(outside, 'escape.ts', 'export const escaped = true;');
    mkdirSync(join(root, 'lib/aria'), { recursive: true });
    symlinkSync(join(outside, 'escape.ts'), join(root, 'lib/aria/escape.ts'));

    expect(() => filesUnder(root, 'lib')).toThrow(
      'ARIA_INTEGRITY_SOURCE_ENTRY_INVALID:lib/aria/escape.ts',
    );
  });
});
