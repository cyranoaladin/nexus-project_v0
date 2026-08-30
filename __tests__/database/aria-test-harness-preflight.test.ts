/** @jest-environment node */

import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('ARIA disposable database harness preflight', () => {
  const repositoryRoot = process.cwd();
  const harnessPath = join(repositoryRoot, 'scripts/aria/run-disposable-db-suite.sh');
  let temporaryDirectory: string;
  let fakeBin: string;
  let commandLog: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'aria-db-harness-'));
    fakeBin = join(temporaryDirectory, 'bin');
    commandLog = join(temporaryDirectory, 'commands.log');
    mkdirSync(fakeBin);

    writeFileSync(join(fakeBin, 'docker'), `#!/usr/bin/env bash
set -eu
printf 'docker %s\\n' "$*" >> "$ARIA_HARNESS_COMMAND_LOG"
case "$1" in
  run) printf 'fake-container-id\\n' ;;
  port) printf '127.0.0.1:49123\\n' ;;
  inspect) printf 'healthy\\n' ;;
  logs) printf 'fake postgres log\\n' ;;
  rm) exit 0 ;;
  *) exit 0 ;;
esac
`, { mode: 0o755 });
    writeFileSync(join(fakeBin, 'npx'), `#!/usr/bin/env bash
set -eu
printf 'npx %s\\n' "$*" >> "$ARIA_HARNESS_COMMAND_LOG"
if [[ "$*" == *"jest"* ]]; then exit 23; fi
exit 0
`, { mode: 0o755 });
  });

  afterEach(() => {
    chmodSync(temporaryDirectory, 0o755);
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('rejects absent and non-allowlisted database URLs before any mutation', () => {
    const syntheticAuthority = `${['aria', 'test'].join(':')}@`;
    for (const databaseUrl of [
      undefined,
      `postgresql://${syntheticAuthority}db.internal:5432/nexus_disposable_aria_deadbeef_test`,
      `postgresql://${syntheticAuthority}127.0.0.1:49123/nexus_production`,
      `postgresql://${syntheticAuthority}127.0.0.1:49123/nexus_staging`,
      `postgresql://${syntheticAuthority}127.0.0.1:5432/nexus_disposable_aria_deadbeef_test`,
    ]) {
      const result = spawnSync('bash', [harnessPath, '--validate-url-only'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          ARIA_DISPOSABLE_DATABASE_URL: databaseUrl,
        },
      });

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).not.toContain(databaseUrl ?? 'undefined');
    }
  });

  it('migrates a generated disposable database and removes its exact container after Jest fails', () => {
    const source = readFileSync(harnessPath, 'utf8');
    expect(source.indexOf('trap cleanup')).toBeGreaterThanOrEqual(0);
    expect(source.indexOf('trap cleanup')).toBeLessThan(source.indexOf('mktemp'));
    expect(source.indexOf('trap cleanup')).toBeLessThan(source.indexOf('docker run'));
    expect(source).not.toContain('passWithNoTests');
    expect(source).not.toContain('|| true');

    const requestedTest = '__tests__/database/aria-test-harness-preflight.test.ts';
    const result = spawnSync(
      'bash',
      [harnessPath, 'db', '--runTestsByPath', requestedTest],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${fakeBin}:${process.env.PATH}`,
          ARIA_HARNESS_COMMAND_LOG: commandLog,
          ARIA_REAL_DB_HEALTH_ATTEMPTS: '2',
        },
      },
    );

    expect(result.status).toBe(23);
    const commands = readFileSync(commandLog, 'utf8');
    const run = commands.match(/docker run .*--name ([^ ]+)/);
    expect(run).not.toBeNull();
    const containerName = run![1];
    expect(containerName).toMatch(/^nexus-aria-real-[a-f0-9]+$/);
    expect(commands).toContain(`docker rm -f -v ${containerName}`);
    expect(commands).toContain('npx prisma migrate deploy');
    expect(commands).toContain(
      `npx jest --config jest.aria.db.config.js --runInBand --runTestsByPath ${requestedTest}`,
    );
    expect(`${result.stdout}${result.stderr}`).not.toMatch(/postgresql:\/\/|nexus_aria_test/);
  });
});
