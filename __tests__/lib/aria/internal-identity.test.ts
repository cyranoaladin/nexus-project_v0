import { createHash } from 'node:crypto';
import fixture from '@/data/aria/generated/rag-contracts/v1/fixtures/internal-identity-envelope-v1.json';
import {
  canonicalAriaRagJson,
  createAriaRagInternalIdentityToken,
  loadAriaRagIdentitySignerConfig,
  sha256AriaRagJson,
} from '@/lib/aria/infrastructure/rag/internal-identity';

describe('ARIA manifest-bound internal RAG identity', () => {
  it('reproduces the shared Python/Node canonical request digest and JWT exactly', () => {
    const signingKey = createHash('sha256')
      .update(fixture.publicTestKeyDerivation, 'utf8')
      .digest('hex');

    expect(sha256AriaRagJson(fixture.request)).toBe(fixture.requestSha256);
    expect(Buffer.from(canonicalAriaRagJson(fixture.envelope)).toString('base64'))
      .toBe(fixture.canonicalEnvelopeBase64);
    expect(createAriaRagInternalIdentityToken({
      envelope: fixture.envelope,
      signingKey,
    })).toBe(fixture.jwt);
  });

  it('rejects missing, short, or ambiguous signer configuration', () => {
    const base = {
      NEXUS_INTERNAL_TOKEN_ISSUER: 'nexus-cockpit',
      NEXUS_INTERNAL_TOKEN_AUDIENCE: 'nexus-rag-engine',
      NEXUS_SSO_ISSUER: 'nexus-cockpit',
      NEXUS_SSO_AUDIENCE: 'nexus-rag-engine',
    };

    expect(() => loadAriaRagIdentitySignerConfig(base)).toThrow('ARIA_RAG_IDENTITY_CONFIGURATION_INVALID');
    expect(() => loadAriaRagIdentitySignerConfig({
      ...base,
      NEXUS_INTERNAL_TOKEN_SECRET: 'short',
    })).toThrow('ARIA_RAG_IDENTITY_CONFIGURATION_INVALID');
    expect(() => loadAriaRagIdentitySignerConfig({
      ...base,
      NEXUS_INTERNAL_TOKEN_SECRET: 'x'.repeat(32),
      NEXUS_SSO_AUDIENCE: 'one,two',
    })).toThrow('ARIA_RAG_IDENTITY_CONFIGURATION_INVALID');

    for (const key of [
      'NEXUS_INTERNAL_TOKEN_ISSUER',
      'NEXUS_INTERNAL_TOKEN_AUDIENCE',
      'NEXUS_SSO_ISSUER',
      'NEXUS_SSO_AUDIENCE',
    ] as const) {
      expect(() => loadAriaRagIdentitySignerConfig({
        ...base,
        NEXUS_INTERNAL_TOKEN_SECRET: 'x'.repeat(32),
        [key]: undefined,
      })).toThrow('ARIA_RAG_IDENTITY_CONFIGURATION_INVALID');
    }
  });

  it('fails closed when default process configuration is incomplete', () => {
    const originalEnvironment = process.env;
    process.env = { NODE_ENV: 'test' };
    try {
      expect(() => loadAriaRagIdentitySignerConfig())
        .toThrow('ARIA_RAG_IDENTITY_CONFIGURATION_INVALID');
    } finally {
      process.env = originalEnvironment;
    }
  });

  it('rejects an envelope whose transport claims diverge from its nested identity', () => {
    expect(() => createAriaRagInternalIdentityToken({
      envelope: {
        ...fixture.envelope,
        sub: 'psn_different_subject_0001',
      },
      signingKey: createHash('sha256')
        .update(fixture.publicTestKeyDerivation, 'utf8')
        .digest('hex'),
    })).toThrow('ARIA_RAG_IDENTITY_ENVELOPE_INVALID');
  });

  it('rejects an envelope that does not satisfy the shared runtime schema', () => {
    expect(() => createAriaRagInternalIdentityToken({
      envelope: {},
      signingKey: 'x'.repeat(32),
    })).toThrow('ARIA_RAG_IDENTITY_ENVELOPE_INVALID');
  });

  it('rejects manifest-bound replay windows longer than 30 seconds', () => {
    expect(() => createAriaRagInternalIdentityToken({
      envelope: {
        ...fixture.envelope,
        exp: fixture.envelope.iat + 31,
        identity: {
          ...fixture.envelope.identity,
          exp: fixture.envelope.iat + 31,
        },
      },
      signingKey: createHash('sha256')
        .update(fixture.publicTestKeyDerivation, 'utf8')
        .digest('hex'),
    })).toThrow('ARIA_RAG_IDENTITY_ENVELOPE_INVALID');
  });

  it('canonicalizes nested finite JSON and rejects values outside JSON', () => {
    expect(Buffer.from(canonicalAriaRagJson({
      z: [true, null, 3],
      a: { b: 'value' },
    })).toString('utf8')).toBe('{"a":{"b":"value"},"z":[true,null,3]}');
    for (const value of [undefined, Number.POSITIVE_INFINITY, BigInt(1)]) {
      expect(() => canonicalAriaRagJson(value)).toThrow('ARIA_RAG_IDENTITY_ENVELOPE_INVALID');
    }
  });

  it('loads and trims a complete unambiguous signer configuration', () => {
    expect(loadAriaRagIdentitySignerConfig({
      NEXUS_INTERNAL_TOKEN_SECRET: ` ${'x'.repeat(32)} `,
      NEXUS_INTERNAL_TOKEN_ISSUER: ' nexus-cockpit ',
      NEXUS_INTERNAL_TOKEN_AUDIENCE: ' nexus-rag-engine ',
      NEXUS_SSO_ISSUER: ' nexus-sso ',
      NEXUS_SSO_AUDIENCE: ' nexus-rag-engine ',
    })).toEqual({
      signingKey: 'x'.repeat(32),
      issuer: 'nexus-cockpit',
      audience: 'nexus-rag-engine',
      identityIssuer: 'nexus-sso',
      identityAudience: 'nexus-rag-engine',
    });
  });

  it('rejects a signing key shorter than the internal security floor', () => {
    expect(() => createAriaRagInternalIdentityToken({
      envelope: fixture.envelope,
      signingKey: 'short',
    })).toThrow('ARIA_RAG_IDENTITY_CONFIGURATION_INVALID');
  });

  it.each([
    ['JTI_DIVERGENCE', (envelope: typeof fixture.envelope) => ({ ...envelope, jti: `${envelope.jti}-other` })],
    ['IDENTITY_EXPIRY_PRECEDES_TRANSPORT', (envelope: typeof fixture.envelope) => ({
      ...envelope,
      identity: { ...envelope.identity, exp: envelope.exp - 1 },
    })],
    ['ISSUED_AFTER_EXPIRY', (envelope: typeof fixture.envelope) => ({
      ...envelope,
      iat: envelope.exp + 1,
    })],
    ['REQUEST_WITHOUT_MANIFEST', (envelope: typeof fixture.envelope) => ({
      ...envelope,
      manifest_sha256: null,
    })],
    ['MANIFEST_WITHOUT_REQUEST', (envelope: typeof fixture.envelope) => ({
      ...envelope,
      request_sha256: null,
    })],
  ])('rejects internally inconsistent envelope %s', (_name, mutate) => {
    const signingKey = createHash('sha256')
      .update(fixture.publicTestKeyDerivation, 'utf8')
      .digest('hex');
    expect(() => createAriaRagInternalIdentityToken({
      envelope: mutate(fixture.envelope),
      signingKey,
    })).toThrow('ARIA_RAG_IDENTITY_ENVELOPE_INVALID');
  });
});
