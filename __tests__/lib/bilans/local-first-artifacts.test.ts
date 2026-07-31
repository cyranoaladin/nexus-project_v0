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
  scanLocalFirstArtifactPayload,
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

  it('owns and deep-freezes the payload used by the immutable envelope', () => {
    const sourcePayload = {
      section: { label: 'Donnée synthétique contrôlée.' },
    };
    const scan = scanPiiFields([{
      path: '$.payload.section.label',
      text: sourcePayload.section.label,
      source: 'CONTROLLED_TEMPLATE',
    }]).result;
    const artifact = createLocalFirstArtifact({
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
      piiScanResult: scan,
      payload: sourcePayload,
    });

    sourcePayload.section.label = 'Mutation externe après création';
    expect((artifact.payload as typeof sourcePayload).section.label)
      .toBe('Donnée synthétique contrôlée.');
    expect(Object.isFrozen(artifact.payload)).toBe(true);
    expect(Object.isFrozen((artifact.payload as typeof sourcePayload).section))
      .toBe(true);
    expect(() => {
      (artifact.payload as typeof sourcePayload).section.label =
        'Mutation directe après création';
    }).toThrow(TypeError);
    expect(hasValidArtifactChecksum(artifact)).toBe(true);
  });

  it('rejects a valid CLEAN scan that was computed for another payload', () => {
    expect(() => createLocalFirstArtifact({
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
      payload: { label: 'Contact synthétique eleve@example.invalid' },
    })).toThrow(/PII scan.*payload/i);
  });

  it('re-runs PII detection with trusted sources instead of caller labels', () => {
    const text = 'Contact synthétique eleve@example.invalid';
    const callerClassifiedScan = scanPiiFields([{
      path: '$.payload.contact',
      text,
      source: 'STRUCTURAL_METADATA',
    }]).result;
    expect(callerClassifiedScan.status).toBe('CLEAN');

    expect(() => createLocalFirstArtifact({
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
      piiScanResult: callerClassifiedScan,
      payload: { contact: text },
    })).toThrow(/trusted PII scan|transport-safe/i);
  });

  it('rejects numeric PII omitted from a caller-provided scan', () => {
    expect(() => createLocalFirstArtifact({
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
      piiScanResult: scanPiiFields([]).result,
      payload: { phone: 99_192_829 },
    })).toThrow(/PII scan|transport-safe/i);
  });

  it.each([
    { studentIdentifier: 123_456 },
    { student_id: 123_456 },
    { studentIdentifier: { value: 123_456 } },
    { studentIdentifier: { points: 123_456 } },
  ])('blocks unknown numeric paths, including nested identifiers: %j', (payload) => {
    const scan = scanLocalFirstArtifactPayload(payload);

    expect(scan).toMatchObject({
      status: 'BLOCKED',
      detectedCategories: expect.arrayContaining(['FREE_TEXT_UNCLASSIFIED']),
      requiresHumanReview: true,
    });
    expect(() => createLocalFirstArtifact({
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
      piiScanResult: scan,
      payload,
    })).toThrow(/PII scan|transport-safe/i);
  });

  it('rejects non-JSON payload objects before scanning and checksumming', () => {
    const input = {
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
      piiScanResult: scanPiiFields([]).result,
      payload: { observedAt: new Date('2026-07-31T08:00:00.000Z') },
    } as const;
    expect(() => createLocalFirstArtifact(input)).toThrow(/plain JSON/i);

    const sparse = Array(1) as unknown[];
    expect(() => createLocalFirstArtifact({
      ...input,
      payload: { values: sparse },
    })).toThrow(/plain JSON/i);
  });

  it('rejects open or PII-bearing JSON property names', () => {
    expect(() => createLocalFirstArtifact({
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
      piiScanResult: scanPiiFields([]).result,
      payload: { 'minor@example.invalid': 1 },
    })).toThrow(/plain JSON|property name/i);
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
      piiScanResult: scanLocalFirstArtifactPayload({ points: 10 }),
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
      piiScanResult: scanLocalFirstArtifactPayload({
        points: 10,
        maxPoints: 20,
      }),
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

  it('clones chain payloads before freezing validated output', () => {
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
      piiScanResult: scanLocalFirstArtifactPayload({
        points: 10,
        maxPoints: 20,
      }),
      payload: { points: 10, maxPoints: 20 },
      parent: root,
    });
    const plainRoot = JSON.parse(JSON.stringify(root));
    const plainScore = JSON.parse(JSON.stringify(score));

    const validated = validateArtifactChain([plainRoot, plainScore]);

    expect(Object.isFrozen(plainRoot.payload)).toBe(false);
    expect(validated[0].payload).not.toBe(plainRoot.payload);
    expect(validated[1].payload).not.toBe(plainScore.payload);
    expect(Object.isFrozen(validated[0].payload)).toBe(true);
    expect(Object.isFrozen(validated[1].payload)).toBe(true);
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
