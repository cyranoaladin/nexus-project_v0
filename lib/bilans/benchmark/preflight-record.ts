import 'server-only';

import {
  appendBenchmarkEvent,
  readBenchmarkJournal,
  type BenchmarkJournalHandle,
} from './journal';

export type DurableLunaPreflight = Readonly<{
  proof: Readonly<{
    proofChecksum: string;
    policyChecksum: string;
    catalogChecksum: string;
    apiKeyFingerprint: string;
    softwareSha: string;
    expiresAt: string;
    [key: string]: unknown;
  }>;
  transportPolicyChecksum: string;
  generationId: string;
  finishReason: 'stop';
  schemaValid: true;
  zdrRequested: true;
  dataCollectionDenied: true;
  requireParametersRequested: true;
}>;

function parse(input: unknown): DurableLunaPreflight {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('LUNA_PREFLIGHT_EVIDENCE_INVALID');
  }
  const record = input as Record<string, unknown>;
  const proof = record.proof;
  if (
    proof === null
    || typeof proof !== 'object'
    || Array.isArray(proof)
    || !('proofChecksum' in proof)
    || typeof proof.proofChecksum !== 'string'
    || !/^[a-f0-9]{64}$/.test(proof.proofChecksum)
    || !('policyChecksum' in proof)
    || typeof proof.policyChecksum !== 'string'
    || !/^[a-f0-9]{64}$/.test(proof.policyChecksum)
    || !('catalogChecksum' in proof)
    || typeof proof.catalogChecksum !== 'string'
    || !/^[a-f0-9]{64}$/.test(proof.catalogChecksum)
    || !('apiKeyFingerprint' in proof)
    || typeof proof.apiKeyFingerprint !== 'string'
    || !('softwareSha' in proof)
    || typeof proof.softwareSha !== 'string'
    || !/^[a-f0-9]{40}$/.test(proof.softwareSha)
    || !('expiresAt' in proof)
    || typeof proof.expiresAt !== 'string'
    || !Number.isFinite(Date.parse(proof.expiresAt))
    || typeof record.transportPolicyChecksum !== 'string'
    || !/^[a-f0-9]{64}$/.test(record.transportPolicyChecksum)
    || typeof record.generationId !== 'string'
    || record.generationId.length === 0
    || record.finishReason !== 'stop'
    || record.schemaValid !== true
    || record.zdrRequested !== true
    || record.dataCollectionDenied !== true
    || record.requireParametersRequested !== true
  ) {
    throw new Error('LUNA_PREFLIGHT_EVIDENCE_INVALID');
  }
  return Object.freeze(input as DurableLunaPreflight);
}

export function recordDurableLunaPreflight(
  journal: BenchmarkJournalHandle,
  input: unknown,
): DurableLunaPreflight {
  const evidence = parse(input);
  appendBenchmarkEvent(journal, {
    type: 'PREFLIGHT_SUCCEEDED',
    payload: { evidence },
  });
  return evidence;
}

export function readDurableLunaPreflight(
  journal: BenchmarkJournalHandle,
): DurableLunaPreflight | null {
  const event = [...readBenchmarkJournal(journal)].reverse().find(
    ({ type }) => type === 'PREFLIGHT_SUCCEEDED',
  );
  return event === undefined ? null : parse(event.payload.evidence);
}
