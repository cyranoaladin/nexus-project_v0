import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseDedicatedJitsiUrl, parseVideoMode } from './video-mode';

/**
 * A NEXT_PUBLIC_* value is compiled into the client. A process restart cannot
 * change that bundle. The standalone's delivered manifest therefore must
 * agree with the runtime's explicit mode before the service accepts traffic.
 * Legacy standalones without the new mode retain their previous JITSI contract.
 */
export function assertStandaloneVideoMode(
  cwd = process.cwd(),
  env: Readonly<Record<string, string | undefined>> = process.env,
  entrypoint = process.argv[1],
): void {
  // systemd normally sets WorkingDirectory to the release, but `node
  // /release/server.js` can be launched from elsewhere. Anchor the attestation
  // to the executable delivered with the bundle, not the caller's cwd.
  const entryRoot = entrypoint && basename(entrypoint) === 'server.js'
    ? dirname(resolve(entrypoint))
    : null;
  const root = entryRoot ?? cwd;
  if (!existsSync(join(root, 'server.js'))) return;

  // Reflect.get avoids Next's compile-time substitution of direct
  // process.env.NEXT_PUBLIC_* expressions in the runtime-side comparison.
  const runtimeRaw = Reflect.get(env, 'NEXT_PUBLIC_VIDEO_MODE') as string | undefined;
  const manifestPath = join(root, 'release-manifest.json');
  if (!existsSync(manifestPath)) {
    if (runtimeRaw !== undefined) throw new Error('VIDEO_MODE_MANIFEST_MISSING');
    return;
  }

  let manifestMode: unknown;
  let manifestJitsiOrigin: unknown;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    manifestMode = manifest.VIDEO_MODE;
    manifestJitsiOrigin = manifest.JITSI_ORIGIN;
  } catch {
    throw new Error('VIDEO_MODE_MANIFEST_INVALID');
  }

  if (manifestMode === undefined && runtimeRaw === undefined) return;
  if (manifestMode !== 'DISABLED' && manifestMode !== 'JITSI') {
    throw new Error('VIDEO_MODE_MANIFEST_INVALID');
  }
  if (runtimeRaw === undefined || parseVideoMode(runtimeRaw) !== manifestMode) {
    throw new Error('VIDEO_MODE_MANIFEST_MISMATCH');
  }
  if (manifestMode === 'JITSI') {
    if (typeof manifestJitsiOrigin !== 'string' || !manifestJitsiOrigin) {
      throw new Error('JITSI_ORIGIN_MANIFEST_MISSING');
    }
    const runtimeUrl = Reflect.get(env, 'NEXT_PUBLIC_JITSI_SERVER_URL') as string | undefined;
    let runtimeOrigin: string | undefined;
    try {
      runtimeOrigin = runtimeUrl ? parseDedicatedJitsiUrl(runtimeUrl).origin : undefined;
    } catch {
      // A malformed runtime URL cannot attest the origin compiled into the client.
    }
    if (runtimeOrigin !== manifestJitsiOrigin) {
      throw new Error('JITSI_ORIGIN_MANIFEST_MISMATCH');
    }
  } else if (manifestJitsiOrigin !== undefined) {
    throw new Error('JITSI_ORIGIN_MANIFEST_INVALID');
  }
}
