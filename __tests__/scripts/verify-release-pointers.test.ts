import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');
const guardPath = path.join(repoRoot, 'scripts', 'release', 'verify-release-pointers.sh');

type Fixture = Readonly<{
  root: string;
  releaseRoot: string;
  release: string;
  canonical: string;
  alias: string;
}>;

function createFixture(): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-release-pointers-'));
  const releaseRoot = path.join(root, 'releases');
  const release = path.join(releaseRoot, 'abc123-release');
  const canonical = path.join(root, 'app-current');
  const alias = path.join(releaseRoot, 'current');

  fs.mkdirSync(path.join(release, '.next', 'standalone'), { recursive: true });
  fs.writeFileSync(path.join(release, '.next', 'standalone', 'server.js'), 'server');
  fs.symlinkSync(release, canonical);
  fs.symlinkSync(canonical, alias);

  return { root, releaseRoot, release, canonical, alias };
}

function runGuard(fixture: Fixture, extraArguments: readonly string[] = []) {
  return spawnSync(
    'bash',
    [
      guardPath,
      '--canonical', fixture.canonical,
      '--alias', fixture.alias,
      '--release-root', fixture.releaseRoot,
      ...extraArguments,
    ],
    { encoding: 'utf8' },
  );
}

function runGuardArguments(arguments_: readonly string[]) {
  return spawnSync('bash', [guardPath, ...arguments_], { encoding: 'utf8' });
}

describe('release pointer guard', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  function fixture() {
    const created = createFixture();
    roots.push(created.root);
    return created;
  }

  it('accepts a compatibility alias chained to the canonical pointer', () => {
    const current = fixture();

    const result = runGuard(current, ['--expected-release', current.release]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Release pointer guard passed');
  });

  it('rejects two independently mutable pointers even when they currently resolve together', () => {
    const current = fixture();
    fs.unlinkSync(current.alias);
    fs.symlinkSync(current.release, current.alias);

    const result = runGuard(current);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('ALIAS_NOT_CHAINED');
  });

  it('rejects pointers resolving to different releases', () => {
    const current = fixture();
    const otherRelease = path.join(current.releaseRoot, 'def456-release');
    fs.mkdirSync(path.join(otherRelease, '.next', 'standalone'), { recursive: true });
    fs.writeFileSync(path.join(otherRelease, '.next', 'standalone', 'server.js'), 'server');
    fs.unlinkSync(current.alias);
    fs.symlinkSync(otherRelease, current.alias);

    const result = runGuard(current);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('POINTER_DIVERGENCE');
  });

  it('rejects a dangling canonical pointer', () => {
    const current = fixture();
    fs.unlinkSync(current.canonical);
    fs.symlinkSync(path.join(current.releaseRoot, 'missing'), current.canonical);

    const result = runGuard(current);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('CANONICAL_DANGLING');
  });

  it('rejects a release outside the declared release root', () => {
    const current = fixture();
    const outside = path.join(current.root, 'outside-release');
    fs.mkdirSync(path.join(outside, '.next', 'standalone'), { recursive: true });
    fs.writeFileSync(path.join(outside, '.next', 'standalone', 'server.js'), 'server');
    fs.unlinkSync(current.canonical);
    fs.symlinkSync(outside, current.canonical);

    const result = runGuard(current);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('RELEASE_OUTSIDE_ROOT');
  });

  it('rejects a release missing the standalone entry point', () => {
    const current = fixture();
    fs.unlinkSync(path.join(current.release, '.next', 'standalone', 'server.js'));

    const result = runGuard(current);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('STANDALONE_ENTRYPOINT_MISSING');
  });

  it('rejects a resolved release that differs from the expected release', () => {
    const current = fixture();
    const unexpected = path.join(current.releaseRoot, 'unexpected-release');

    const result = runGuard(current, ['--expected-release', unexpected]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('EXPECTED_RELEASE_MISMATCH');
  });

  it('rejects unknown and incomplete arguments', () => {
    const current = fixture();

    const unknown = runGuard(current, ['--unsupported']);
    const incomplete = runGuard(current, ['--expected-release']);

    expect(unknown.status).not.toBe(0);
    expect(unknown.stderr).toContain('UNKNOWN_ARGUMENT');
    expect(incomplete.status).not.toBe(0);
    expect(incomplete.stderr).toContain('MISSING_ARGUMENT_VALUE');
  });

  it('rejects missing required and relative path arguments', () => {
    const current = fixture();

    const missing = runGuardArguments([
      '--canonical', current.canonical,
      '--alias', current.alias,
    ]);
    const relative = runGuardArguments([
      '--canonical', 'relative/current',
      '--alias', current.alias,
      '--release-root', current.releaseRoot,
    ]);

    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain('REQUIRED_ARGUMENT_MISSING');
    expect(relative.status).not.toBe(0);
    expect(relative.stderr).toContain('PATH_NOT_ABSOLUTE');
  });

  it('rejects a canonical pointer that is not a symlink', () => {
    const current = fixture();
    fs.unlinkSync(current.canonical);
    fs.writeFileSync(current.canonical, current.release);

    const result = runGuard(current);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('CANONICAL_NOT_SYMLINK');
  });

  it('rejects a dangling compatibility alias', () => {
    const current = fixture();
    fs.unlinkSync(current.alias);
    fs.symlinkSync(path.join(current.releaseRoot, 'missing-alias-target'), current.alias);

    const result = runGuard(current);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('ALIAS_DANGLING');
  });

  it('rejects a missing release root', () => {
    const current = fixture();
    const result = runGuardArguments([
      '--canonical', current.canonical,
      '--alias', current.alias,
      '--release-root', path.join(current.root, 'missing-release-root'),
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('RELEASE_ROOT_MISSING');
  });
});
