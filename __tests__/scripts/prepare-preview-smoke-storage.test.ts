import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve(__dirname, '../../scripts/release/prepare-preview-smoke-storage.sh');

function prepare(options: { workspaceWithinRunnerTemp?: boolean; symlinkProofDir?: boolean } = {}) {
  const fixture = mkdtempSync(join(tmpdir(), 'preview-storage-prep-test-'));
  const runnerTemp = join(fixture, 'runner');
  const workspace = options.workspaceWithinRunnerTemp ? runnerTemp : join(fixture, 'workspace');
  const githubEnv = join(fixture, 'github-env');
  mkdirSync(runnerTemp, { mode: 0o700 });
  if (!options.workspaceWithinRunnerTemp) mkdirSync(workspace, { mode: 0o700 });
  if (options.symlinkProofDir) symlinkSync(workspace, join(runnerTemp, 'preview-delivery-proofs'));
  writeFileSync(githubEnv, '');
  const result = spawnSync('bash', [script], {
    env: { ...process.env, RUNNER_TEMP: runnerTemp, GITHUB_WORKSPACE: workspace, GITHUB_ENV: githubEnv },
    encoding: 'utf8',
  });
  const values = Object.fromEntries(readFileSync(githubEnv, 'utf8').trim().split('\n').filter(Boolean).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
  return { fixture, runnerTemp, workspace, result, values };
}

describe('Preview standalone smoke storage preparation', () => {
  it('exports distinct, usable private roots outside the standalone/workspace', () => {
    const { fixture, runnerTemp, workspace, result, values } = prepare();
    try {
      expect(result.status).toBe(0);
      expect(values.PREVIEW_SMOKE_STORAGE_PARENT).toMatch(/^\//);
      expect(values.NPC_STORAGE_ROOT).toBe(join(values.PREVIEW_SMOKE_STORAGE_PARENT, 'npc'));
      expect(values.DOCUMENT_STORAGE_ROOT).toBe(join(values.PREVIEW_SMOKE_STORAGE_PARENT, 'documents'));
      for (const path of [values.PREVIEW_SMOKE_STORAGE_PARENT, values.NPC_STORAGE_ROOT, values.DOCUMENT_STORAGE_ROOT]) {
        expect(path.startsWith(`${realpathSync(runnerTemp)}/`)).toBe(true);
        expect(path.startsWith(`${realpathSync(workspace)}/`)).toBe(false);
        expect(statSync(path).mode & 0o777).toBe(0o700);
        expect(statSync(path).uid).toBe(process.getuid?.());
      }
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('refuses a runtime storage root overlapping the checkout', () => {
    const { fixture, result, values } = prepare({ workspaceWithinRunnerTemp: true });
    try {
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('SMOKE_STORAGE_OVERLAPS_WORKSPACE');
      expect(values.NPC_STORAGE_ROOT).toBeUndefined();
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('rejects a symlinked proof directory instead of redirecting runtime logs', () => {
    const { fixture, result, values } = prepare({ symlinkProofDir: true });
    try {
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('SMOKE_PROOF_DIRECTORY_INVALID');
      expect(values.NPC_STORAGE_ROOT).toBeUndefined();
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
