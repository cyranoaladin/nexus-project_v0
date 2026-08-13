/**
 * rotate-releases.sh — politique de rétention des releases.
 *
 * Environnement simulé sur fs temporaire : racine de releases, symlink
 * canonique, fichier d'épinglage. Vérifie la politique validée le
 * 2026-08-12 : active + 2 derniers SHA distincts Node22 + épinglés,
 * dry-run par défaut, fail-closed sur le fichier d'épinglage.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, existsSync, utimesSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(process.cwd(), 'scripts/ops/rotate-releases.sh');

let testDir: string;
let releaseRoot: string;
let canonical: string;
let pinFile: string;

function makeRelease(name: string, opts: { node22?: boolean; ageDays?: number } = {}) {
  const dir = join(releaseRoot, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'marker.txt'), name);
  if (opts.node22) {
    const nodeDir = join(dir, '.runtime', 'node', 'bin');
    mkdirSync(nodeDir, { recursive: true });
    writeFileSync(join(nodeDir, 'node'), '#!/bin/sh\necho v22');
    chmodSync(join(nodeDir, 'node'), 0o755);
  }
  if (opts.ageDays) {
    const when = new Date(Date.now() - opts.ageDays * 86_400_000);
    utimesSync(dir, when, when);
  }
  return dir;
}

function run(args: string[]) {
  return spawnSync('bash', [script, ...args], { encoding: 'utf8' });
}

function baseArgs(extra: string[] = []) {
  return [
    '--release-root', releaseRoot,
    '--canonical', canonical,
    '--pin-file', pinFile,
    ...extra,
  ];
}

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'nexus-rotate-'));
  releaseRoot = join(testDir, 'releases');
  mkdirSync(releaseRoot);
  pinFile = join(testDir, 'release-retention.conf');
  writeFileSync(pinFile, '# vide\n');
  canonical = join(testDir, 'current');
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('rotate-releases.sh', () => {
  it('conserve active + 2 SHA distincts Node22, purge le reste (--apply)', () => {
    makeRelease('aaa111-active', { node22: true, ageDays: 0 });
    makeRelease('bbb222-rollback', { node22: true, ageDays: 1 });
    makeRelease('ccc333-old-node22', { node22: true, ageDays: 2 });
    makeRelease('ddd444-historical', { ageDays: 30 });
    symlinkSync(join(releaseRoot, 'aaa111-active'), canonical);

    const res = run(baseArgs(['--apply']));
    expect(res.status).toBe(0);
    expect(existsSync(join(releaseRoot, 'aaa111-active'))).toBe(true);
    expect(existsSync(join(releaseRoot, 'bbb222-rollback'))).toBe(true);
    expect(existsSync(join(releaseRoot, 'ccc333-old-node22'))).toBe(false);
    expect(existsSync(join(releaseRoot, 'ddd444-historical'))).toBe(false);
  });

  it('dry-run par défaut : ne supprime rien', () => {
    makeRelease('aaa111-active', { node22: true });
    makeRelease('ddd444-historical', { ageDays: 30 });
    symlinkSync(join(releaseRoot, 'aaa111-active'), canonical);

    const res = run(baseArgs());
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('PLAN   ddd444-historical');
    expect(existsSync(join(releaseRoot, 'ddd444-historical'))).toBe(true);
  });

  it('une release épinglée est conservée même hors politique', () => {
    makeRelease('aaa111-active', { node22: true });
    makeRelease('1b8219b1-facture', { ageDays: 60 });
    writeFileSync(pinFile, '1b8219b1-facture  # facture unique\n');
    symlinkSync(join(releaseRoot, 'aaa111-active'), canonical);

    const res = run(baseArgs(['--apply']));
    expect(res.status).toBe(0);
    expect(existsSync(join(releaseRoot, '1b8219b1-facture'))).toBe(true);
    expect(res.stdout).toContain('KEEP   1b8219b1-facture');
  });

  it('échoue fail-closed si le fichier d\'épinglage est absent', () => {
    makeRelease('aaa111-active', { node22: true });
    symlinkSync(join(releaseRoot, 'aaa111-active'), canonical);
    rmSync(pinFile);

    const res = run(baseArgs(['--apply']));
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('PIN_FILE_MISSING');
    expect(existsSync(join(releaseRoot, 'aaa111-active'))).toBe(true);
  });

  it('les rebuilds du même SHA comptent pour UN groupe — seule l\'instance la plus récente est gardée', () => {
    // Préfixes >= 7 hex pour déclencher le regroupement par SHA (comme les
    // vrais noms ce2ba01713-…). Avec --keep-node22 3, seul un vrai
    // regroupement garde ff66aa77 (3e SHA distinct) tout en purgeant le
    // rebuild ancien de ee55aa77 ; sans regroupement, le rebuild ancien
    // serait compté comme 3e « SHA » et gardé à la place de ff66aa77.
    makeRelease('aaa111cc-active', { node22: true, ageDays: 0 });
    makeRelease('ee55aa77-rebuild-late', { node22: true, ageDays: 1 });
    makeRelease('ee55aa77-rebuild-early', { node22: true, ageDays: 2 });
    makeRelease('ff66aa77-older-sha', { node22: true, ageDays: 3 });
    symlinkSync(join(releaseRoot, 'aaa111cc-active'), canonical);

    const res = run(baseArgs(['--apply', '--keep-node22', '3']));
    expect(res.status).toBe(0);
    expect(existsSync(join(releaseRoot, 'ee55aa77-rebuild-late'))).toBe(true);
    expect(existsSync(join(releaseRoot, 'ee55aa77-rebuild-early'))).toBe(false);
    expect(existsSync(join(releaseRoot, 'ff66aa77-older-sha'))).toBe(true);
  });

  it('refuse un symlink canonique pointant hors de la racine des releases', () => {
    makeRelease('aaa111-active', { node22: true });
    const outside = join(testDir, 'outside-root');
    mkdirSync(outside);
    symlinkSync(outside, canonical);

    const res = run(baseArgs(['--apply']));
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('ACTIVE_OUTSIDE_RELEASE_ROOT');
  });

  it('abandonne si le health check échoue', () => {
    makeRelease('aaa111-active', { node22: true });
    makeRelease('ddd444-historical', { ageDays: 30 });
    symlinkSync(join(releaseRoot, 'aaa111-active'), canonical);

    // Port fermé → curl échoue → HEALTH_CHECK_FAILED
    const res = run(baseArgs(['--apply', '--health-url', 'http://127.0.0.1:1/health']));
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('HEALTH_CHECK_FAILED');
    expect(existsSync(join(releaseRoot, 'ddd444-historical'))).toBe(true);
  });

  it('la release active n\'est jamais purgée, même sans runtime Node embarqué', () => {
    makeRelease('aaa111-active', {});
    makeRelease('bbb222-node22', { node22: true, ageDays: 1 });
    symlinkSync(join(releaseRoot, 'aaa111-active'), canonical);

    const res = run(baseArgs(['--apply']));
    expect(res.status).toBe(0);
    expect(existsSync(join(releaseRoot, 'aaa111-active'))).toBe(true);
    expect(existsSync(join(releaseRoot, 'bbb222-node22'))).toBe(true);
  });
});
