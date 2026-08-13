/**
 * purge-build-workspaces.sh — purge du staging/validation de build.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts/ops/purge-build-workspaces.sh');

let testDir: string;
let staging: string;
let validation: string;

function makeWorkspace(root: string, name: string) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'build.log'), name);
  return dir;
}

function run(args: string[]) {
  return spawnSync('bash', [script, ...args], { encoding: 'utf8' });
}

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'nexus-purge-'));
  staging = join(testDir, 'nexus-build-staging');
  validation = join(testDir, 'nexus-build-validation');
  mkdirSync(staging);
  mkdirSync(validation);
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('purge-build-workspaces.sh', () => {
  it('purge tous les workspaces sauf --keep (--apply)', () => {
    makeWorkspace(staging, 'sha-old');
    makeWorkspace(staging, 'sha-current');
    makeWorkspace(validation, 'sha-older');

    const res = run(['--root', staging, '--root', validation, '--keep', 'sha-current', '--apply']);
    expect(res.status).toBe(0);
    expect(existsSync(join(staging, 'sha-current'))).toBe(true);
    expect(existsSync(join(staging, 'sha-old'))).toBe(false);
    expect(existsSync(join(validation, 'sha-older'))).toBe(false);
  });

  it('dry-run par défaut : ne supprime rien', () => {
    makeWorkspace(staging, 'sha-old');
    const res = run(['--root', staging]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('PLAN');
    expect(existsSync(join(staging, 'sha-old'))).toBe(true);
  });

  it('refuse une racine qui n\'est pas un workspace de build nexus', () => {
    const foreign = join(testDir, 'labomaths');
    mkdirSync(foreign);
    makeWorkspace(foreign, 'x');
    const res = run(['--root', foreign, '--apply']);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('ROOT_NOT_A_NEXUS_BUILD_WORKSPACE');
    expect(existsSync(join(foreign, 'x'))).toBe(true);
  });

  it('refuse un chemin relatif', () => {
    const res = run(['--root', 'nexus-build-staging', '--apply']);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('PATH_NOT_ABSOLUTE');
  });

  it('tolère une racine absente (SKIP, exit 0)', () => {
    const res = run(['--root', join(testDir, 'nexus-build-missing'), '--apply']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('SKIP');
  });
});
