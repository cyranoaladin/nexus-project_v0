import fixture from '@/content/bilans/model-policies/openrouter-capability-baseline-v1.1.json';
import {
  assertOpenRouterPreflightProof,
  buildCapabilitySnapshots,
  createApiKeyFingerprint,
  verifyModelPolicyCapabilities,
} from '@/lib/llm/openrouter/capabilities';
import { sha256Canonical } from '@/lib/llm/openrouter/hash';

const API_KEY = 'synthetic-high-entropy-api-key';
const SOFTWARE_SHA = 'a'.repeat(40);
const FETCHED_AT = '2026-07-30T12:00:00.000Z';
const VERIFIED_AT = '2026-07-30T12:00:30.000Z';
const EXPIRES_AT = '2026-07-31T12:00:30.000Z';

function proof() {
  return verifyModelPolicyCapabilities(
    buildCapabilitySnapshots(fixture, { fetchedAt: FETCHED_AT }),
    {
      verifiedAt: VERIFIED_AT,
      expiresAt: EXPIRES_AT,
      apiKey: API_KEY,
      preflightSoftwareSha: SOFTWARE_SHA,
      catalogChecksum: sha256Canonical(fixture),
    },
  );
}

describe('OpenRouter preflight proof integrity', () => {
  it('binds the policy, catalog, API key and exact software SHA', () => {
    const value = proof();

    expect(value).toMatchObject({
      catalogChecksum: sha256Canonical(fixture),
      apiKeyFingerprint: createApiKeyFingerprint(API_KEY),
      preflightSoftwareSha: SOFTWARE_SHA,
      verifiedAt: VERIFIED_AT,
      expiresAt: EXPIRES_AT,
    });
    expect(value.proofChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(() => assertOpenRouterPreflightProof(value, {
      apiKey: API_KEY,
      preflightSoftwareSha: SOFTWARE_SHA,
      currentTime: Date.parse(VERIFIED_AT),
    })).not.toThrow();
  });

  it.each([
    ['proof checksum', (value: ReturnType<typeof proof>) => ({
      ...value,
      proofChecksum: '0'.repeat(64),
    })],
    ['API key', (value: ReturnType<typeof proof>) => value],
    ['software SHA', (value: ReturnType<typeof proof>) => value],
    ['expired proof', (value: ReturnType<typeof proof>) => value],
  ])('rejects a mismatched %s', (label, mutate) => {
    const value = mutate(proof());
    const context = {
      apiKey: label === 'API key' ? 'different-private-key' : API_KEY,
      preflightSoftwareSha:
        label === 'software SHA' ? 'b'.repeat(40) : SOFTWARE_SHA,
      currentTime: label === 'expired proof'
        ? Date.parse(EXPIRES_AT) + 1
        : Date.parse(VERIFIED_AT),
    };

    expect(() => assertOpenRouterPreflightProof(value, context)).toThrow(
      expect.objectContaining({ code: 'OPENROUTER_POLICY_REJECTED' }),
    );
  });

  it('rejects future clocks, overlong validity and reconditioned old snapshots', () => {
    const snapshots = buildCapabilitySnapshots(fixture, {
      fetchedAt: FETCHED_AT,
    });
    const common = {
      apiKey: API_KEY,
      preflightSoftwareSha: SOFTWARE_SHA,
      catalogChecksum: sha256Canonical(fixture),
    };

    expect(() => verifyModelPolicyCapabilities(snapshots, {
      ...common,
      verifiedAt: '2026-07-30T11:59:59.999Z',
      expiresAt: EXPIRES_AT,
    })).toThrow();
    expect(() => verifyModelPolicyCapabilities(snapshots, {
      ...common,
      verifiedAt: VERIFIED_AT,
      expiresAt: '2026-07-31T12:00:30.001Z',
    })).toThrow();
    expect(() => verifyModelPolicyCapabilities(snapshots, {
      ...common,
      verifiedAt: '2026-07-30T12:05:00.001Z',
      expiresAt: '2026-07-31T12:05:00.001Z',
    })).toThrow();
    expect(() => assertOpenRouterPreflightProof(proof(), {
      apiKey: API_KEY,
      preflightSoftwareSha: SOFTWARE_SHA,
      currentTime: Date.parse(VERIFIED_AT) - 1,
    })).toThrow(
      expect.objectContaining({ code: 'OPENROUTER_POLICY_REJECTED' }),
    );
  });
});
