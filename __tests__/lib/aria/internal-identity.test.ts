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
});
