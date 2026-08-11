/**
 * Regression proof for the 2026-08-11 fix: the pre-commit hook must validate
 * what is staged, not the state of the disk. Before the fix,
 * `check-telegram-secrets.mjs .` walked the whole working tree, so stray
 * build artifacts sitting next to the repo (other git worktrees, a local
 * `.next/` output) could block an unrelated commit — or, symmetrically, a
 * real secret staged for commit could be missed if a scan only sampled a
 * directory the hook happened to be pointed at.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();

function initTempRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'nexus-precommit-hook-'));
  spawnSync('git', ['init', '--initial-branch=main'], { cwd: root });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  mkdirSync(join(root, 'scripts', 'security'), { recursive: true });
  cpSync(join(REPO_ROOT, 'scripts', 'pre-commit-hook.sh'), join(root, 'scripts', 'pre-commit-hook.sh'));
  cpSync(
    join(REPO_ROOT, 'scripts', 'security', 'check-telegram-secrets.mjs'),
    join(root, 'scripts', 'security', 'check-telegram-secrets.mjs'),
  );
  return root;
}

function runHook(root: string) {
  return spawnSync('bash', [join(root, 'scripts', 'pre-commit-hook.sh')], {
    cwd: root,
    encoding: 'utf8',
  });
}

const bundledTelegramCall = [
  'https://api.telegram.org/',
  'bot${process.env.TELEGRAM_BOT_TOKEN}',
  '/sendMessage',
].join('');

describe('pre-commit hook — worktree/build-artifact isolation', () => {
  let root: string;

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('does not block on a flagged pattern sitting in an unrelated worktree checkout', () => {
    root = initTempRepo();

    // Simulate exactly the real incident: another git worktree nested inside
    // this checkout, with its own stale `.next` build output.
    const staleWorktreeBuild = join(root, '.worktrees', 'some-other-branch', '.next', 'server', 'route.js');
    mkdirSync(join(staleWorktreeBuild, '..'), { recursive: true });
    writeFileSync(staleWorktreeBuild, `const url = \`${bundledTelegramCall}\`;\n`);

    // Stage a single, unrelated, clean file.
    writeFileSync(join(root, 'clean.ts'), 'export const value = 1;\n');
    spawnSync('git', ['add', 'clean.ts'], { cwd: root });

    const result = runHook(root);

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain('direct-telegram-bot-api-call');
  });

  it('still blocks when the flagged file is itself staged', () => {
    root = initTempRepo();

    writeFileSync(join(root, 'client.ts'), `const url = \`${bundledTelegramCall}\`;\n`);
    spawnSync('git', ['add', 'client.ts'], { cwd: root });

    const result = runHook(root);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain('direct-telegram-bot-api-call');
  });

  it('runs no scan and exits clean when nothing is staged', () => {
    root = initTempRepo();

    const result = runHook(root);

    expect(result.status).toBe(0);
  });
});
