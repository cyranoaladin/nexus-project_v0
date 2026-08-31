import {
  DEVELOPMENT_RELEASE_SHA,
  canonicalReleaseSha,
  deriveBuildReleaseFingerprints,
} from './release-fingerprint-core.js';

export { DEVELOPMENT_RELEASE_SHA, canonicalReleaseSha, deriveBuildReleaseFingerprints };

function runtimeReleaseSha(value: unknown): string | null {
  if (value === undefined && process.env.NODE_ENV !== 'production') return DEVELOPMENT_RELEASE_SHA;
  return canonicalReleaseSha(value);
}

export const SERVER_RELEASE_SHA = runtimeReleaseSha(process.env.SERVER_RELEASE_SHA);
export const CLIENT_RELEASE_SHA = runtimeReleaseSha(process.env.CLIENT_RELEASE_SHA);

export function getServerReleaseSha(): string | null {
  return runtimeReleaseSha(process.env.SERVER_RELEASE_SHA);
}
