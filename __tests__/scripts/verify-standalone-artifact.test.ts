import { execSync } from 'child_process';
import { mkdir, writeFile, rm, symlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { readFile } from 'fs/promises';
import { readRunningReleaseSha } from '@/lib/core-v2/diagnostics/release-identity';

const SCRIPT = join(__dirname, '../../scripts/release/verify-standalone-artifact.mjs');

let testDir: string;

async function createValidArtifact(dir: string) {
  await mkdir(join(dir, '.next/static/chunks'), { recursive: true });
  await mkdir(join(dir, '.next/standalone/.next/static/chunks'), { recursive: true });
  await mkdir(join(dir, '.next/standalone/public'), { recursive: true });

  await writeFile(join(dir, '.next/standalone/server.js'), 'module.exports = {}');
  await writeFile(join(dir, '.next/BUILD_ID'), 'test-build-id');
  await writeFile(join(dir, '.next/standalone/.next/BUILD_ID'), 'test-build-id');
  await writeFile(join(dir, '.next/build-manifest.json'), '{}');
  await writeFile(join(dir, '.next/app-build-manifest.json'), '{}');

  // Same chunk in both locations
  const chunkContent = 'console.log("chunk")';
  await writeFile(join(dir, '.next/static/chunks/main-abc123.js'), chunkContent);
  await writeFile(join(dir, '.next/standalone/.next/static/chunks/main-abc123.js'), chunkContent);
  await writeFile(join(dir, '.next/static/chunks/app.css'), 'body{}');
  await writeFile(join(dir, '.next/standalone/.next/static/chunks/app.css'), 'body{}');

  // Package files for version detection
  await mkdir(join(dir, 'scripts/release'), { recursive: true });
  await mkdir(join(dir, 'node_modules/next'), { recursive: true });
  await writeFile(join(dir, 'node_modules/next/package.json'), '{"version":"15.5.18"}');
  await writeFile(join(dir, 'package-lock.json'), '{}');
  await writeFile(join(dir, 'scripts/release/verify-standalone-artifact.mjs'), 'gate');
}

function runGate(dir: string, env: Record<string, string> = {}): { code: number; output: string } {
  try {
    const output = execSync(`node ${SCRIPT} "${dir}"`, {
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, NEXT_PUBLIC_JITSI_SERVER_URL: '', RELEASE_SHA: 'a'.repeat(40), ...env },
    });
    return { code: 0, output };
  } catch (e: any) {
    return { code: e.status || 1, output: (e.stdout || '') + (e.stderr || '') };
  }
}

beforeEach(async () => {
  testDir = join(tmpdir(), `gate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('verify-standalone-artifact', () => {
  test('passes with valid artifact', async () => {
    await createValidArtifact(testDir);
    const { code, output } = runGate(testDir);
    expect(code).toBe(0);
    expect(output).toContain('ARTIFACT VALID');
  });

  test('fails when server.js is absent', async () => {
    await createValidArtifact(testDir);
    await rm(join(testDir, '.next/standalone/server.js'));
    const { code, output } = runGate(testDir);
    expect(code).toBe(1);
    expect(output).toContain('server.js');
  });

  test('fails when source static is absent', async () => {
    await createValidArtifact(testDir);
    await rm(join(testDir, '.next/static'), { recursive: true });
    const { code } = runGate(testDir);
    expect(code).toBe(1);
  });

  test('fails when standalone static is absent', async () => {
    await createValidArtifact(testDir);
    await rm(join(testDir, '.next/standalone/.next/static'), { recursive: true });
    const { code } = runGate(testDir);
    expect(code).toBe(1);
  });

  test('fails when standalone static is empty', async () => {
    await createValidArtifact(testDir);
    await rm(join(testDir, '.next/standalone/.next/static'), { recursive: true });
    await mkdir(join(testDir, '.next/standalone/.next/static/chunks'), { recursive: true });
    const { code, output } = runGate(testDir);
    expect(code).toBe(1);
    expect(output).toContain('No JS chunks');
  });

  test('fails when file count differs', async () => {
    await createValidArtifact(testDir);
    await writeFile(join(testDir, '.next/static/chunks/extra.js'), 'extra');
    const { code, output } = runGate(testDir);
    expect(code).toBe(1);
    expect(output).toContain('count mismatch');
  });

  test('fails when file content differs', async () => {
    await createValidArtifact(testDir);
    await writeFile(join(testDir, '.next/standalone/.next/static/chunks/main-abc123.js'), 'DIFFERENT');
    const { code, output } = runGate(testDir);
    expect(code).toBe(1);
    expect(output).toContain('digest mismatch');
  });

  test('fails when BUILD_ID differs', async () => {
    await createValidArtifact(testDir);
    await writeFile(join(testDir, '.next/standalone/.next/BUILD_ID'), 'wrong-id');
    const { code, output } = runGate(testDir);
    expect(code).toBe(1);
    expect(output).toContain('BUILD_ID mismatch');
  });

  test('fails when public is absent', async () => {
    await createValidArtifact(testDir);
    await rm(join(testDir, '.next/standalone/public'), { recursive: true });
    const { code } = runGate(testDir);
    expect(code).toBe(1);
  });

  test('fails when RELEASE_SHA is not provided and no .git', async () => {
    await createValidArtifact(testDir);
    const { code, output } = runGate(testDir, { RELEASE_SHA: '' });
    expect(code).toBe(1);
    expect(output).toContain('RELEASE_SHA');
  });

  test('fails closed when RELEASE_SHA is malformed', async () => {
    await createValidArtifact(testDir);
    const { code, output } = runGate(testDir, { RELEASE_SHA: 'not-a-commit-sha' });
    expect(code).toBe(1);
    expect(output).toContain('RELEASE_SHA is invalid');
    await expect(readFile(join(testDir, 'release-manifest.json'), 'utf8')).rejects.toThrow();
  });

  test('writes manifest on success', async () => {
    await createValidArtifact(testDir);
    runGate(testDir);
    const manifest = JSON.parse(await readFile(join(testDir, 'release-manifest.json'), 'utf8').catch(() => '{}'));
    const standaloneManifest = JSON.parse(await readFile(join(testDir, '.next/standalone/release-manifest.json'), 'utf8').catch(() => '{}'));
    expect(manifest.RELEASE_SHA).toBe('a'.repeat(40));
    expect(manifest.ARTIFACT_VERIFIED).toBe(true);
    expect(manifest).not.toHaveProperty('VIDEO_MODE'); // Legacy absent-mode release.
    expect(manifest.NEXT_VERSION).toBe('15.5.18');
    expect(manifest.SOURCE_STATIC_TREE_SHA256).toMatch(/^[a-f0-9]{64}$/);
    expect(standaloneManifest).toEqual(manifest);
    await expect(readRunningReleaseSha(join(testDir, '.next/standalone'))).resolves.toBe('a'.repeat(40));
  });

  test('records an explicitly disabled build mode in both manifests', async () => {
    await createValidArtifact(testDir);
    const { code } = runGate(testDir, { NEXT_PUBLIC_VIDEO_MODE: 'DISABLED' });
    expect(code).toBe(0);
    const manifest = JSON.parse(await readFile(join(testDir, 'release-manifest.json'), 'utf8'));
    const standalone = JSON.parse(await readFile(join(testDir, '.next/standalone/release-manifest.json'), 'utf8'));
    expect(manifest.VIDEO_MODE).toBe('DISABLED');
    expect(standalone).toEqual(manifest);
  });

  test('records an explicitly configured JITSI build mode', async () => {
    await createValidArtifact(testDir);
    const { code } = runGate(testDir, {
      NEXT_PUBLIC_VIDEO_MODE: 'JITSI',
      NEXT_PUBLIC_JITSI_SERVER_URL: 'https://video.preview.example.org',
    });
    expect(code).toBe(0);
    const manifest = JSON.parse(await readFile(join(testDir, '.next/standalone/release-manifest.json'), 'utf8'));
    expect(manifest.VIDEO_MODE).toBe('JITSI');
    expect(manifest.JITSI_ORIGIN).toBe('https://video.preview.example.org');
  });

  test('refuses a JITSI artifact without a real configured origin', async () => {
    await createValidArtifact(testDir);
    const { code, output } = runGate(testDir, { NEXT_PUBLIC_VIDEO_MODE: 'JITSI', NEXT_PUBLIC_JITSI_SERVER_URL: '' });
    expect(code).toBe(1);
    expect(output).toContain('JITSI_URL_REQUIRED');
    await expect(readFile(join(testDir, 'release-manifest.json'), 'utf8')).rejects.toThrow();
  });

  test('refuses an unknown build mode before writing a manifest', async () => {
    await createValidArtifact(testDir);
    const { code, output } = runGate(testDir, { NEXT_PUBLIC_VIDEO_MODE: 'UNKNOWN' });
    expect(code).toBe(1);
    expect(output).toContain('VIDEO_MODE_INVALID');
    await expect(readFile(join(testDir, 'release-manifest.json'), 'utf8')).rejects.toThrow();
  });

  test('refuses an explicitly empty build mode', async () => {
    await createValidArtifact(testDir);
    const { code, output } = runGate(testDir, { NEXT_PUBLIC_VIDEO_MODE: '' });
    expect(code).toBe(1);
    expect(output).toContain('VIDEO_MODE_INVALID');
  });
});
