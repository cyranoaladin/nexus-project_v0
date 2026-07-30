/** @jest-environment node */

import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readCleanGitSoftwareSha } from '@/lib/llm/openrouter/preflight-software';

describe('OpenRouter preflight software provenance', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  function repository() {
    const root = mkdtempSync(join(tmpdir(), 'nexus-openrouter-git-'));
    roots.push(root);
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    writeFileSync(join(root, 'tracked.txt'), 'clean\n');
    execFileSync('git', ['add', 'tracked.txt'], { cwd: root });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Nexus Test',
        '-c',
        'user.email=test@nexus.invalid',
        'commit',
        '--quiet',
        '-m',
        'test',
      ],
      { cwd: root },
    );
    return root;
  }

  it('returns the exact SHA only for a clean repository', () => {
    const root = repository();
    const expected = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();

    expect(readCleanGitSoftwareSha(root)).toBe(expected);
  });

  it.each([
    ['tracked modification', (root: string) =>
      writeFileSync(join(root, 'tracked.txt'), 'dirty\n')],
    ['untracked file', (root: string) =>
      writeFileSync(join(root, 'untracked.txt'), 'dirty\n')],
  ])('refuses a repository with a %s', (_label, mutate) => {
    const root = repository();
    mutate(root);

    expect(() => readCleanGitSoftwareSha(root)).toThrow(
      expect.objectContaining({ code: 'OPENROUTER_POLICY_REJECTED' }),
    );
  });
});
