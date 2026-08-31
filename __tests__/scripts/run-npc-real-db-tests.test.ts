/** @jest-environment node */

import { chmodSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('run-npc-real-db-tests harness contract', () => {
  const repositoryRoot = process.cwd();
  const harnessPath = join(repositoryRoot, 'scripts/testing/run-npc-real-db-tests.sh');
  let temporaryDirectory: string;
  let fakeBin: string;
  let commandLog: string;

  function findNpcRealSuites(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) return findNpcRealSuites(absolutePath);
      return /^npc-.*\.real\.test\.ts$/.test(entry.name)
        ? [absolutePath.slice(repositoryRoot.length + 1)]
        : [];
    }).sort();
  }

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'npc-real-harness-'));
    fakeBin = join(temporaryDirectory, 'bin');
    commandLog = join(temporaryDirectory, 'commands.log');
    mkdirSync(fakeBin);

    const fakeDocker = `#!/usr/bin/env bash
set -eu
printf 'docker %s\\n' "$*" >> "$NPC_HARNESS_COMMAND_LOG"
case "$1" in
  run)
    if [[ "\${NPC_FAKE_DOCKER_RUN_EXIT:-}" != "" ]]; then
      exit "$NPC_FAKE_DOCKER_RUN_EXIT"
    fi
    if [[ "$*" == *"npx jest"* ]]; then exit "\${NPC_FAKE_JEST_EXIT:-23}"; fi
    printf 'fake-container-id\\n'
    ;;
  port) printf '127.0.0.1:49123\\n' ;;
  inspect) printf 'healthy\\n' ;;
  exec) printf '150013\\n' ;;
  logs) printf 'fake postgres log\\n' ;;
  rm) exit 0 ;;
  *) exit 0 ;;
esac
`;
    const fakeNpx = `#!/usr/bin/env bash
set -eu
printf 'npx %s\\n' "$*" >> "$NPC_HARNESS_COMMAND_LOG"
if [[ "$*" == *"jest"* ]]; then exit 23; fi
exit 0
`;
    writeFileSync(join(fakeBin, 'docker'), fakeDocker, { mode: 0o755 });
    writeFileSync(join(fakeBin, 'npx'), fakeNpx, { mode: 0o755 });
  });

  afterEach(() => {
    chmodSync(temporaryDirectory, 0o755);
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('installs cleanup before container creation and removes the exact randomized container after Jest fails', () => {
    const source = readFileSync(harnessPath, 'utf8');
    expect(source.indexOf('trap cleanup')).toBeGreaterThanOrEqual(0);
    expect(source.indexOf('trap cleanup')).toBeLessThan(source.indexOf('docker run'));
    expect(source.indexOf('trap cleanup')).toBeLessThan(source.indexOf('mktemp'));
    expect(source).not.toContain(['POSTGRES', 'PASSWORD='].join('_'));

    const requestedTest = '__tests__/integration/npc-submission-lock.real.test.ts';
    const result = spawnSync('bash', [harnessPath, requestedTest], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        NPC_HARNESS_COMMAND_LOG: commandLog,
        NPC_REAL_DB_HEALTH_ATTEMPTS: '2',
      },
    });

    expect(result.status).toBe(23);
    const commands = readFileSync(commandLog, 'utf8');
    const run = commands.match(/docker run .*--name ([^ ]+)/);
    expect(run).not.toBeNull();
    const containerName = run![1];
    expect(containerName).toMatch(/^nexus-npc-real-[a-f0-9]+$/);
    expect(commands).toContain(`docker rm -f -v ${containerName}`);
    expect(commands).toContain('npx prisma migrate deploy');
    expect(commands).toContain('exec npx jest --config jest.integration.config.js --runInBand "$@"');
    expect(commands).toContain(`sh ${requestedTest}`);
    expect(commands).toContain('--env NPC_LLM_MODE=off');
    expect(commands).not.toContain('__tests__/integration/session-revocation.real.test.ts');
    expect(`${result.stdout}${result.stderr}`).not.toMatch(/postgresql:\/\/|npc_test_password/);
  });

  it('unconditionally removes the randomized name when docker run records it then fails', () => {
    const requestedTest = '__tests__/integration/npc-submission-lock.real.test.ts';
    const result = spawnSync('bash', [harnessPath, requestedTest], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        NPC_HARNESS_COMMAND_LOG: commandLog,
        NPC_FAKE_DOCKER_RUN_EXIT: '29',
      },
    });

    expect(result.status).toBe(29);
    const commands = readFileSync(commandLog, 'utf8');
    const run = commands.match(/docker run .*--name ([^ ]+)/);
    expect(run).not.toBeNull();
    expect(commands).toContain(`docker rm -f -v ${run![1]}`);
  });

  it('discovers every NPC real suite and records the immutable runtime evidence', () => {
    const evidencePath = join(temporaryDirectory, 'evidence', 'npc-runtime.txt');
    const inventory = findNpcRealSuites(join(repositoryRoot, '__tests__/integration'));
    const result = spawnSync('bash', [harnessPath, '--all'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        NPC_HARNESS_COMMAND_LOG: commandLog,
        NPC_FAKE_JEST_EXIT: '0',
        NPC_RUNTIME_EVIDENCE_PATH: evidencePath,
        NPC_REAL_DB_HEALTH_ATTEMPTS: '2',
      },
    });

    expect(result.status).toBe(0);
    const commands = readFileSync(commandLog, 'utf8');
    for (const suite of inventory) expect(commands).toContain(suite);
    expect(commands).toContain('pgvector/pgvector:pg15@sha256:a947c45cdc5906a1bc951f20a8709e321256343ee0f251e4ae00b5e7def4e6da');
    expect(commands).toContain('node:22.23.1-bookworm@sha256:5647be709086c696ff32edaaf1c70cd26d1da6ab2b39c32f3c7b4c4a31957e37');
    expect(commands).toContain('test "$(node --version)" = "$EXPECTED_NODE_VERSION"');

    const evidence = readFileSync(evidencePath, 'utf8');
    expect(evidence).toContain(`NPC_TESTS=${inventory.length}`);
    expect(evidence).toContain('NODE_VERSION=v22.23.1');
    expect(evidence).toContain('POSTGRES_MAJOR=15');
  });
});
