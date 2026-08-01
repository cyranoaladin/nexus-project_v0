import fs from 'node:fs';
import path from 'node:path';

import rawPack from '@/data/bilans/banks/maths-terminale-v1.json';
import { loadBilanPack, loadValidatedPack } from '@/lib/bilans/catalog/load-pack';

const TEMP_DIRECTORY = path.join(process.cwd(), '.tmp-bilan-pack-tests');

function clonePack(): typeof rawPack {
  return JSON.parse(JSON.stringify(rawPack)) as typeof rawPack;
}

function completePackForLoaderTests() {
  const pack = clonePack();
  return {
    ...pack,
    questionnaire: {
      ...pack.questionnaire,
      items: pack.questionnaire.items.map((item, index) => ({
        ...item,
        nodeCpsId: index % 2 === 0
          ? 'tle.maths.analyse.derivation'
          : 'tle.maths.probabilites.conditionnelles',
        difficulty: 1 as const,
        targetTimeSec: 60,
        shortCorrection: item.explanation,
        options: item.options.map((option) => option.isCorrect
          ? option
          : { ...option, distractorRationale: 'TEST ONLY - documented distractor' }),
      })),
    },
  };
}

function writePack(name: string, value: unknown): string {
  fs.mkdirSync(TEMP_DIRECTORY, { recursive: true });
  const absolutePath = path.join(TEMP_DIRECTORY, name);
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return path.relative(process.cwd(), absolutePath);
}

afterAll(() => fs.rmSync(TEMP_DIRECTORY, { recursive: true, force: true }));

describe('fail-closed bilan pack loader', () => {
  it('rejects the real draft pack and lists its missing diagnostic metadata', () => {
    expect(() => loadBilanPack('data/bilans/banks/maths-terminale-v1.json')).toThrow(
      /PACK_ITEM_METADATA_INVALID[\s\S]*MATH-ANA-01\.nodeCpsId[\s\S]*MATH-ANA-01\.difficulty[\s\S]*MATH-ANA-01\.targetTimeSec[\s\S]*MATH-ANA-01\.shortCorrection/,
    );
  });

  it('loads a test-only pack when every required diagnostic field is complete', () => {
    const pack = loadBilanPack(writePack('complete-test-pack.json', completePackForLoaderTests()));
    expect(pack.questionnaire.items).toHaveLength(50);
    expect(pack.questionnaire.items.every((item) => item.options
      .filter((option) => !option.isCorrect)
      .every((option) => Boolean(option.distractorRationale)))).toBe(true);
  });

  it('rejects a distractor without a documented rationale and identifies it', () => {
    const broken = completePackForLoaderTests();
    const distractor = broken.questionnaire.items[0].options.find((option) => !option.isCorrect);
    if (!distractor || !('distractorRationale' in distractor)) throw new Error('TEST_FIXTURE_HAS_NO_DISTRACTOR');
    distractor.distractorRationale = '';

    expect(() => loadBilanPack(writePack('missing-rationale.json', broken))).toThrow(
      /MATH-ANA-01\.options\.[a-z]+\.distractorRationale/,
    );
  });

  it('rejects A REMPLACER as incomplete pedagogical metadata', () => {
    const broken = completePackForLoaderTests();
    const distractor = broken.questionnaire.items[0].options.find((option) => !option.isCorrect);
    if (!distractor || !('distractorRationale' in distractor)) throw new Error('TEST_FIXTURE_HAS_NO_DISTRACTOR');
    distractor.distractorRationale = 'A REMPLACER';

    expect(() => loadBilanPack(writePack('replacement-rationale.json', broken))).toThrow(
      /MATH-ANA-01\.options\.[a-z]+\.distractorRationale/,
    );
  });

  it('rejects a raw domainId used as a nodeCpsId', () => {
    const broken = completePackForLoaderTests();
    broken.questionnaire.items[0].nodeCpsId = broken.questionnaire.items[0].domainId;

    expect(() => loadBilanPack(writePack('domain-as-node.json', broken))).toThrow(/nodeCpsId/);
  });

  it('rejects a changed prompt checksum', () => {
    const broken = completePackForLoaderTests();
    broken.reporting.promptFiles.eleve.checksum = '0'.repeat(64);

    expect(() => loadBilanPack(writePack('bad-checksum.json', broken))).toThrow(/checksum/i);
  });

  it('never turns the real draft pack into a ValidatedPack', () => {
    expect(() => loadValidatedPack('data/bilans/banks/maths-terminale-v1.json')).toThrow(/PACK_ITEM_METADATA_INVALID/);
  });

  it.each([
    { validatedBy: null, validatedAt: null },
    { validatedBy: '', validatedAt: '2026-08-01T10:00:00.000Z' },
    { validatedBy: 'FIXTURE — JAMAIS UN ENSEIGNANT', validatedAt: '1970-01-01T00:00:00.000Z' },
  ])('rejects absent, empty or fixture pedagogical approval', (review) => {
    const candidate = { ...completePackForLoaderTests(), status: 'VALIDATED', review };
    expect(() => loadValidatedPack(writePack(`rejected-${String(review.validatedBy)}.json`, candidate))).toThrow();
  });

  it('constructs a ValidatedPack only from named, dated approval read from the pack', () => {
    const candidate = {
      ...completePackForLoaderTests(),
      status: 'VALIDATED',
      review: {
        validatedBy: 'Enseignante de mathématiques, qualification vérifiée',
        validatedAt: '2026-08-01T10:00:00.000Z',
      },
    };
    expect(loadValidatedPack(writePack('validated.json', candidate))).toMatchObject({
      status: 'VALIDATED',
      review: candidate.review,
    });
  });
});
