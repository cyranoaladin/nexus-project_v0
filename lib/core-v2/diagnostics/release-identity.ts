import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface ReleaseManifest {
  RELEASE_SHA?: unknown;
  BUILD_ID?: unknown;
  ARTIFACT_VERIFIED?: unknown;
}

/** Reads the build-verified manifest shipped at the immutable runtime root. */
export async function readRunningReleaseSha(runtimeRoot = process.cwd()): Promise<string | null> {
  try {
    const [manifestText, artifactBuildId] = await Promise.all([
      readFile(join(runtimeRoot, 'release-manifest.json'), 'utf8'),
      readFile(join(runtimeRoot, '.next/BUILD_ID'), 'utf8'),
    ]);
    const manifest = JSON.parse(manifestText) as ReleaseManifest;
    if (manifest.ARTIFACT_VERIFIED !== true
      || typeof manifest.BUILD_ID !== 'string'
      || manifest.BUILD_ID.length === 0
      || manifest.BUILD_ID !== artifactBuildId.trim()
      || typeof manifest.RELEASE_SHA !== 'string'
      || !/^[a-f0-9]{40}$/.test(manifest.RELEASE_SHA)) {
      return null;
    }
    return manifest.RELEASE_SHA;
  } catch {
    return null;
  }
}
