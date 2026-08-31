import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const SHA = 'abcdef0123456789abcdef0123456789abcdef01';

function runBuildEnvCheck(sourceSha?: string) {
  const env = { ...process.env };
  delete env.NEXUS_RELEASE_SOURCE_SHA;
  if (sourceSha !== undefined) env.NEXUS_RELEASE_SOURCE_SHA = sourceSha;
  return spawnSync(process.execPath, ['scripts/check-production-build-env.js'], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: 10_000,
  });
}

describe('production release fingerprint build gate', () => {
  it.each([undefined, 'invalid', 'A'.repeat(40)])('refuse une entrée de build absente ou invalide: %p', (sourceSha) => {
    const result = runBuildEnvCheck(sourceSha);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('RELEASE_SOURCE_SHA_INVALID');
  });

  it('accepte une SHA source canonique sans exposer sa valeur', () => {
    const result = runBuildEnvCheck(SHA);
    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).not.toContain(SHA);
  });
});
