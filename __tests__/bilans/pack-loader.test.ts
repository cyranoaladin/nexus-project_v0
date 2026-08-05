import fs from 'node:fs';
import path from 'node:path';

import rawPack from '@/data/bilans/banks/entree-terminale-maths-v1.json';
import { loadBilanPack, loadValidatedPack } from '@/lib/bilans/catalog/load-pack';

const TEMP_DIRECTORY = path.join(process.cwd(), '.tmp-bilan-pack-tests');

function clonePack(): typeof rawPack {
  return JSON.parse(JSON.stringify(rawPack)) as typeof rawPack;
}

function writePack(name: string, value: unknown): string {
  fs.mkdirSync(TEMP_DIRECTORY, { recursive: true });
  const absolutePath = path.join(TEMP_DIRECTORY, name);
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return path.relative(process.cwd(), absolutePath);
}

afterAll(() => fs.rmSync(TEMP_DIRECTORY, { recursive: true, force: true }));

describe('fail-closed bilan pack loader', () => {
  it('loads the complete eighteen-item entry pack', () => {
    const pack = loadBilanPack('data/bilans/banks/entree-terminale-maths-v1.json');
    expect(pack.questionnaire.items).toHaveLength(18);
    expect(pack.questionnaire.items.every((item) => item.options
      .filter((option) => option.isCorrect === false)
      .every((option) => Boolean(option.distractorRationale)))).toBe(true);
  });

  it('rejects a bank when one correct-answer position exceeds forty percent', () => {
    const biased = clonePack();
    biased.questionnaire.items = biased.questionnaire.items.map((item) => {
      const correct = item.options.find((option) => option.isCorrect);
      if (correct === undefined) throw new Error(`TEST_FIXTURE_HAS_NO_CORRECT_OPTION:${item.id}`);
      const reordered = [correct, ...item.options.filter((option) => option !== correct)];
      return {
        ...item,
        options: reordered.map((option, index) => ({ ...option, id: 'ABCD'[index] })),
      };
    });
    expect(() => loadBilanPack(writePack('biased-correct-position.json', biased))).toThrow(
      /PACK_CORRECT_ANSWER_POSITION_BIAS:A:18\/18>40%/,
    );
  });

  it('rejects the requalified end-of-Terminale draft and lists missing metadata', () => {
    expect(() => loadBilanPack('data/bilans/banks/maths-terminale-bilan-v1.json')).toThrow(
      /PACK_ITEM_METADATA_INVALID[\s\S]*MATH-ANA-02\.nodeCpsId[\s\S]*MATH-ANA-02\.difficulty[\s\S]*MATH-ANA-02\.targetTimeSec[\s\S]*MATH-ANA-02\.shortCorrection/,
    );
  });

  it('rejects a distractor without a documented rationale and identifies it', () => {
    const broken = clonePack();
    const distractor = broken.questionnaire.items[0].options.find((option) => option.isCorrect === false);
    if (distractor === undefined || ('distractorRationale' in distractor) === false) throw new Error('TEST_FIXTURE_HAS_NO_DISTRACTOR');
    distractor.distractorRationale = '';
    expect(() => loadBilanPack(writePack('missing-rationale.json', broken))).toThrow(
      /ETL-MAT-SDG-01\.options\.[A-Z]+\.distractorRationale/,
    );
  });

  it('rejects A REMPLACER as incomplete pedagogical metadata', () => {
    const broken = clonePack();
    const distractor = broken.questionnaire.items[0].options.find((option) => option.isCorrect === false);
    if (distractor === undefined || ('distractorRationale' in distractor) === false) throw new Error('TEST_FIXTURE_HAS_NO_DISTRACTOR');
    distractor.distractorRationale = 'A REMPLACER';
    expect(() => loadBilanPack(writePack('replacement-rationale.json', broken))).toThrow(
      /ETL-MAT-SDG-01\.options\.[A-Z]+\.distractorRationale/,
    );
  });

  it('rejects a raw domainId used as a nodeCpsId', () => {
    const broken = clonePack();
    broken.questionnaire.items[0].nodeCpsId = broken.questionnaire.items[0].domainId;
    expect(() => loadBilanPack(writePack('domain-as-node.json', broken))).toThrow(/nodeCpsId/);
  });

  it('rejects a changed prompt checksum', () => {
    const broken = clonePack();
    broken.reporting.promptFiles.eleve.checksum = '0'.repeat(64);
    expect(() => loadBilanPack(writePack('bad-checksum.json', broken))).toThrow(/checksum/i);
  });

  it('never turns a DRAFT pack into a ValidatedPack', () => {
    const draft = clonePack();
    draft.status = 'DRAFT' as typeof draft.status;
    draft.review = { validatedBy: null, validatedAt: null } as unknown as typeof draft.review;
    expect(() => loadValidatedPack(writePack('still-draft.json', draft))).toThrow(
      /PACK_PEDAGOGICAL_VALIDATION_REQUIRED/,
    );
  });

  it.each([
    { validatedBy: null, validatedAt: null },
    { validatedBy: '', validatedAt: '2026-08-02T10:00:00.000Z' },
    { validatedBy: 'FIXTURE — JAMAIS UN ENSEIGNANT', validatedAt: '1970-01-01T00:00:00.000Z' },
  ])('rejects absent, empty or fixture pedagogical approval', (review) => {
    const candidate = { ...clonePack(), status: 'VALIDATED', review };
    expect(() => loadValidatedPack(writePack(`rejected-${String(review.validatedBy)}.json`, candidate))).toThrow();
  });

  it('constructs a ValidatedPack only from named, dated approval read from the pack', () => {
    const candidate = {
      ...clonePack(),
      status: 'VALIDATED',
      review: {
        validatedBy: 'Enseignante de mathématiques, qualification vérifiée',
        validatedAt: '2026-08-02T10:00:00.000Z',
      },
    };
    expect(loadValidatedPack(writePack('validated.json', candidate))).toMatchObject({
      status: 'VALIDATED',
      review: candidate.review,
    });
  });
});
