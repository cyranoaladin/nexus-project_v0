/** @jest-environment node */

import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  LocalFirstArtifactEnvelopeSchema,
  createLocalFirstArtifact,
  hasValidArtifactChecksum,
  readLocalFirstArtifact,
  validateArtifactChain,
  writeLocalFirstArtifactAtomic,
} from '@/lib/bilans/local-first/artifacts';
import { scanPiiFields } from '@/lib/bilans/local-first/pii';

const REPOSITORY_SHA = execFileSync(
  'git',
  ['rev-parse', 'HEAD'],
  { encoding: 'utf8' },
).trim();
const CHECKSUM = 'a'.repeat(64);
const PII_SCAN = scanPiiFields([{
  path: '$.payload.label',
  text: 'Donnée synthétique contrôlée.',
  source: 'CONTROLLED_TEMPLATE',
}]).result;

function createRoot() {
  return createLocalFirstArtifact({
    artifactType: 'NORMALIZED_ASSESSMENT',
    repositorySha: REPOSITORY_SHA,
    expectedRepositorySha: REPOSITORY_SHA,
    datasetVersion: 'synthetic-v1',
    generatorId: 'bilan-local-first',
    generatorVersion: '1',
    scoringPolicyChecksum: CHECKSUM,
    corpusChecksum: CHECKSUM,
    promptChecksum: null,
    outputSchemaChecksum: null,
    audience: 'PARENT',
    classification: 'SYNTHETIC_BENCHMARK',
    piiScanResult: PII_SCAN,
    payload: { label: 'Donnée synthétique contrôlée.' },
  });
}

describe('immutable local-first artifact envelope', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('creates a checksum-valid root bound to the actual repository SHA', () => {
    const before = Date.now();
    const artifact = createRoot();
    const after = Date.now();

    expect(artifact).toMatchObject({
      artifactType: 'NORMALIZED_ASSESSMENT',
      repositorySha: REPOSITORY_SHA,
      datasetVersion: 'synthetic-v1',
      parentArtifactChecksum: null,
      artifactChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(Date.parse(artifact.generatedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(artifact.generatedAt)).toBeLessThanOrEqual(after);
    expect(hasValidArtifactChecksum(artifact)).toBe(true);
    expect(() => LocalFirstArtifactEnvelopeSchema.parse(artifact))
      .not.toThrow();
  });

  it('rejects a fake repository SHA and a non-root without a parent', () => {
    expect(() => createLocalFirstArtifact({
      ...createRoot(),
      artifactType: 'SCORE_SNAPSHOT',
      repositorySha: 'f'.repeat(40),
      expectedRepositorySha: REPOSITORY_SHA,
      artifactChecksum: undefined,
      parentArtifactChecksum: undefined,
    } as never)).toThrow(/repository SHA/i);

    expect(() => createLocalFirstArtifact({
      artifactType: 'SCORE_SNAPSHOT',
      repositorySha: REPOSITORY_SHA,
      expectedRepositorySha: REPOSITORY_SHA,
      datasetVersion: 'synthetic-v1',
      generatorId: 'bilan-local-first',
      generatorVersion: '1',
      scoringPolicyChecksum: CHECKSUM,
      corpusChecksum: CHECKSUM,
      promptChecksum: null,
      outputSchemaChecksum: null,
      audience: 'PARENT',
      classification: 'SYNTHETIC_BENCHMARK',
      piiScanResult: PII_SCAN,
      payload: { points: 10 },
    })).toThrow(/parent/i);
  });

  it('links children to the exact parent checksum and detects tampering', () => {
    const root = createRoot();
    const score = createLocalFirstArtifact({
      artifactType: 'SCORE_SNAPSHOT',
      repositorySha: REPOSITORY_SHA,
      expectedRepositorySha: REPOSITORY_SHA,
      datasetVersion: 'synthetic-v1',
      generatorId: 'bilan-local-first',
      generatorVersion: '1',
      scoringPolicyChecksum: CHECKSUM,
      corpusChecksum: CHECKSUM,
      promptChecksum: null,
      outputSchemaChecksum: null,
      audience: 'PARENT',
      classification: 'SYNTHETIC_BENCHMARK',
      piiScanResult: PII_SCAN,
      payload: { points: 10, maxPoints: 20 },
      parent: root,
    });

    expect(score.parentArtifactChecksum).toBe(root.artifactChecksum);
    expect(validateArtifactChain([root, score])).toEqual([root, score]);
    expect(() => validateArtifactChain([
      root,
      { ...score, parentArtifactChecksum: 'b'.repeat(64) },
    ])).toThrow();
    expect(hasValidArtifactChecksum({
      ...score,
      payload: { points: 20, maxPoints: 20 },
    })).toBe(false);
  });

  it('writes privately without overwrite and revalidates on read', () => {
    const directory = mkdtempSync(join(tmpdir(), 'nexus-artifact-'));
    roots.push(directory);
    chmodSync(directory, 0o700);
    const path = join(directory, '00_assessment_input.normalized.json');
    const artifact = createRoot();

    writeLocalFirstArtifactAtomic(path, artifact);
    expect(readLocalFirstArtifact(path)).toEqual(artifact);
    expect(() => writeLocalFirstArtifactAtomic(path, artifact))
      .toThrow(/already exists/i);
    const serialized = readFileSync(path, 'utf8');
    expect(serialized).toContain(artifact.artifactChecksum);
  });
});
