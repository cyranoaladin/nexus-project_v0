/**
 * Guardrail: no wa.me/ literal should appear outside lib/whatsapp.ts.
 *
 * This prevents drift back to hardcoded WhatsApp numbers scattered
 * across components and pages.
 *
 * The sweep enumerates GIT-TRACKED files only (`git ls-files`), never the
 * working directory: local worktrees, build artifacts or editor debris must
 * not make a repository-wide invariant fail on one machine and pass on
 * another. What is not committed cannot ship, so it is not this guard's
 * business.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

function trackedSourceFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '--cached', '-z', '--', '*.ts', '*.tsx'], {
    cwd: ROOT,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return output
    .split('\0')
    .filter((entry) => entry.length > 0)
    .filter((entry) => !entry.startsWith('__tests__/') && !entry.startsWith('e2e/') && !entry.startsWith('src/static-pages/'));
}

describe('WhatsApp centralisation guardrail', () => {
  const ALLOWED_FILE = 'lib/whatsapp.ts';
  const WA_ME_PATTERN = /wa\.me\//;

  it('no wa.me/ literal outside lib/whatsapp.ts', () => {
    const files = trackedSourceFiles();
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain(ALLOWED_FILE);
    const violations: string[] = [];
    for (const file of files) {
      if (file === ALLOWED_FILE) continue;
      const absolute = path.join(ROOT, file);
      if (!fs.existsSync(absolute)) continue;
      const content = fs.readFileSync(absolute, 'utf-8');
      if (WA_ME_PATTERN.test(content)) violations.push(file);
    }
    expect(violations).toEqual([]);
  });
});
