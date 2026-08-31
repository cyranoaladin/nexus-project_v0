import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(__dirname, '../../..');
const BUILD = path.join(ROOT, 'scripts/release/build-qualified-release.mjs');
const CREATE = path.join(ROOT, 'scripts/release/create-qualification-attestation.mjs');
const PACKAGE = path.join(ROOT, 'scripts/release/package-qualified-release.mjs');
const GOVERNANCE = path.join(ROOT, 'scripts/release/verify-release-governance.mjs');
const CORE_URL = pathToFileURL(path.join(ROOT, 'scripts/release/qualified-release-core.mjs')).href;
const REAL_GIT = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
const RELEASE_BRANCH_REF = 'refs/heads/release/candidat-individuel-prod-final';

type FormalBranchRulesetFixture = {
  id: number;
  name: string;
  target: string;
  enforcement: string;
  bypass_actors: Array<Record<string, unknown>>;
  current_user_can_bypass: string;
  conditions: { ref_name: { include: string[]; exclude?: string[] } };
  rules: Array<{
    type: string;
    parameters?: {
      strict_required_status_checks_policy: boolean;
      required_status_checks: Array<{ context: string }>;
    };
  }>;
};

function formalBranchRuleset(): FormalBranchRulesetFixture {
  return {
    id: 88,
    name: 'immutable candidate release branch',
    target: 'branch',
    enforcement: 'active',
    bypass_actors: [],
    current_user_can_bypass: 'never',
    conditions: { ref_name: { include: [RELEASE_BRANCH_REF], exclude: [] } },
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      { type: 'required_linear_history' },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: [
            { context: 'CI Success' },
            { context: 'Hermetic DB Order Matrix' },
          ],
        },
      },
    ],
  };
}

function git(cwd: string, ...args: string[]) {
  return execFileSync(REAL_GIT, args, { cwd, encoding: 'utf8' }).trim();
}

function run(script: string, args: string[], cwd: string, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 30_000,
  });
}

function initSource(workspace: string) {
  const source = path.join(workspace, 'source');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'tracked.txt'), 'source\n');
  fs.writeFileSync(path.join(source, '.gitignore'), '.next/\n');
  git(source, 'init');
  git(source, 'config', 'user.email', 'release@example.test');
  git(source, 'config', 'user.name', 'Release');
  git(source, 'add', '.');
  git(source, 'commit', '-m', 'source');
  return { source, sha: git(source, 'rev-parse', 'HEAD') };
}

function writeFakeNpm(bin: string, sha: string) {
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh
set -eu
test "$*" = "run build"
count_file="$FAKE_BUILD_COUNT"
count=0
test ! -f "$count_file" || count=$(cat "$count_file")
count=$((count + 1))
printf '%s' "$count" > "$count_file"
mkdir -p .next/standalone/.next/static/chunks .next/static/chunks .next/standalone/public
printf '%s\n' 'governed-build-id-001' > .next/BUILD_ID
cp .next/BUILD_ID .next/standalone/.next/BUILD_ID
printf '%s\n' 'SERVER_RELEASE_SHA=${sha}' > .next/standalone/server.js
printf '%s\n' 'CLIENT_RELEASE_SHA=${sha}' > .next/static/chunks/client.js
test "\${FAKE_NO_CLIENT:-0}" = 1 || cp .next/static/chunks/client.js .next/standalone/.next/static/chunks/client.js
printf '%s\n' public > .next/standalone/public/index.txt
`, { mode: 0o755 });
}

function buildFixture() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-release-hardening-'));
  const { source, sha } = initSource(workspace);
  const bin = path.join(workspace, 'bin');
  const count = path.join(workspace, 'build-count');
  const payload = path.join(workspace, 'staging', 'payload');
  const receipt = path.join(workspace, 'staging', 'build-receipt.json');
  const evidence = path.join(workspace, 'staging', 'build-input.json');
  const metadata = path.join(workspace, 'build-metadata.json');
  writeFakeNpm(bin, sha);
  fs.writeFileSync(metadata, JSON.stringify({
    schemaVersion: 'nexus-release-build-metadata/v1',
    versions: {
      node: 'v22.23.1', npm: '10.9.8', next: '15.5.18', prisma: '6.19.2', postgres: '15.14',
      browsers: { bundledChromium: '145.0.7632.6', googleChrome: '152.0.7977.64' },
    },
    migrations: { before: 88, applied: 0, after: 88 },
  }));
  const args = [
    '--source-root', source, '--payload', payload, '--receipt', receipt,
    '--metadata', metadata, '--evidence-output', evidence,
  ];
  const env = {
    FINAL_SOURCE_SHA: sha,
    NEXUS_RELEASE_SOURCE_SHA: sha,
    PATH: `${bin}:${process.env.PATH}`,
    FAKE_BUILD_COUNT: count,
  };
  return { workspace, source, sha, bin, count, payload, receipt, evidence, metadata, args, env };
}

function createTar(workspace: string, pythonBody: string) {
  const artifact = path.join(workspace, 'attack.tar');
  execFileSync('python3', ['-c', `import io, tarfile\np=${JSON.stringify(artifact)}\nwith tarfile.open(p, 'w') as t:\n${pythonBody}`]);
  return artifact;
}

function inspectArchive(artifact: string, payload: string) {
  const code = `import {verifyPackagedArtifactMatchesPayload as v} from ${JSON.stringify(CORE_URL)}; try { v(${JSON.stringify(artifact)}, ${JSON.stringify(payload)}); console.log('PASS') } catch(e) { console.error(e.message); process.exit(1) }`;
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 30_000 });
}

function writeGovernanceFakes(
  workspace: string,
  sha: string,
  appSlug = 'github-actions',
  remoteUrl = 'git@github.com:nexus-reussite/nexus-project.git',
  jobIds: readonly [number, number] = [1, 2],
  overrides: {
    rulesetExclude?: string[];
    workflowRuns?: Array<Record<string, unknown>>;
    checkRuns?: Array<Record<string, unknown>>;
    classicProtectionDisabled?: boolean;
    classicProtectionError?: string;
    branchRuleset?: Record<string, unknown> | null;
  } = {},
) {
  const bin = path.join(workspace, 'governance-bin');
  fs.mkdirSync(bin);
  const workflowRuns = overrides.workflowRuns ?? [{
    id: 9001, run_number: 42, head_sha: sha, conclusion: 'success', status: 'completed',
    path: '.github/workflows/candidat-individuel-release.yml',
    html_url: 'https://github.com/nexus-reussite/nexus-project/actions/runs/9001',
  }];
  const checkRuns = overrides.checkRuns ?? [
    { id: 1, name: 'CI Success', head_sha: sha, conclusion: 'success', details_url: `https://github.com/nexus-reussite/nexus-project/actions/runs/9001/job/${jobIds[0]}`, app: { slug: appSlug, owner: { login: 'github' } } },
    { id: 2, name: 'Hermetic DB Order Matrix', head_sha: sha, conclusion: 'success', details_url: `https://github.com/nexus-reussite/nexus-project/actions/runs/9001/job/${jobIds[1]}`, app: { slug: appSlug, owner: { login: 'github' } } },
  ];
  const branchRuleset = Object.prototype.hasOwnProperty.call(overrides, 'branchRuleset')
    ? overrides.branchRuleset
    : formalBranchRuleset();
  const rulesetSummaries = [{ id: 77 }, ...(branchRuleset ? [{ id: 88 }] : [])];
  const classicProtection = overrides.classicProtectionDisabled
    ? `printf '%s\\n' '${overrides.classicProtectionError ?? 'gh: Branch protection has been disabled (HTTP 404)'}' >&2; exit 1`
    : "printf '%s' '{\"enforce_admins\":{\"enabled\":true},\"allow_force_pushes\":{\"enabled\":false},\"allow_deletions\":{\"enabled\":false}}'";
  fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh
case "$1 $2" in
  "remote get-url") printf '%s\n' '${remoteUrl}';;
  "ls-remote --heads") printf '%s\t%s\n' '${sha}' 'refs/heads/release/candidat-individuel-prod-final';;
  "ls-remote --tags") printf '%s\t%s\n%s\t%s\n' 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' 'refs/tags/candidat-individuel-v1-${sha.slice(0, 12)}' '${sha}' 'refs/tags/candidat-individuel-v1-${sha.slice(0, 12)}^{}';;
  *) exec ${REAL_GIT} "$@";;
esac
`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh
case "$*" in
  *branches*protection*) ${classicProtection};;
  *actions/workflows/candidat-individuel-release.yml/runs*) printf '%s' '${JSON.stringify([{ workflow_runs: [] }, { workflow_runs: workflowRuns }])}';;
  *commits*check-runs*) printf '%s' '${JSON.stringify([{ check_runs: [] }, { check_runs: checkRuns }])}';;
  *rulesets/77*) printf '%s' '${JSON.stringify({ id: 77, name: 'immutable candidate tags', target: 'tag', enforcement: 'active', bypass_actors: [], conditions: { ref_name: { include: ['refs/tags/candidat-individuel-v1-*'], exclude: overrides.rulesetExclude ?? [] } }, rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }] })}';;
  *rulesets/88*) ${branchRuleset ? `printf '%s' '${JSON.stringify(branchRuleset)}'` : 'exit 1'};;
  *rulesets*) printf '%s' '${JSON.stringify(rulesetSummaries)}';;
  *) exit 1;;
esac
`, { mode: 0o755 });
  return bin;
}

describe('qualified release hardening', () => {
  const workspaces: string[] = [];
  afterEach(() => workspaces.splice(0).forEach((entry) => fs.rmSync(entry, { recursive: true, force: true })));

  it('builds exactly once and binds the governed staging payload to the real build', () => {
    const fixture = buildFixture(); workspaces.push(fixture.workspace);
    const result = run(BUILD, fixture.args, fixture.source, fixture.env);
    expect(result.status).toBe(0);
    expect(fs.readFileSync(fixture.count, 'utf8')).toBe('1');
    const receipt = JSON.parse(fs.readFileSync(fixture.receipt, 'utf8'));
    expect(receipt).toMatchObject({ finalSourceSha: fixture.sha, finalBuildId: 'governed-build-id-001' });
    expect(receipt).toMatchObject({
      sourceIdentity: '.', standaloneIdentity: '.next/standalone', payloadIdentity: 'qualified-payload',
    });
    expect(JSON.parse(fs.readFileSync(path.join(fixture.payload, 'release-build-provenance.json'), 'utf8'))).toMatchObject({
      finalSourceSha: fixture.sha,
      finalBuildId: 'governed-build-id-001',
      buildCount: 1,
    });
  });

  it('fails closed before build for mismatched environment SHA and after build for a missing client fingerprint', () => {
    for (const mode of ['sha', 'client'] as const) {
      const fixture = buildFixture(); workspaces.push(fixture.workspace);
      const env: Record<string, string> = { ...fixture.env };
      if (mode === 'sha') env.NEXUS_RELEASE_SOURCE_SHA = 'a'.repeat(40);
      else env.FAKE_NO_CLIENT = '1';
      const result = run(BUILD, fixture.args, fixture.source, env);
      expect(result.status).not.toBe(0);
      expect(fs.existsSync(fixture.receipt)).toBe(false);
      expect(fs.existsSync(fixture.evidence)).toBe(false);
      expect(fs.existsSync(fixture.count)).toBe(mode === 'client');
    }
  });

  it('rejects an arbitrary copied payload and build evidence changed after the governed build', () => {
    for (const mode of ['payload', 'evidence'] as const) {
      const fixture = buildFixture(); workspaces.push(fixture.workspace);
      expect(run(BUILD, fixture.args, fixture.source, fixture.env).status).toBe(0);
      let payload = fixture.payload;
      if (mode === 'payload') {
        payload = path.join(fixture.workspace, 'fabricated-payload');
        fs.cpSync(fixture.payload, payload, { recursive: true, verbatimSymlinks: true });
        fs.writeFileSync(path.join(payload, 'fabricated.txt'), 'not from the governed build');
      } else {
        fs.appendFileSync(fixture.evidence, '\n');
      }
      const result = run(CREATE, [
        'manifest', '--source-root', fixture.source, '--payload', payload,
        '--build-receipt', fixture.receipt, '--evidence', fixture.evidence,
        '--output', path.join(payload, 'release-qualification-manifest.json'),
      ], fixture.source, { FINAL_SOURCE_SHA: fixture.sha });
      expect(result.status).not.toBe(0);
    }
  });

  it('packages the same governed payload byte-identically twice', () => {
    const fixture = buildFixture(); workspaces.push(fixture.workspace);
    expect(run(BUILD, fixture.args, fixture.source, fixture.env).status).toBe(0);
    const one = path.join(fixture.workspace, 'one.tar');
    const two = path.join(fixture.workspace, 'two.tar');
    const packageEnv = { FINAL_SOURCE_SHA: fixture.sha };
    const packageArgs = ['--source-root', fixture.source, '--payload', fixture.payload, '--build-receipt', fixture.receipt];
    expect(run(PACKAGE, [...packageArgs, '--output', one], fixture.source, packageEnv).status).toBe(0);
    expect(run(PACKAGE, [...packageArgs, '--output', two], fixture.source, packageEnv).status).toBe(0);
    expect(createHash('sha256').update(fs.readFileSync(one)).digest('hex'))
      .toBe(createHash('sha256').update(fs.readFileSync(two)).digest('hex'));
  });

  it.each([
    ['absolute path', ` i=tarfile.TarInfo('/absolute'); t.addfile(i)`, 'ARTIFACT_ARCHIVE_PATH_INVALID'],
    ['traversal path', ` i=tarfile.TarInfo('../outside'); t.addfile(i)`, 'ARTIFACT_ARCHIVE_PATH_INVALID'],
    ['unsafe symlink', ` i=tarfile.TarInfo('link'); i.type=tarfile.SYMTYPE; i.linkname='../../outside'; t.addfile(i)`, 'ARTIFACT_ARCHIVE_LINK_TARGET_INVALID'],
    ['unsafe hardlink', ` i=tarfile.TarInfo('hard'); i.type=tarfile.LNKTYPE; i.linkname='../outside'; t.addfile(i)`, 'ARTIFACT_ARCHIVE_LINK_TARGET_INVALID'],
    ['fifo', ` i=tarfile.TarInfo('pipe'); i.type=tarfile.FIFOTYPE; t.addfile(i)`, 'ARTIFACT_ARCHIVE_ENTRY_TYPE_INVALID'],
    ['unknown type', ` i=tarfile.TarInfo('odd'); i.type=b'Z'; t.addfile(i)`, 'ARTIFACT_ARCHIVE_ENTRY_TYPE_INVALID'],
    ['oversized declaration', ` i=tarfile.TarInfo('huge'); i.size=5*1024*1024*1024; t.fileobj.write(i.tobuf()); t.fileobj.write(b'\\0'*1024)`, 'ARTIFACT_ARCHIVE_SIZE_LIMIT'],
    ['non-canonical PAX mtime', ` i=tarfile.TarInfo('file'); i.pax_headers={'mtime':'1'}; t.addfile(i)`, 'ARTIFACT_ARCHIVE_METADATA_INVALID'],
  ])('rejects archive headers before extraction: %s', (_label, body, expected) => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-tar-attack-')); workspaces.push(workspace);
    const payload = path.join(workspace, 'payload'); fs.mkdirSync(payload);
    const artifact = createTar(workspace, body);
    const result = inspectArchive(artifact, payload);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(expected);
  });

  it('rejects an archive whose member count exceeds the fixed bound', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-tar-count-')); workspaces.push(workspace);
    const payload = path.join(workspace, 'payload'); fs.mkdirSync(payload);
    const artifact = createTar(workspace, `
 for n in range(50001):
  i=tarfile.TarInfo(f'f{n:05d}')
  t.fileobj.write(i.tobuf())`);
    const result = inspectArchive(artifact, payload);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('ARTIFACT_ARCHIVE_MEMBER_LIMIT');
  }, 30_000);

  it('derives repository identity, paginates checks, and records strict protection and tag ruleset', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-governance-')); workspaces.push(workspace);
    const { source, sha } = initSource(workspace);
    const bin = writeGovernanceFakes(workspace, sha);
    const output = path.join(workspace, 'governance.json');
    const result = run(GOVERNANCE, [
      '--source-root', source, '--remote', 'origin', '--branch', 'release/candidat-individuel-prod-final',
      '--tag', `candidat-individuel-v1-${sha.slice(0, 12)}`, '--output', output,
    ], source, { FINAL_SOURCE_SHA: sha, PATH: `${bin}:${process.env.PATH}` });
    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toMatchObject({
      remote: { name: 'origin', url: 'git@github.com:nexus-reussite/nexus-project.git', repository: 'nexus-reussite/nexus-project' },
      branchProtection: {
        mechanism: 'CLASSIC_BRANCH_PROTECTION', rulesetId: null,
        effectiveCoverage: { include: [RELEASE_BRANCH_REF], exclude: [], exactBranchCovered: true },
        enforceAdmins: true, allowForcePushes: false, allowDeletions: false,
      },
      tagRuleset: {
        id: 77, enforcement: 'active', bypassActors: 0,
        include: ['refs/tags/candidat-individuel-v1-*'], exclude: [], exactTagCovered: true,
      },
      ci: { workflow: '.github/workflows/candidat-individuel-release.yml', runId: 9001 },
    });
  });

  it('accepts the exact formal-equivalent branch ruleset when classic protection is disabled', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-governance-')); workspaces.push(workspace);
    const { source, sha } = initSource(workspace);
    const bin = writeGovernanceFakes(workspace, sha, 'github-actions', 'git@github.com:nexus-reussite/nexus-project.git', [1, 2], {
      classicProtectionDisabled: true,
    });
    const output = path.join(workspace, 'governance.json');
    const result = run(GOVERNANCE, [
      '--source-root', source, '--remote', 'origin', '--branch', 'release/candidat-individuel-prod-final',
      '--tag', `candidat-individuel-v1-${sha.slice(0, 12)}`, '--output', output,
    ], source, { FINAL_SOURCE_SHA: sha, PATH: `${bin}:${process.env.PATH}` });

    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(output, 'utf8')).branchProtection).toEqual({
      mechanism: 'FORMAL_EQUIVALENT_BRANCH_RULESET',
      rulesetId: 88,
      effectiveCoverage: { include: [RELEASE_BRANCH_REF], exclude: [], exactBranchCovered: true },
      bypassActors: 0,
      currentUserCanBypass: 'never',
      deletionProtected: true,
      nonFastForwardProtected: true,
      requiredLinearHistory: true,
      strictRequiredStatusChecks: true,
      requiredStatusChecks: ['CI Success', 'Hermetic DB Order Matrix'],
    });
  });

  it.each([
    ['missing ruleset', null],
    ['missing exclusion list', (() => { const value = formalBranchRuleset(); delete (value.conditions.ref_name as { exclude?: string[] }).exclude; return value; })()],
    ['extra exclusion', (() => { const value = formalBranchRuleset(); value.conditions.ref_name.exclude = ['refs/heads/release/unsafe']; return value; })()],
    ['extra included branch', (() => { const value = formalBranchRuleset(); value.conditions.ref_name.include.push('refs/heads/main'); return value; })()],
    ['bypass actor', (() => { const value = formalBranchRuleset(); value.bypass_actors = [{ actor_id: 1 }]; return value; })()],
    ['current-user bypass', (() => { const value = formalBranchRuleset(); value.current_user_can_bypass = 'always'; return value; })()],
    ['non-strict checks', (() => { const value = formalBranchRuleset(); const rule = value.rules.find((entry) => entry.type === 'required_status_checks')!; rule.parameters!.strict_required_status_checks_policy = false; return value; })()],
    ['missing required check', (() => { const value = formalBranchRuleset(); const rule = value.rules.find((entry) => entry.type === 'required_status_checks')!; rule.parameters!.required_status_checks.pop(); return value; })()],
    ['extra required check', (() => { const value = formalBranchRuleset(); const rule = value.rules.find((entry) => entry.type === 'required_status_checks')!; rule.parameters!.required_status_checks.push({ context: 'Unapproved Check' }); return value; })()],
    ['missing deletion rule', (() => { const value = formalBranchRuleset(); value.rules = value.rules.filter((entry) => entry.type !== 'deletion'); return value; })()],
    ['missing non-fast-forward rule', (() => { const value = formalBranchRuleset(); value.rules = value.rules.filter((entry) => entry.type !== 'non_fast_forward'); return value; })()],
    ['missing linear-history rule', (() => { const value = formalBranchRuleset(); value.rules = value.rules.filter((entry) => entry.type !== 'required_linear_history'); return value; })()],
  ])('rejects a weak formal-equivalent branch ruleset: %s', (_label, branchRuleset) => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-governance-')); workspaces.push(workspace);
    const { source, sha } = initSource(workspace);
    const bin = writeGovernanceFakes(workspace, sha, 'github-actions', 'git@github.com:nexus-reussite/nexus-project.git', [1, 2], {
      classicProtectionDisabled: true,
      branchRuleset,
    });
    const result = run(GOVERNANCE, [
      '--source-root', source, '--remote', 'origin', '--branch', 'release/candidat-individuel-prod-final',
      '--tag', `candidat-individuel-v1-${sha.slice(0, 12)}`, '--output', path.join(workspace, 'governance.json'),
    ], source, { FINAL_SOURCE_SHA: sha, PATH: `${bin}:${process.env.PATH}` });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('BRANCH_RULESET_UNVERIFIED');
  });

  it('does not treat a different classic-protection API failure as the formal-equivalent fallback', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-governance-')); workspaces.push(workspace);
    const { source, sha } = initSource(workspace);
    const bin = writeGovernanceFakes(workspace, sha, 'github-actions', 'git@github.com:nexus-reussite/nexus-project.git', [1, 2], {
      classicProtectionDisabled: true,
      classicProtectionError: 'gh: Not Found (HTTP 404)',
    });
    const result = run(GOVERNANCE, [
      '--source-root', source, '--remote', 'origin', '--branch', 'release/candidat-individuel-prod-final',
      '--tag', `candidat-individuel-v1-${sha.slice(0, 12)}`, '--output', path.join(workspace, 'governance.json'),
    ], source, { FINAL_SOURCE_SHA: sha, PATH: `${bin}:${process.env.PATH}` });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('REMOTE_GOVERNANCE_QUERY_FAILED');
  });

  it('rejects homonymous checks not owned by the trusted GitHub Actions app', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-governance-')); workspaces.push(workspace);
    const { source, sha } = initSource(workspace);
    const bin = writeGovernanceFakes(workspace, sha, 'evil-ci');
    const result = run(GOVERNANCE, [
      '--source-root', source, '--remote', 'origin', '--branch', 'release/candidat-individuel-prod-final',
      '--tag', `candidat-individuel-v1-${sha.slice(0, 12)}`, '--output', path.join(workspace, 'governance.json'),
    ], source, { FINAL_SOURCE_SHA: sha, PATH: `${bin}:${process.env.PATH}` });
    expect(result.status).not.toBe(0);
  });

  it('rejects a tag ruleset with any exclusion instead of claiming effective coverage', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-governance-')); workspaces.push(workspace);
    const { source, sha } = initSource(workspace);
    const tag = `candidat-individuel-v1-${sha.slice(0, 12)}`;
    const bin = writeGovernanceFakes(workspace, sha, 'github-actions', 'git@github.com:nexus-reussite/nexus-project.git', [1, 2], {
      rulesetExclude: [`refs/tags/${tag}`],
    });
    const result = run(GOVERNANCE, [
      '--source-root', source, '--remote', 'origin', '--branch', 'release/candidat-individuel-prod-final',
      '--tag', tag, '--output', path.join(workspace, 'governance.json'),
    ], source, { FINAL_SOURCE_SHA: sha, PATH: `${bin}:${process.env.PATH}` });
    expect(result.status).not.toBe(0);
  });

  it('rejects the newest exact workflow run when it failed even if an older run passed', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-governance-')); workspaces.push(workspace);
    const { source, sha } = initSource(workspace);
    const base = { head_sha: sha, status: 'completed', path: '.github/workflows/candidat-individuel-release.yml' };
    const bin = writeGovernanceFakes(workspace, sha, 'github-actions', 'git@github.com:nexus-reussite/nexus-project.git', [1, 2], {
      workflowRuns: [
        { ...base, id: 9001, run_number: 42, conclusion: 'success', html_url: 'https://github.com/nexus-reussite/nexus-project/actions/runs/9001' },
        { ...base, id: 9002, run_number: 43, conclusion: 'failure', html_url: 'https://github.com/nexus-reussite/nexus-project/actions/runs/9002' },
      ],
    });
    const result = run(GOVERNANCE, [
      '--source-root', source, '--remote', 'origin', '--branch', 'release/candidat-individuel-prod-final',
      '--tag', `candidat-individuel-v1-${sha.slice(0, 12)}`, '--output', path.join(workspace, 'governance.json'),
    ], source, { FINAL_SOURCE_SHA: sha, PATH: `${bin}:${process.env.PATH}` });
    expect(result.status).not.toBe(0);
  });

  it('rejects the newest required check when it failed even if an older check passed', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-governance-')); workspaces.push(workspace);
    const { source, sha } = initSource(workspace);
    const app = { slug: 'github-actions', owner: { login: 'github' } };
    const details = (job: number) => `https://github.com/nexus-reussite/nexus-project/actions/runs/9001/job/${job}`;
    const bin = writeGovernanceFakes(workspace, sha, 'github-actions', 'git@github.com:nexus-reussite/nexus-project.git', [1, 2], {
      checkRuns: [
        { id: 1, name: 'CI Success', head_sha: sha, conclusion: 'success', details_url: details(1), app },
        { id: 2, name: 'Hermetic DB Order Matrix', head_sha: sha, conclusion: 'success', details_url: details(2), app },
        { id: 101, name: 'CI Success', head_sha: sha, conclusion: 'failure', details_url: details(101), app },
        { id: 102, name: 'Hermetic DB Order Matrix', head_sha: sha, conclusion: 'failure', details_url: details(102), app },
      ],
    });
    const result = run(GOVERNANCE, [
      '--source-root', source, '--remote', 'origin', '--branch', 'release/candidat-individuel-prod-final',
      '--tag', `candidat-individuel-v1-${sha.slice(0, 12)}`, '--output', path.join(workspace, 'governance.json'),
    ], source, { FINAL_SOURCE_SHA: sha, PATH: `${bin}:${process.env.PATH}` });
    expect(result.status).not.toBe(0);
  });

  it('accepts trusted check details tied to the governed run without conflating check and job IDs', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-governance-')); workspaces.push(workspace);
    const { source, sha } = initSource(workspace);
    const bin = writeGovernanceFakes(workspace, sha, 'github-actions', 'git@github.com:nexus-reussite/nexus-project.git', [701, 702]);
    const output = path.join(workspace, 'governance.json');
    const result = run(GOVERNANCE, [
      '--source-root', source, '--remote', 'origin', '--branch', 'release/candidat-individuel-prod-final',
      '--tag', `candidat-individuel-v1-${sha.slice(0, 12)}`, '--output', output,
    ], source, { FINAL_SOURCE_SHA: sha, PATH: `${bin}:${process.env.PATH}` });
    expect(result.status).toBe(0);
    const evidence = JSON.parse(fs.readFileSync(output, 'utf8'));
    expect(evidence.ci.contexts.map((context: { detailsUrl: string }) => context.detailsUrl)).toEqual([
      'https://github.com/nexus-reussite/nexus-project/actions/runs/9001/job/701',
      'https://github.com/nexus-reussite/nexus-project/actions/runs/9001/job/702',
    ]);
    const validate = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import fs from 'node:fs';
      import { validateGovernanceEvidence } from ${JSON.stringify(CORE_URL)};
      validateGovernanceEvidence(JSON.parse(fs.readFileSync(${JSON.stringify(output)}, 'utf8')), ${JSON.stringify(sha)});
    `], { encoding: 'utf8' });
    expect(validate.status).toBe(0);
  });

  it('rejects a non-canonical or credential-bearing GitHub remote identity', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-governance-')); workspaces.push(workspace);
    const { source, sha } = initSource(workspace);
    const bin = writeGovernanceFakes(workspace, sha, 'github-actions', 'https://token@github.com/nexus-reussite/nexus-project.git');
    const result = run(GOVERNANCE, [
      '--source-root', source, '--remote', 'origin', '--branch', 'release/candidat-individuel-prod-final',
      '--tag', `candidat-individuel-v1-${sha.slice(0, 12)}`, '--output', path.join(workspace, 'governance.json'),
    ], source, { FINAL_SOURCE_SHA: sha, PATH: `${bin}:${process.env.PATH}` });
    expect(result.status).not.toBe(0);
  });

  it('rejects unknown and duplicate CLI arguments instead of accepting caller overrides', () => {
    const fixture = buildFixture(); workspaces.push(fixture.workspace);
    expect(run(BUILD, [...fixture.args, '--unknown', 'value'], fixture.source, fixture.env).status).not.toBe(0);
    expect(run(BUILD, [...fixture.args, '--payload', fixture.payload], fixture.source, fixture.env).status).not.toBe(0);
    expect(run(PACKAGE, [
      '--source-root', fixture.source, '--payload', fixture.payload, '--build-receipt', fixture.receipt,
      '--output', path.join(fixture.workspace, 'artifact.tar'), '--output', path.join(fixture.workspace, 'other.tar'),
    ], fixture.source, { FINAL_SOURCE_SHA: fixture.sha }).status).not.toBe(0);
    const governanceBin = writeGovernanceFakes(fixture.workspace, fixture.sha);
    expect(run(GOVERNANCE, [
      '--source-root', fixture.source, '--remote', 'origin', '--repository', 'attacker/repo',
      '--branch', 'release/candidat-individuel-prod-final', '--tag', `candidat-individuel-v1-${fixture.sha.slice(0, 12)}`,
      '--output', path.join(fixture.workspace, 'governance.json'),
    ], fixture.source, { FINAL_SOURCE_SHA: fixture.sha, PATH: `${governanceBin}:${process.env.PATH}` }).status).not.toBe(0);
    expect(fs.existsSync(fixture.count)).toBe(false);
  });
});
