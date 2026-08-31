const CANONICAL_RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;
const DEVELOPMENT_RELEASE_SHA = '0000000000000000000000000000000000000000';

function canonicalReleaseSha(value) {
  return typeof value === 'string' && CANONICAL_RELEASE_SHA_PATTERN.test(value) ? value : null;
}

function deriveBuildReleaseFingerprints(sourceSha, mode) {
  const canonical = canonicalReleaseSha(sourceSha);
  if (canonical) {
    return { SERVER_RELEASE_SHA: canonical, CLIENT_RELEASE_SHA: canonical };
  }
  if (sourceSha !== undefined && sourceSha !== '') throw new Error('RELEASE_SOURCE_SHA_INVALID');
  if (mode === 'production') throw new Error('RELEASE_SOURCE_SHA_INVALID');
  return {
    SERVER_RELEASE_SHA: DEVELOPMENT_RELEASE_SHA,
    CLIENT_RELEASE_SHA: DEVELOPMENT_RELEASE_SHA,
  };
}

module.exports = {
  CANONICAL_RELEASE_SHA_PATTERN,
  DEVELOPMENT_RELEASE_SHA,
  canonicalReleaseSha,
  deriveBuildReleaseFingerprints,
};
