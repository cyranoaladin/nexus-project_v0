import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const hook = resolve(process.cwd(), 'scripts/pre-commit-hook.sh');
const scanner = resolve(process.cwd(), 'scripts/security/check-versioned-credentials.mjs');

function withRepository(run: (repository: string) => void): void {
  const repository = mkdtempSync(join(tmpdir(), 'nexus-pre-commit-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: repository });
    mkdirSync(join(repository, 'scripts/security'), { recursive: true });
    copyFileSync(hook, join(repository, 'scripts/pre-commit-hook.sh'));
    copyFileSync(scanner, join(repository, 'scripts/security/check-versioned-credentials.mjs'));
    run(repository);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
}

describe('pre-commit credential gate', () => {
  it('blocks a staged credential without echoing its value', () => {
    withRepository((repository) => {
      const credential = ['Staged', 'Credential', 'Must', 'Stay', 'Hidden', '42!'].join('');
      writeFileSync(join(repository, 'rogue.ts'), `const apiKey = '${credential}';\n`);
      execFileSync('git', ['add', '.'], { cwd: repository });

      const result = spawnSync('bash', ['scripts/pre-commit-hook.sh'], {
        cwd: repository,
        encoding: 'utf8',
      });
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain('SERVICE_SECRET_LITERAL rogue.ts:1');
      expect(output).not.toContain(credential);
    });
  });

  it('scans the index rather than a safer unstaged worktree copy', () => {
    withRepository((repository) => {
      const credential = ['Indexed', 'Credential', 'Must', 'Stay', 'Hidden', '42!'].join('');
      const path = join(repository, 'rogue.ts');
      writeFileSync(path, `const token = '${credential}';\n`);
      execFileSync('git', ['add', '.'], { cwd: repository });
      writeFileSync(path, 'const token = process.env.RUNTIME_TOKEN;\n');

      const result = spawnSync('bash', ['scripts/pre-commit-hook.sh'], {
        cwd: repository,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).not.toContain(credential);
    });
  });

  it('accepts a staged runtime-generated credential', () => {
    withRepository((repository) => {
      writeFileSync(
        join(repository, 'safe.ts'),
        "const password = generateRuntimePassword();\n",
      );
      execFileSync('git', ['add', '.'], { cwd: repository });

      expect(spawnSync('bash', ['scripts/pre-commit-hook.sh'], {
        cwd: repository,
        encoding: 'utf8',
      }).status).toBe(0);
    });
  });

  it('blocks sensitive filenames while accepting explicit env examples', () => {
    withRepository((repository) => {
      writeFileSync(join(repository, '.env.example'), 'RUNTIME_ONLY=example\n');
      writeFileSync(join(repository, 'private.key'), 'not-a-real-key\n');
      execFileSync('git', ['add', '-f', '.env.example', 'private.key'], { cwd: repository });

      expect(spawnSync('bash', ['scripts/pre-commit-hook.sh'], {
        cwd: repository,
        encoding: 'utf8',
      }).status).toBe(1);
    });
  });
});
