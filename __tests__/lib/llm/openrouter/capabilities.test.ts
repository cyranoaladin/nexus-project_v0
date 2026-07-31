import fixture from '@/content/bilans/model-policies/openrouter-capability-baseline-v1.1.json';
import {
  buildCapabilitySnapshots,
  verifyModelPolicyCapabilities,
} from '@/lib/llm/openrouter/capabilities';
import { sha256Canonical } from '@/lib/llm/openrouter/hash';
import {
  BILAN_MODEL_POLICY_CHECKSUM,
  BILAN_TRANSPORT_POLICY_CHECKSUM,
} from '@/lib/llm/openrouter/policy';

type MutableCapabilityFixture = {
  data: Array<{
    canonical_slug: string;
    supported_parameters: string[];
    reasoning: {
      supported_efforts: string[];
    };
  }>;
};

const cloneFixture = (): MutableCapabilityFixture =>
  JSON.parse(JSON.stringify(fixture)) as MutableCapabilityFixture;
const proofOptions = (verifiedAt = '2026-07-30T00:00:01.000Z') => ({
  verifiedAt,
  expiresAt: new Date(
    Date.parse(verifiedAt) + (24 * 60 * 60 * 1_000),
  ).toISOString(),
  apiKey: 'synthetic-capability-key',
  preflightSoftwareSha: 'd'.repeat(40),
  catalogChecksum: sha256Canonical(fixture),
});

const incompatibleCases: ReadonlyArray<readonly [
  string,
  (copy: MutableCapabilityFixture) => void,
]> = [
  ['missing structured output', (copy) => {
    copy.data[0].supported_parameters =
      copy.data[0].supported_parameters.filter(
        (parameter) => parameter !== 'structured_outputs',
      );
  }],
  ['changed canonical slug', (copy) => {
    copy.data[0].canonical_slug = 'anthropic/claude-sonnet-5-rebound';
  }],
  ['missing low reasoning', (copy) => {
    copy.data[0].reasoning.supported_efforts = ['medium', 'high'];
  }],
];

describe('OpenRouter capability snapshots', () => {
  it('binds both approved models to immutable capability checksums', () => {
    const snapshots = buildCapabilitySnapshots(fixture, {
      fetchedAt: '2026-07-30T00:00:00.000Z',
    });
    const proof = verifyModelPolicyCapabilities(snapshots, {
      ...proofOptions(),
    });

    expect(proof.policyChecksum).toBe(BILAN_MODEL_POLICY_CHECKSUM);
    expect(proof).toMatchObject({
      transportPolicyId: 'bilan-openrouter-transport-policy',
      transportPolicyVersion: '1',
      transportPolicyChecksum: BILAN_TRANSPORT_POLICY_CHECKSUM,
    });
    expect(proof.snapshots).toHaveLength(2);
    expect(proof.snapshots.map((snapshot) => ({
      requestedModelId: snapshot.requestedModelId,
      outputTokenParameter: snapshot.outputTokenParameter,
    }))).toEqual([
      {
        requestedModelId: 'anthropic/claude-sonnet-5',
        outputTokenParameter: 'max_tokens',
      },
      {
        requestedModelId: 'openai/gpt-5.6-terra',
        outputTokenParameter: 'max_completion_tokens',
      },
    ]);
    for (const snapshot of proof.snapshots) {
      expect(snapshot.canonicalSlug).toMatch(
        new RegExp(`^${snapshot.requestedModelId.replace('/', '\\/')}-\\d{8}$`),
      );
      expect(snapshot.structuredOutputsSupported).toBe(true);
      expect(snapshot.reasoningSupported).toBe(true);
      expect(snapshot.reasoningEfforts).toContain('low');
      expect(snapshot.temperatureDeclaredSupported).toBe(false);
      expect(snapshot.capabilityChecksum).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it.each(incompatibleCases)('blocks activation on %s', (_label, mutate) => {
    const copy = cloneFixture();
    mutate(copy);

    expect(() =>
      verifyModelPolicyCapabilities(
        buildCapabilitySnapshots(copy, {
          fetchedAt: '2026-07-30T00:00:00.000Z',
        }),
        proofOptions(),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'BLOCKED_BY_MODEL_PARAMETER_COMPATIBILITY',
      }),
    );
  });

  it('does not enable temperature when a future catalog declares it', () => {
    const copy = cloneFixture();
    copy.data[0].supported_parameters.push('temperature');
    const [snapshot] = buildCapabilitySnapshots(copy, {
      fetchedAt: '2026-07-30T00:00:00.000Z',
    });

    expect(snapshot.temperatureDeclaredSupported).toBe(true);
    const fetchedAt = '2026-07-30T00:00:00.000Z';
    expect(verifyModelPolicyCapabilities(
      buildCapabilitySnapshots(copy, { fetchedAt }),
      proofOptions(),
    )).toBeDefined();
  });

  it('ignores malformed unrelated catalog entries while validating approved models strictly', () => {
    const copy = cloneFixture() as MutableCapabilityFixture & {
      data: Array<unknown>;
    };
    copy.data.unshift({
      id: 'unrelated/provider-model',
      canonical_slug: null,
      supported_parameters: null,
      top_provider: null,
    });

    const snapshots = buildCapabilitySnapshots(copy, {
      fetchedAt: '2026-07-30T00:00:00.000Z',
    });

    expect(snapshots.map(({ requestedModelId }) => requestedModelId)).toEqual([
      'anthropic/claude-sonnet-5',
      'openai/gpt-5.6-terra',
    ]);
  });

  it('rejects a capability snapshot whose immutable checksum was altered', () => {
    const snapshots = buildCapabilitySnapshots(fixture, {
      fetchedAt: '2026-07-30T00:00:00.000Z',
    });
    const altered = snapshots.map((snapshot, index) =>
      index === 0
        ? { ...snapshot, capabilityChecksum: '0'.repeat(64) }
        : snapshot);

    expect(() => verifyModelPolicyCapabilities(
      altered,
      proofOptions(),
    )).toThrow(
      expect.objectContaining({
        code: 'BLOCKED_BY_MODEL_PARAMETER_COMPATIBILITY',
      }),
    );
  });
});
