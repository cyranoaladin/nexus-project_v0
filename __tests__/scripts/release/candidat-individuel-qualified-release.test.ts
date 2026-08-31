import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const createScript = path.join(root, 'scripts/release/create-qualification-attestation.mjs');
const verifyScript = path.join(root, 'scripts/release/verify-qualified-release.mjs');
const governanceScript = path.join(root, 'scripts/release/verify-release-governance.mjs');
const templatePath = path.join(root, 'scripts/release/qualification-manifest.template.json');

type Fixture = {
  workspace: string;
  source: string;
  payload: string;
  artifact: string;
  buildEvidence: string;
  evidence: string;
  governance: string;
  manifest: string;
  attestation: string;
  attestationDigest: string;
  sha: string;
  buildId: string;
};

function run(script: string, args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function qualificationEvidence(sha: string, buildId: string) {
  return {
    schemaVersion: 'nexus-release-qualification-input/v1',
    finalSourceSha: sha,
    finalBuildId: buildId,
    build: { count: 1, command: 'npm run build', nexusReleaseSourceSha: sha, status: 'PASS' },
    versions: {
      node: 'v22.23.1', npm: '10.9.8', next: '15.5.18', prisma: '6.19.2', postgres: '15.14',
      browsers: { bundledChromium: '145.0.7632.6', googleChrome: '152.0.7977.64' },
    },
    migrations: { before: 88, applied: 0, after: 88 },
    commands: [
      { name: 'unit', command: 'npm test -- --runInBand', status: 'PASS', counts: { passed: 101, failed: 0, total: 101 } },
      { name: 'db-one-fresh', command: 'npm run test:db:order-matrix', status: 'PASS', counts: { passed: 208, failed: 0, total: 208 } },
      { name: 'candidate-chromium', command: 'playwright chromium', status: 'PASS', counts: { passed: 12, failed: 0, total: 12 } },
      { name: 'candidate-chrome-152', command: 'playwright chrome', status: 'PASS', counts: { passed: 12, failed: 0, total: 12 } },
    ],
    requiredGates: {
      productionBuild: 'PASS', artifactAudit: 'PASS', forbiddenArtifactScan: 'PASS',
      dbOneFresh: 'PASS', candidateBundledChromium: 'PASS', candidateGoogleChrome152: 'PASS',
    },
    OLD_RELEASE: '/var/www/nexus-releases/a54d236e4-candidat-v1-ui-fix-20260830T093922Z',
    PIPELINE_STATE: 'ACTIVE_INTERNAL',
    ACTIVE_PUBLIC: 'NO',
    P1_A: 'CLIENT_ENVIRONMENT_PROVEN',
    ROLLBACK_READY: 'YES',
  };
}

function buildEvidence(sha: string, buildId: string) {
  const qualification = qualificationEvidence(sha, buildId);
  return {
    schemaVersion: 'nexus-release-build-input/v1',
    finalSourceSha: sha,
    finalBuildId: buildId,
    build: qualification.build,
    versions: qualification.versions,
    migrations: qualification.migrations,
  };
}

function createFixture(): Fixture {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-qualified-release-'));
  const source = path.join(workspace, 'source');
  const payload = path.join(workspace, 'payload');
  fs.mkdirSync(source);
  fs.mkdirSync(path.join(payload, '.next'), { recursive: true });
  fs.writeFileSync(path.join(source, 'tracked.txt'), 'frozen source\n');
  git(source, 'init');
  git(source, 'config', 'user.email', 'release-test@example.test');
  git(source, 'config', 'user.name', 'Release Test');
  git(source, 'add', '.');
  git(source, 'commit', '-m', 'freeze');
  const sha = git(source, 'rev-parse', 'HEAD');
  const buildId = 'next-build-id-qualified-001';
  fs.writeFileSync(path.join(payload, '.next', 'BUILD_ID'), `${buildId}\n`);
  fs.writeFileSync(path.join(payload, 'server.js'), 'module.exports = {};\n', { mode: 0o755 });
  fs.mkdirSync(path.join(payload, 'public'));
  fs.writeFileSync(path.join(payload, 'public', 'asset.txt'), 'immutable asset\n');
  fs.symlinkSync('public/asset.txt', path.join(payload, 'asset-link'));

  const buildEvidencePath = path.join(workspace, 'build-input.json');
  const evidence = path.join(workspace, 'qualification-input.json');
  const governance = path.join(workspace, 'governance.json');
  const manifest = path.join(payload, 'release-qualification-manifest.json');
  const artifact = path.join(workspace, 'release.tar');
  const attestation = path.join(workspace, 'release.qualification.json');
  const attestationDigest = `${attestation}.sha256`;
  fs.writeFileSync(buildEvidencePath, JSON.stringify(buildEvidence(sha, buildId), null, 2));
  fs.writeFileSync(evidence, JSON.stringify(qualificationEvidence(sha, buildId), null, 2));
  fs.writeFileSync(governance, JSON.stringify({
    schemaVersion: 'nexus-release-governance/v1', sourceSha: sha,
    branch: 'release/candidat-individuel-prod', remoteBranchSha: sha,
    tag: `candidat-individuel-v1-${sha.slice(0, 12)}`, tagTargetSha: sha, annotated: true,
    forcePushProtection: 'VERIFIED', remoteStateVerified: true,
    ci: {
      kind: 'REMOTE_STATUS_CHECK',
      contexts: [
        { name: 'CI Success', status: 'PASS', sourceSha: sha },
        { name: 'Hermetic DB Order Matrix', status: 'PASS', sourceSha: sha },
      ],
    },
  }, null, 2));
  return { workspace, source, payload, artifact, buildEvidence: buildEvidencePath, evidence, governance, manifest, attestation, attestationDigest, sha, buildId };
}

function createManifest(fixture: Fixture) {
  return run(createScript, [
    'manifest', '--source-root', fixture.source, '--payload', fixture.payload,
    '--evidence', fixture.buildEvidence, '--output', fixture.manifest,
  ], { FINAL_SOURCE_SHA: fixture.sha });
}

function packageAndAttest(fixture: Fixture) {
  execFileSync('tar', ['-cf', fixture.artifact, '-C', fixture.payload, '.']);
  return attestExistingArtifact(fixture);
}

function attestExistingArtifact(fixture: Fixture, manifest = fixture.manifest) {
  return run(createScript, [
    'attestation', '--source-root', fixture.source, '--payload', fixture.payload,
    '--manifest', manifest, '--artifact', fixture.artifact,
    '--evidence', fixture.evidence, '--governance', fixture.governance,
    '--output', fixture.attestation,
  ], { FINAL_SOURCE_SHA: fixture.sha });
}

function verify(fixture: Fixture) {
  return run(verifyScript, [
    '--source-root', fixture.source, '--payload', fixture.payload,
    '--manifest', fixture.manifest, '--artifact', fixture.artifact,
    '--attestation', fixture.attestation, '--attestation-sha256', fixture.attestationDigest,
  ], { FINAL_SOURCE_SHA: fixture.sha });
}

describe('immutable candidate release qualification chain', () => {
  const workspaces: string[] = [];
  afterEach(() => workspaces.splice(0).forEach((entry) => fs.rmSync(entry, { recursive: true, force: true })));
  const fixture = () => { const value = createFixture(); workspaces.push(value.workspace); return value; };

  it('ships only a placeholder template and creates a self-reference-free verified chain', () => {
    const current = fixture();
    expect(JSON.parse(fs.readFileSync(templatePath, 'utf8')).finalSourceSha).toBe('<FINAL_SOURCE_SHA>');
    expect(createManifest(current).status).toBe(0);
    const first = JSON.parse(fs.readFileSync(current.manifest, 'utf8'));
    expect(first.commands).toBeUndefined();
    expect(first.requiredGates).toBeUndefined();
    expect(createManifest(current).status).toBe(0);
    const second = JSON.parse(fs.readFileSync(current.manifest, 'utf8'));
    expect(second.payload).toEqual(first.payload);
    expect(second.payload.entries.some((entry: { path: string }) => entry.path.includes('release-qualification-manifest'))).toBe(false);
    expect(packageAndAttest(current).status).toBe(0);
    expect(verify(current).status).toBe(0);
    expect(fs.readFileSync(current.attestationDigest, 'utf8')).toMatch(/^[a-f0-9]{64}  release\.qualification\.json\n$/);
  });

  it.each([
    ['altered file', (f: Fixture) => fs.writeFileSync(path.join(f.payload, 'server.js'), 'tampered')],
    ['added file', (f: Fixture) => fs.writeFileSync(path.join(f.payload, 'added.txt'), 'added')],
    ['deleted file', (f: Fixture) => fs.rmSync(path.join(f.payload, 'public', 'asset.txt'))],
    ['changed symlink', (f: Fixture) => { fs.rmSync(path.join(f.payload, 'asset-link')); fs.symlinkSync('server.js', path.join(f.payload, 'asset-link')); }],
  ])('rejects an %s after qualification', (_label, mutate) => {
    const current = fixture();
    expect(createManifest(current).status).toBe(0);
    expect(packageAndAttest(current).status).toBe(0);
    mutate(current);
    expect(verify(current).status).not.toBe(0);
  });

  it('rejects artifact, manifest and attestation reconstruction or tampering', () => {
    const current = fixture();
    expect(createManifest(current).status).toBe(0);
    expect(packageAndAttest(current).status).toBe(0);
    fs.appendFileSync(current.artifact, 'reconstructed');
    expect(verify(current).status).not.toBe(0);
    fs.writeFileSync(current.attestationDigest, `${'0'.repeat(64)}  release.qualification.json\n`);
    expect(verify(current).status).not.toBe(0);
  });

  it('refuses to attest an archive reconstructed from a different payload', () => {
    const current = fixture();
    expect(createManifest(current).status).toBe(0);
    const foreignPayload = path.join(current.workspace, 'foreign-payload');
    fs.mkdirSync(foreignPayload);
    fs.writeFileSync(path.join(foreignPayload, 'server.js'), 'foreign reconstruction');
    execFileSync('tar', ['-cf', current.artifact, '-C', foreignPayload, '.']);

    expect(attestExistingArtifact(current).status).not.toBe(0);
    expect(fs.existsSync(current.attestation)).toBe(false);
  });

  it('requires the regular embedded manifest and rejects external copies, deletion and symlink replacement', () => {
    for (const mode of ['external', 'deleted', 'symlink'] as const) {
      const current = fixture();
      expect(createManifest(current).status).toBe(0);
      const external = path.join(current.workspace, `external-${mode}.json`);
      fs.copyFileSync(current.manifest, external);
      execFileSync('tar', ['-cf', current.artifact, '-C', current.payload, '.']);
      if (mode === 'external') {
        expect(attestExistingArtifact(current, external).status).not.toBe(0);
      } else {
        fs.rmSync(current.manifest);
        if (mode === 'symlink') fs.symlinkSync(external, current.manifest);
        expect(attestExistingArtifact(current).status).not.toBe(0);
      }
    }
  });

  it('rejects a rehashed attestation whose versions or command results differ from the manifest', () => {
    const current = fixture();
    expect(createManifest(current).status).toBe(0);
    expect(packageAndAttest(current).status).toBe(0);
    const attestation = JSON.parse(fs.readFileSync(current.attestation, 'utf8'));
    attestation.versions.node = 'v22.99.0';
    fs.writeFileSync(current.attestation, `${JSON.stringify(attestation)}\n`);
    const digest = createHash('sha256').update(fs.readFileSync(current.attestation)).digest('hex');
    fs.writeFileSync(current.attestationDigest, `${digest}  release.qualification.json\n`);

    expect(verify(current).status).not.toBe(0);
  });

  it.each([
    ['build count', (value: any) => { value.build.count = 2; }],
    ['source SHA', (value: any) => { value.finalSourceSha = 'a'.repeat(40); }],
    ['build SHA', (value: any) => { value.build.nexusReleaseSourceSha = 'b'.repeat(40); }],
    ['build ID', (value: any) => { value.finalBuildId = '../bad'; }],
    ['migration before', (value: any) => { value.migrations.before = 87; }],
    ['migration applied', (value: any) => { value.migrations.applied = 1; }],
    ['migration after', (value: any) => { value.migrations.after = 89; }],
    ['command failure', (value: any) => { value.commands[0].status = 'FAIL'; }],
    ['invalid command counts', (value: any) => { value.commands[0].counts.total = 102; }],
    ['missing required gate', (value: any) => { delete value.requiredGates.artifactAudit; }],
    ['unsafe rollback target', (value: any) => { value.OLD_RELEASE = '/tmp/release'; }],
    ['pipeline not internal', (value: any) => { value.PIPELINE_STATE = 'OFF'; }],
    ['public enabled', (value: any) => { value.ACTIVE_PUBLIC = 'YES'; }],
    ['P1-A still open', (value: any) => { value.P1_A = 'OPEN'; }],
    ['rollback not ready', (value: any) => { value.ROLLBACK_READY = 'NO'; }],
  ])('fails closed for invalid qualification evidence: %s', (_label, mutate) => {
    const current = fixture();
    expect(createManifest(current).status).toBe(0);
    const value = JSON.parse(fs.readFileSync(current.evidence, 'utf8'));
    mutate(value);
    fs.writeFileSync(current.evidence, JSON.stringify(value));
    execFileSync('tar', ['-cf', current.artifact, '-C', current.payload, '.']);
    expect(attestExistingArtifact(current).status).not.toBe(0);
  });

  it('rejects dirty source and any post-gate source commit', () => {
    const dirty = fixture();
    fs.appendFileSync(path.join(dirty.source, 'tracked.txt'), 'dirty');
    expect(createManifest(dirty).status).not.toBe(0);

    const changed = fixture();
    expect(createManifest(changed).status).toBe(0);
    expect(packageAndAttest(changed).status).toBe(0);
    fs.writeFileSync(path.join(changed.source, 'later.txt'), 'later');
    git(changed.source, 'add', '.');
    git(changed.source, 'commit', '-m', 'forbidden later commit');
    expect(verify(changed).status).not.toBe(0);
  });

  it('requires verified branch, annotated tag, protection and CI evidence', () => {
    const current = fixture();
    const value = JSON.parse(fs.readFileSync(current.governance, 'utf8'));
    for (const mutate of [
      (v: any) => { v.annotated = false; },
      (v: any) => { v.remoteBranchSha = 'c'.repeat(40); },
      (v: any) => { v.forcePushProtection = 'UNVERIFIED'; },
      (v: any) => { v.ci.status = 'FAIL'; },
    ]) {
      const candidate = JSON.parse(JSON.stringify(value));
      mutate(candidate);
      fs.writeFileSync(current.governance, JSON.stringify(candidate));
      expect(createManifest(current).status).toBe(0);
      execFileSync('tar', ['-cf', current.artifact, '-C', current.payload, '.']);
      expect(packageAndAttest(current).status).not.toBe(0);
    }
  });

  it('governance verifier checks the live remote branch, peeled annotated tag, protection and required check', () => {
    const current = fixture();
    const remote = path.join(current.workspace, 'remote.git');
    git(current.workspace, 'init', '--bare', remote);
    git(current.source, 'remote', 'add', 'origin', remote);
    git(current.source, 'branch', '-M', 'release/candidat-individuel-prod');
    git(current.source, 'tag', '-a', `candidat-individuel-v1-${current.sha.slice(0, 12)}`, '-m', 'immutable release');
    git(current.source, 'push', 'origin', 'release/candidat-individuel-prod', '--tags');
    const bin = path.join(current.workspace, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\ncase "$*" in\n*branches*protection*) printf '%s' '{"allow_force_pushes":{"enabled":false}}';;\n*check-runs*) printf '%s' '{"check_runs":[{"name":"CI Success","conclusion":"success","head_sha":"${current.sha}"},{"name":"Hermetic DB Order Matrix","conclusion":"success","head_sha":"${current.sha}"}]}' ;;\n*) exit 1;;\nesac\n`, { mode: 0o755 });
    const output = path.join(current.workspace, 'live-governance.json');
    const result = run(governanceScript, [
      '--source-root', current.source, '--remote', 'origin', '--repository', 'nexus/reussite',
      '--branch', 'release/candidat-individuel-prod',
      '--tag', `candidat-individuel-v1-${current.sha.slice(0, 12)}`,
      '--output', output,
    ], { FINAL_SOURCE_SHA: current.sha, PATH: `${bin}:${process.env.PATH}` });
    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toMatchObject({
      sourceSha: current.sha, annotated: true, forcePushProtection: 'VERIFIED',
      ci: { kind: 'REMOTE_STATUS_CHECK', contexts: [
        { name: 'CI Success', status: 'PASS', sourceSha: current.sha },
        { name: 'Hermetic DB Order Matrix', status: 'PASS', sourceSha: current.sha },
      ] },
    });
  });

  it('rejects remote governance when either mandatory workflow context is absent', () => {
    const current = fixture();
    const remote = path.join(current.workspace, 'remote.git');
    git(current.workspace, 'init', '--bare', remote);
    git(current.source, 'remote', 'add', 'origin', remote);
    git(current.source, 'branch', '-M', 'release/candidat-individuel-prod');
    git(current.source, 'tag', '-a', `candidat-individuel-v1-${current.sha.slice(0, 12)}`, '-m', 'immutable release');
    git(current.source, 'push', 'origin', 'release/candidat-individuel-prod', '--tags');
    const bin = path.join(current.workspace, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\ncase "$*" in\n*branches*protection*) printf '%s' '{"allow_force_pushes":{"enabled":false}}';;\n*check-runs*) printf '%s' '{"check_runs":[{"name":"CI Success","conclusion":"success","head_sha":"${current.sha}"}]}' ;;\n*) exit 1;;\nesac\n`, { mode: 0o755 });
    const result = run(governanceScript, [
      '--source-root', current.source, '--remote', 'origin', '--repository', 'nexus/reussite',
      '--branch', 'release/candidat-individuel-prod',
      '--tag', `candidat-individuel-v1-${current.sha.slice(0, 12)}`,
      '--output', path.join(current.workspace, 'governance.json'),
    ], { FINAL_SOURCE_SHA: current.sha, PATH: `${bin}:${process.env.PATH}` });
    expect(result.status).not.toBe(0);
  });
});
