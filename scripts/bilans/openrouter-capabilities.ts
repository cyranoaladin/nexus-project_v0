import fixture from '../../content/bilans/model-policies/openrouter-capability-baseline-v1.1.json';

import {
  buildCapabilitySnapshots,
  verifyModelPolicyCapabilities,
} from '../../lib/llm/openrouter/capabilities';
import { sha256Canonical } from '../../lib/llm/openrouter/hash';

const fetchedAt = fixture.capturedAt;
const proof = verifyModelPolicyCapabilities(
  buildCapabilitySnapshots(fixture, { fetchedAt }),
  {
    verifiedAt: fetchedAt,
    expiresAt: new Date(
      Date.parse(fetchedAt) + (24 * 60 * 60 * 1_000),
    ).toISOString(),
    apiKey: 'offline-fixture-only-no-provider-access',
    preflightSoftwareSha: '0'.repeat(40),
    catalogChecksum: sha256Canonical(fixture),
  },
);

process.stdout.write(`${JSON.stringify({
  source: 'frozen-fixture',
  fixtureId: fixture.fixtureId,
  policyId: proof.policyId,
  policyVersion: proof.policyVersion,
  policyChecksum: proof.policyChecksum,
  catalogChecksum: proof.catalogChecksum,
  verifiedAt: proof.verifiedAt,
  models: proof.snapshots.map((snapshot) => ({
    requestedModelId: snapshot.requestedModelId,
    canonicalSlug: snapshot.canonicalSlug,
    supportedParameters: snapshot.supportedParameters,
    contextLength: snapshot.contextLength,
    maxCompletionTokens: snapshot.maxCompletionTokens,
    structuredOutputsSupported: snapshot.structuredOutputsSupported,
    temperatureDeclaredSupported: snapshot.temperatureDeclaredSupported,
    reasoningSupported: snapshot.reasoningSupported,
    reasoningEfforts: snapshot.reasoningEfforts,
    capabilityChecksum: snapshot.capabilityChecksum,
  })),
}, null, 2)}\n`);
