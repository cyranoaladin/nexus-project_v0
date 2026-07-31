/** @jest-environment node */

import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  readDurableLunaPreflight,
  recordDurableLunaPreflight,
} from '@/lib/bilans/benchmark/preflight-record';
import { createBenchmarkJournal } from '@/lib/bilans/benchmark/journal';
import { createBenchmarkRunIdentity } from '@/lib/bilans/benchmark/run-identity';

function setup(root: string) {
  const identity = createBenchmarkRunIdentity({
    repositorySha: 'a'.repeat(40),
    benchmarkPolicyChecksum: 'b'.repeat(64),
    transportPolicyChecksum: 'c'.repeat(64),
    datasetChecksum: 'd'.repeat(64),
    promptChecksum: 'e'.repeat(64),
    draftSchemaChecksum: 'f'.repeat(64),
    finalSchemaChecksum: '0'.repeat(64),
    randomizationSeed: 'preflight-record-test-v1',
    createdAt: '2026-07-31T10:00:00.000Z',
  });
  return createBenchmarkJournal({
    rootDirectory: root,
    identity,
    schedule: [],
  });
}

const proof = {
  proofChecksum: '1'.repeat(64),
  policyChecksum: '2'.repeat(64),
  catalogChecksum: '3'.repeat(64),
  apiKeyFingerprint: 'hmac-sha256:test',
  softwareSha: 'a'.repeat(40),
  expiresAt: '2026-08-01T10:00:00.000Z',
};

describe('durable Luna preflight record', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nexus-benchmark-preflight-'));
    chmodSync(root, 0o700);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('persists all required evidence and reloads it for the same run', () => {
    const journal = setup(root);
    recordDurableLunaPreflight(journal, {
      proof,
      transportPolicyChecksum: '4'.repeat(64),
      generationId: 'gen-luna-synthetic',
      finishReason: 'stop',
      schemaValid: true,
      zdrRequested: true,
      dataCollectionDenied: true,
      requireParametersRequested: true,
    });

    expect(readDurableLunaPreflight(journal)).toEqual(expect.objectContaining({
      proof,
      transportPolicyChecksum: '4'.repeat(64),
      generationId: 'gen-luna-synthetic',
    }));
  });

  it.each([
    { finishReason: 'length' },
    { schemaValid: false },
    { zdrRequested: false },
    { dataCollectionDenied: false },
    { requireParametersRequested: false },
    { generationId: null },
  ])('rejects an incomplete proof variant %#', (override) => {
    const journal = setup(root);
    expect(() => recordDurableLunaPreflight(journal, {
      proof,
      transportPolicyChecksum: '4'.repeat(64),
      generationId: 'gen-luna-synthetic',
      finishReason: 'stop',
      schemaValid: true,
      zdrRequested: true,
      dataCollectionDenied: true,
      requireParametersRequested: true,
      ...override,
    })).toThrow('LUNA_PREFLIGHT_EVIDENCE_INVALID');
  });
});
