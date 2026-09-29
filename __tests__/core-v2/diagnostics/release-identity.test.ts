import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRunningReleaseSha } from '@/lib/core-v2/diagnostics/release-identity';

describe('running release identity', () => {
  let runtimeRoot: string;

  beforeEach(async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'nexus-release-identity-'));
  });

  afterEach(async () => {
    await rm(runtimeRoot, { recursive: true, force: true });
  });

  it('reads the verified build identity from the shipped runtime manifest', async () => {
    const expectedSha = '5'.repeat(40);
    await mkdir(join(runtimeRoot, '.next'), { recursive: true });
    await writeFile(join(runtimeRoot, '.next/BUILD_ID'), 'standalone-build-id');
    await writeFile(join(runtimeRoot, 'release-manifest.json'), JSON.stringify({
      RELEASE_SHA: expectedSha,
      BUILD_ID: 'standalone-build-id',
      ARTIFACT_VERIFIED: true,
    }));

    await expect(readRunningReleaseSha(runtimeRoot)).resolves.toBe(expectedSha);
  });

  it.each([
    ['manifest absent', null],
    ['release SHA malformed', { RELEASE_SHA: 'not-a-sha', BUILD_ID: 'build', ARTIFACT_VERIFIED: true }],
    ['build ID absent', { RELEASE_SHA: '5'.repeat(40), ARTIFACT_VERIFIED: true }],
    ['manifest not verified', { RELEASE_SHA: '5'.repeat(40), BUILD_ID: 'build', ARTIFACT_VERIFIED: false }],
    ['build ID does not match the standalone artifact', { RELEASE_SHA: '5'.repeat(40), BUILD_ID: 'other-build', ARTIFACT_VERIFIED: true }],
  ])('fails closed when %s', async (_caseName, manifest) => {
    if (manifest) {
      await mkdir(join(runtimeRoot, '.next'), { recursive: true });
      await writeFile(join(runtimeRoot, '.next/BUILD_ID'), 'build');
      await writeFile(join(runtimeRoot, 'release-manifest.json'), JSON.stringify(manifest));
    }
    await expect(readRunningReleaseSha(runtimeRoot)).resolves.toBeNull();
  });
});
