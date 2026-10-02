import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const guard = resolve(__dirname, '../../scripts/release/verify-preview-npc-startup-guard.sh');

function runFakeStandalone(source: string, options: { ssFailure?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'preview-npc-guard-test-'));
  const npc = join(root, 'npc');
  const documents = join(root, 'documents');
  const log = join(root, 'negative.log');
  mkdirSync(npc, { mode: 0o700 });
  mkdirSync(documents, { mode: 0o700 });
  writeFileSync(join(root, 'server.js'), source);
  if (options.ssFailure) {
    mkdirSync(join(root, 'bin'));
    writeFileSync(join(root, 'bin', 'ss'), '#!/bin/sh\nexit 77\n');
    chmodSync(join(root, 'bin', 'ss'), 0o755);
  }
  try {
    const result = spawnSync('bash', [guard, log], {
      cwd: root,
      env: {
        ...process.env,
        NPC_STORAGE_ROOT: npc,
        DOCUMENT_STORAGE_ROOT: documents,
        PORT: '49873',
        PREVIEW_NPC_GUARD_TIMEOUT_SECONDS: '2',
        PATH: options.ssFailure ? `${join(root, 'bin')}:${process.env.PATH}` : process.env.PATH,
      },
      encoding: 'utf8',
      timeout: 8000,
    });
    return { result, log: existsSync(log) ? readFileSync(log, 'utf8') : '' };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('standalone NPC startup negative control', () => {
  it('accepts only a nonzero exit with the actual NPC fail-closed marker', () => {
    const { result, log } = runFakeStandalone("if (process.env.NPC_STORAGE_ROOT) process.exit(9); console.error('NPC_STORAGE_PREFLIGHT_FAILED'); process.exit(1);");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('NPC_MISSING_ROOT_COUNTERTEST=PASS');
    expect(log).toContain('NPC_STORAGE_PREFLIGHT_FAILED');
  });

  it('rejects a different startup failure', () => {
    const { result } = runFakeStandalone("console.error('DATABASE_STARTUP_PREFLIGHT_FAILED'); process.exit(1);");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NPC_GUARD_EXPECTED_MARKER_MISSING');
  });

  it('rejects a server that stays alive instead of failing closed', () => {
    const { result } = runFakeStandalone("console.log('Ready in 1ms'); setInterval(() => {}, 1000);");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NPC_GUARD_UNEXPECTED_EXIT=124');
  });

  it('rejects an unavailable listener probe before claiming the negative control passed', () => {
    const { result } = runFakeStandalone("console.error('NPC_STORAGE_PREFLIGHT_FAILED'); process.exit(1);", { ssFailure: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NPC_GUARD_LISTENER_PROBE_FAILED');
    expect(result.stdout).not.toContain('NPC_MISSING_ROOT_COUNTERTEST=PASS');
  });
});
