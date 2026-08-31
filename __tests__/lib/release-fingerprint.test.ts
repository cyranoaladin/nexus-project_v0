import {
  DEVELOPMENT_RELEASE_SHA,
  canonicalReleaseSha,
  deriveBuildReleaseFingerprints,
} from '@/lib/release-fingerprint';

const SHA = 'abcdef0123456789abcdef0123456789abcdef01';

describe('release fingerprint', () => {
  it('accepte uniquement une SHA canonique lowercase de 40 caractères', () => {
    expect(canonicalReleaseSha(SHA)).toBe(SHA);
    expect(canonicalReleaseSha(SHA.toUpperCase())).toBeNull();
    expect(canonicalReleaseSha(` ${SHA}`)).toBeNull();
    expect(canonicalReleaseSha('abc')).toBeNull();
    expect(canonicalReleaseSha(undefined)).toBeNull();
  });

  it('dérive les empreintes serveur et client de la même entrée obligatoire', () => {
    expect(deriveBuildReleaseFingerprints(SHA, 'production')).toEqual({
      SERVER_RELEASE_SHA: SHA,
      CLIENT_RELEASE_SHA: SHA,
    });
  });

  it.each([undefined, '', 'invalid', 'A'.repeat(40)])('échoue fermé en production pour %p', (sourceSha) => {
    expect(() => deriveBuildReleaseFingerprints(sourceSha, 'production')).toThrow('RELEASE_SOURCE_SHA_INVALID');
  });

  it('utilise une empreinte explicite et sûre uniquement hors production', () => {
    expect(deriveBuildReleaseFingerprints(undefined, 'development')).toEqual({
      SERVER_RELEASE_SHA: DEVELOPMENT_RELEASE_SHA,
      CLIENT_RELEASE_SHA: DEVELOPMENT_RELEASE_SHA,
    });
  });
});
