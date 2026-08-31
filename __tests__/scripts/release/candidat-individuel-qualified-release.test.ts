import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(__dirname, '../../..');
const REAL_TAR = execFileSync('which', ['tar'], { encoding: 'utf8' }).trim();
const createScript = path.join(root, 'scripts/release/create-qualification-attestation.mjs');
const verifyScript = path.join(root, 'scripts/release/verify-qualified-release.mjs');
const governanceScript = path.join(root, 'scripts/release/verify-release-governance.mjs');
const packageScript = path.join(root, 'scripts/release/package-qualified-release.mjs');
const standaloneScript = path.join(root, 'scripts/release/verify-standalone-artifact.mjs');
const coreUrl = pathToFileURL(path.join(root, 'scripts/release/qualified-release-core.mjs')).href;
const templatePath = path.join(root, 'scripts/release/qualification-manifest.template.json');

type Fixture = {
  workspace: string;
  source: string;
  payload: string;
  artifact: string;
  buildEvidence: string;
  buildReceipt: string;
  evidence: string;
  governance: string;
  manifest: string;
  attestation: string;
  attestationDigest: string;
  sha: string;
  buildId: string;
  bin: string;
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

function inventory(rootPath: string, exclude: string[] = []) {
  const code = `import {computePayloadInventory as c} from ${JSON.stringify(coreUrl)}; console.log(JSON.stringify(c(${JSON.stringify(rootPath)}, {exclude:${JSON.stringify(exclude)}})))`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

function writeGovernanceFakes(
  bin: string,
  sha: string,
  app = 'github-actions',
  includeMatrix = true,
  remoteUrl = 'git@github.com:nexus-reussite/nexus-project.git',
) {
  fs.mkdirSync(bin, { recursive: true });
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh
case "$1 $2" in
  "remote get-url") printf '%s\n' '${remoteUrl}';;
  "ls-remote --heads") printf '%s\t%s\n' '${sha}' 'refs/heads/release/candidat-individuel-prod';;
  "ls-remote --tags") printf '%s\t%s\n%s\t%s\n' 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' 'refs/tags/candidat-individuel-v1-${sha.slice(0, 12)}' '${sha}' 'refs/tags/candidat-individuel-v1-${sha.slice(0, 12)}^{}';;
  *) exec ${realGit} "$@";;
esac
`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh
case "$*" in
  *branches*protection*) printf '%s' '{"enforce_admins":{"enabled":true},"allow_force_pushes":{"enabled":false},"allow_deletions":{"enabled":false}}';;
  *actions/workflows/ci.yml/runs*) printf '%s' '[{"workflow_runs":[{"id":9001,"run_number":42,"head_sha":"${sha}","conclusion":"success","status":"completed","path":".github/workflows/ci.yml","html_url":"https://github.com/nexus-reussite/nexus-project/actions/runs/9001"}]}]';;
  *commits*check-runs*) printf '%s' '[{"check_runs":[{"id":1,"name":"CI Success","head_sha":"${sha}","conclusion":"success","details_url":"https://github.com/nexus-reussite/nexus-project/actions/runs/9001/job/1","app":{"slug":"${app}","owner":{"login":"github"}}}${includeMatrix ? `,{"id":2,"name":"Hermetic DB Order Matrix","head_sha":"${sha}","conclusion":"success","details_url":"https://github.com/nexus-reussite/nexus-project/actions/runs/9001/job/2","app":{"slug":"${app}","owner":{"login":"github"}}}` : ''}]}]';;
  *rulesets/77*) printf '%s' '{"id":77,"name":"immutable candidate tags","target":"tag","enforcement":"active","bypass_actors":[],"conditions":{"ref_name":{"include":["refs/tags/candidat-individuel-v1-*"],"exclude":[]}},"rules":[{"type":"deletion"},{"type":"non_fast_forward"}]}';;
  *rulesets*) printf '%s' '[{"id":77}]';;
  *) exit 1;;
esac
`, { mode: 0o755 });
}

function governanceEvidence(sha: string) {
  return {
    schemaVersion: 'nexus-release-governance/v1', sourceSha: sha,
    remote: { name: 'origin', url: 'git@github.com:nexus-reussite/nexus-project.git', repository: 'nexus-reussite/nexus-project' },
    branch: 'release/candidat-individuel-prod', remoteBranchSha: sha,
    tag: `candidat-individuel-v1-${sha.slice(0, 12)}`, tagTargetSha: sha, annotated: true,
    branchProtection: { enforceAdmins: true, allowForcePushes: false, allowDeletions: false },
    tagRuleset: {
      id: 77, name: 'immutable candidate tags', enforcement: 'active',
      pattern: 'refs/tags/candidat-individuel-v1-*', bypassActors: 0,
      include: ['refs/tags/candidat-individuel-v1-*'], exclude: [], exactTagCovered: true,
      deletionProtected: true, nonFastForwardProtected: true,
    },
    remoteStateVerified: true,
    ci: {
      kind: 'REMOTE_STATUS_CHECK', workflow: '.github/workflows/ci.yml', runId: 9001,
      contexts: [
        { name: 'CI Success', status: 'PASS', sourceSha: sha, checkRunId: 1, detailsUrl: 'https://github.com/nexus-reussite/nexus-project/actions/runs/9001/job/1', app: { slug: 'github-actions', owner: 'github' } },
        { name: 'Hermetic DB Order Matrix', status: 'PASS', sourceSha: sha, checkRunId: 2, detailsUrl: 'https://github.com/nexus-reussite/nexus-project/actions/runs/9001/job/2', app: { slug: 'github-actions', owner: 'github' } },
      ],
    },
  };
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
  fs.writeFileSync(path.join(source, 'tracked.txt'), 'frozen source\n');
  fs.writeFileSync(path.join(source, '.gitignore'), '.next/\n');
  git(source, 'init');
  git(source, 'config', 'user.email', 'release-test@example.test');
  git(source, 'config', 'user.name', 'Release Test');
  git(source, 'add', '.');
  git(source, 'commit', '-m', 'freeze');
  const sha = git(source, 'rev-parse', 'HEAD');
  const buildId = 'next-build-id-qualified-001';
  const standalone = path.join(source, '.next', 'standalone');
  fs.mkdirSync(path.join(standalone, '.next'), { recursive: true });
  fs.writeFileSync(path.join(standalone, '.next', 'BUILD_ID'), `${buildId}\n`);
  fs.writeFileSync(path.join(standalone, 'server.js'), 'module.exports = {};\n', { mode: 0o755 });
  fs.mkdirSync(path.join(standalone, 'public'));
  fs.writeFileSync(path.join(standalone, 'public', 'asset.txt'), 'immutable asset\n');
  fs.symlinkSync('public/asset.txt', path.join(standalone, 'asset-link'));
  for (const directory of [standalone, path.join(standalone, '.next'), path.join(standalone, 'public')]) fs.chmodSync(directory, 0o755);
  for (const file of [path.join(standalone, '.next', 'BUILD_ID'), path.join(standalone, 'public', 'asset.txt')]) fs.chmodSync(file, 0o644);
  fs.cpSync(standalone, payload, { recursive: true, verbatimSymlinks: true });
  for (const directory of [payload, path.join(payload, '.next'), path.join(payload, 'public')]) fs.chmodSync(directory, 0o755);
  for (const file of [path.join(payload, '.next', 'BUILD_ID'), path.join(payload, 'public', 'asset.txt')]) fs.chmodSync(file, 0o644);
  fs.chmodSync(path.join(payload, 'server.js'), 0o755);

  const buildEvidencePath = path.join(workspace, 'build-input.json');
  const evidence = path.join(workspace, 'qualification-input.json');
  const buildReceipt = path.join(workspace, 'build-receipt.json');
  const governance = path.join(workspace, 'governance.json');
  const manifest = path.join(payload, 'release-qualification-manifest.json');
  const artifact = path.join(workspace, 'release.tar');
  const attestation = path.join(workspace, 'release.qualification.json');
  const attestationDigest = `${attestation}.sha256`;
  fs.writeFileSync(buildEvidencePath, JSON.stringify(buildEvidence(sha, buildId), null, 2));
  const standaloneDigest = inventory(standalone).digest;
  const provenance = path.join(payload, 'release-build-provenance.json');
  fs.writeFileSync(provenance, `${JSON.stringify({
    schemaVersion: 'nexus-release-build-provenance/v1', finalSourceSha: sha,
    finalBuildId: buildId, buildCount: 1, standaloneDigest,
  })}\n`);
  fs.chmodSync(provenance, 0o644);
  fs.writeFileSync(buildReceipt, JSON.stringify({
    schemaVersion: 'nexus-release-build-receipt/v1', finalSourceSha: sha, finalBuildId: buildId, buildCount: 1,
    sourceIdentity: '.', standaloneIdentity: '.next/standalone', payloadIdentity: 'qualified-payload',
    standaloneDigest, payloadDigest: inventory(payload, ['release-qualification-manifest.json']).digest,
    provenanceSha256: createHash('sha256').update(fs.readFileSync(provenance)).digest('hex'),
    buildEvidenceSha256: createHash('sha256').update(fs.readFileSync(buildEvidencePath)).digest('hex'),
  }, null, 2));
  fs.writeFileSync(evidence, JSON.stringify(qualificationEvidence(sha, buildId), null, 2));
  fs.writeFileSync(governance, JSON.stringify(governanceEvidence(sha), null, 2));
  const bin = path.join(workspace, 'bin');
  writeGovernanceFakes(bin, sha);
  return { workspace, source, payload, artifact, buildEvidence: buildEvidencePath, buildReceipt, evidence, governance, manifest, attestation, attestationDigest, sha, buildId, bin };
}

function createManifest(fixture: Fixture) {
  return run(createScript, [
    'manifest', '--source-root', fixture.source, '--payload', fixture.payload,
    '--build-receipt', fixture.buildReceipt, '--evidence', fixture.buildEvidence, '--output', fixture.manifest,
  ], { FINAL_SOURCE_SHA: fixture.sha });
}

function packageAndAttest(fixture: Fixture) {
  const packaged = packageArtifact(fixture);
  if (packaged.status !== 0) return packaged;
  return attestExistingArtifact(fixture);
}

function packageArtifact(fixture: Fixture) {
  return run(packageScript, [
    '--source-root', fixture.source, '--payload', fixture.payload, '--build-receipt', fixture.buildReceipt,
    '--output', fixture.artifact,
  ], { FINAL_SOURCE_SHA: fixture.sha });
}

function attestExistingArtifact(fixture: Fixture, manifest = fixture.manifest) {
  return run(createScript, [
    'attestation', '--source-root', fixture.source, '--payload', fixture.payload,
    '--build-receipt', fixture.buildReceipt, '--manifest', manifest, '--artifact', fixture.artifact,
    '--evidence', fixture.evidence, '--governance', fixture.governance,
    '--remote', 'origin', '--output', fixture.attestation,
  ], { FINAL_SOURCE_SHA: fixture.sha, PATH: `${fixture.bin}:${process.env.PATH}` });
}

function verify(fixture: Fixture) {
  return run(verifyScript, [
    '--source-root', fixture.source, '--payload', fixture.payload,
    '--build-receipt', fixture.buildReceipt, '--manifest', fixture.manifest, '--artifact', fixture.artifact,
    '--attestation', fixture.attestation, '--attestation-sha256', fixture.attestationDigest,
    '--remote', 'origin',
  ], { FINAL_SOURCE_SHA: fixture.sha, PATH: `${fixture.bin}:${process.env.PATH}` });
}

describe('immutable candidate release qualification chain', () => {
  const workspaces: string[] = [];
  afterEach(() => workspaces.splice(0).forEach((entry) => fs.rmSync(entry, { recursive: true, force: true })));
  const fixture = () => { const value = createFixture(); workspaces.push(value.workspace); return value; };

  it('ships only a placeholder template and creates a self-reference-free verified chain', () => {
    const current = fixture();
    expect(JSON.parse(fs.readFileSync(templatePath, 'utf8')).finalSourceSha).toBe('<FINAL_SOURCE_SHA>');
    const created = createManifest(current);
    expect({ status: created.status, stderr: created.stderr }).toEqual({ status: 0, stderr: '' });
    const first = JSON.parse(fs.readFileSync(current.manifest, 'utf8'));
    expect(first.commands).toBeUndefined();
    expect(first.requiredGates).toBeUndefined();
    expect(createManifest(current).status).not.toBe(0);
    const second = JSON.parse(fs.readFileSync(current.manifest, 'utf8'));
    expect(second.payload).toEqual(first.payload);
    expect(second.payload.entries.some((entry: { path: string }) => entry.path.includes('release-qualification-manifest'))).toBe(false);
    expect(packageAndAttest(current).status).toBe(0);
    expect(verify(current).status).toBe(0);
    expect(fs.readFileSync(current.attestationDigest, 'utf8')).toMatch(/^[a-f0-9]{64}  release\.qualification\.json\n$/);
  });

  it('creates the embedded manifest once without following a pre-existing symlink', () => {
    const current = fixture();
    const external = path.join(current.workspace, 'external-manifest-target.json');
    fs.writeFileSync(external, 'DO NOT OVERWRITE');
    fs.symlinkSync(external, current.manifest);
    expect(createManifest(current).status).not.toBe(0);
    expect(fs.readFileSync(external, 'utf8')).toBe('DO NOT OVERWRITE');
    expect(fs.lstatSync(current.manifest).isSymbolicLink()).toBe(true);
  });

  it('publishes the packaged archive exclusively when a target appears during packaging', () => {
    const current = fixture();
    expect(createManifest(current).status).toBe(0);
    fs.writeFileSync(path.join(current.bin, 'tar'), `#!/bin/sh\nprintf '%s' 'RACING_TARGET' > "$RACE_TARGET"\nexec ${REAL_TAR} "$@"\n`, { mode: 0o755 });
    const result = run(packageScript, [
      '--source-root', current.source, '--payload', current.payload, '--build-receipt', current.buildReceipt,
      '--output', current.artifact,
    ], { FINAL_SOURCE_SHA: current.sha, PATH: `${current.bin}:${process.env.PATH}`, RACE_TARGET: current.artifact });
    expect(result.status).not.toBe(0);
    expect(fs.readFileSync(current.artifact, 'utf8')).toBe('RACING_TARGET');
  });

  it('verifies the exact qualified release after transfer to a different absolute directory', () => {
    const current = fixture();
    expect(createManifest(current).status).toBe(0);
    expect(packageAndAttest(current).status).toBe(0);
    const transferRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-qualified-transfer-'));
    workspaces.push(transferRoot);
    const transferredWorkspace = path.join(transferRoot, 'copied');
    fs.cpSync(current.workspace, transferredWorkspace, { recursive: true, verbatimSymlinks: true });
    const transferred = Object.fromEntries(Object.entries(current).map(([key, value]) => [
      key,
      typeof value === 'string' && value.startsWith(current.workspace)
        ? path.join(transferredWorkspace, path.relative(current.workspace, value))
        : value,
    ])) as Fixture;
    fs.rmSync(transferred.payload, { recursive: true, force: true });
    fs.mkdirSync(transferred.payload, { mode: 0o755 });
    execFileSync(REAL_TAR, ['-xf', transferred.artifact, '-C', transferred.payload]);
    const originExclude = ['release-qualification-manifest.json', 'release-build-provenance.json'];
    const receipt = JSON.parse(fs.readFileSync(transferred.buildReceipt, 'utf8'));
    expect(inventory(transferred.payload, originExclude).digest).toBe(receipt.standaloneDigest);
    fs.rmSync(current.workspace, { recursive: true, force: true });
    const verification = verify(transferred);
    expect({ status: verification.status, stderr: verification.stderr }).toEqual({ status: 0, stderr: '' });
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
      expect(packageArtifact(current).status).toBe(0);
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
    expect(packageArtifact(current).status).toBe(0);
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

  it.each([
    ['check ownership drift', 'evil-actions', 'git@github.com:nexus-reussite/nexus-project.git'],
    ['remote identity drift', 'github-actions', 'git@github.com:other-owner/other-repository.git'],
  ])('re-queries live governance during final verification: %s', (_label, app, remoteUrl) => {
    const current = fixture();
    expect(createManifest(current).status).toBe(0);
    expect(packageAndAttest(current).status).toBe(0);
    writeGovernanceFakes(current.bin, current.sha, app, true, remoteUrl);
    expect(verify(current).status).not.toBe(0);
  });

  it('rejects duplicate arguments on legacy release CLIs', () => {
    const current = fixture();
    const duplicateCreate = run(createScript, [
      'manifest', '--source-root', '/invalid', '--source-root', current.source,
      '--payload', current.payload, '--build-receipt', current.buildReceipt,
      '--evidence', current.buildEvidence, '--output', current.manifest,
    ], { FINAL_SOURCE_SHA: current.sha });
    expect(duplicateCreate.status).not.toBe(0);
    expect(createManifest(current).status).toBe(0);
    expect(packageAndAttest(current).status).toBe(0);
    const duplicateVerify = run(verifyScript, [
      '--source-root', current.source, '--payload', current.payload, '--build-receipt', current.buildReceipt,
      '--manifest', current.manifest, '--artifact', current.artifact, '--attestation', current.attestation,
      '--attestation-sha256', current.attestationDigest, '--remote', 'invalid', '--remote', 'origin',
    ], { FINAL_SOURCE_SHA: current.sha, PATH: `${current.bin}:${process.env.PATH}` });
    expect(duplicateVerify.status).not.toBe(0);
    const duplicateStandalone = run(standaloneScript, [
      current.source, '--final-source-sha', current.sha, '--final-source-sha', current.sha,
    ], { RELEASE_SHA: current.sha });
    expect(duplicateStandalone.status).not.toBe(0);
    expect(`${duplicateStandalone.stdout}${duplicateStandalone.stderr}`).toContain('ARGUMENT_INVALID');
  });

  it('requires verified branch, annotated tag, protection and CI evidence', () => {
    const current = fixture();
    expect(createManifest(current).status).toBe(0);
    const value = JSON.parse(fs.readFileSync(current.governance, 'utf8'));
    for (const mutate of [
      (v: any) => { v.annotated = false; },
      (v: any) => { v.remoteBranchSha = 'c'.repeat(40); },
      (v: any) => { v.branchProtection.enforceAdmins = false; },
      (v: any) => { v.ci.contexts[0].status = 'FAIL'; },
    ]) {
      const candidate = JSON.parse(JSON.stringify(value));
      mutate(candidate);
      fs.writeFileSync(current.governance, JSON.stringify(candidate));
      fs.rmSync(current.artifact, { force: true });
      expect(packageArtifact(current).status).toBe(0);
      expect(attestExistingArtifact(current).status).not.toBe(0);
    }
  });

  it('governance verifier checks the live remote branch, peeled annotated tag, protection and required check', () => {
    const current = fixture();
    const output = path.join(current.workspace, 'live-governance.json');
    const result = run(governanceScript, [
      '--source-root', current.source, '--remote', 'origin',
      '--branch', 'release/candidat-individuel-prod',
      '--tag', `candidat-individuel-v1-${current.sha.slice(0, 12)}`,
      '--output', output,
    ], { FINAL_SOURCE_SHA: current.sha, PATH: `${current.bin}:${process.env.PATH}` });
    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toMatchObject({
      sourceSha: current.sha, annotated: true,
      remote: { repository: 'nexus-reussite/nexus-project' },
      branchProtection: { enforceAdmins: true, allowForcePushes: false, allowDeletions: false },
      ci: { kind: 'REMOTE_STATUS_CHECK', contexts: [
        { name: 'CI Success', status: 'PASS', sourceSha: current.sha, checkRunId: 1 },
        { name: 'Hermetic DB Order Matrix', status: 'PASS', sourceSha: current.sha, checkRunId: 2 },
      ] },
    });
  });

  it('rejects remote governance when either mandatory workflow context is absent', () => {
    const current = fixture();
    writeGovernanceFakes(current.bin, current.sha, 'github-actions', false);
    const result = run(governanceScript, [
      '--source-root', current.source, '--remote', 'origin',
      '--branch', 'release/candidat-individuel-prod',
      '--tag', `candidat-individuel-v1-${current.sha.slice(0, 12)}`,
      '--output', path.join(current.workspace, 'governance.json'),
    ], { FINAL_SOURCE_SHA: current.sha, PATH: `${current.bin}:${process.env.PATH}` });
    expect(result.status).not.toBe(0);
  });
});
