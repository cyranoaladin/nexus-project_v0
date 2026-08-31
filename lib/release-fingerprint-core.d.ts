export const CANONICAL_RELEASE_SHA_PATTERN: RegExp;
export const DEVELOPMENT_RELEASE_SHA: string;
export function canonicalReleaseSha(value: unknown): string | null;
export function deriveBuildReleaseFingerprints(
  sourceSha: string | undefined,
  mode: 'production' | 'development' | 'test' | 'e2e',
): { SERVER_RELEASE_SHA: string; CLIENT_RELEASE_SHA: string };
