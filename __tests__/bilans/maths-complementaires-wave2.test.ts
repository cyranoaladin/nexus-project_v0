import fs from 'node:fs';

import { resolvePrismaSubject } from '@/lib/bilans/api/create-attempt';
import {
  listResolvablePackSlugs,
  packFeatureFlagName,
  resolveEnabledPack,
} from '@/lib/bilans/api/pack-access';
import { loadBilanPack, loadValidatedPack } from '@/lib/bilans/catalog/load-pack';
import { loadWaveManifest } from '@/lib/bilans/catalog/wave-manifest';
import { projectPaperEntryItems } from '@/lib/bilans/saisie-papier/projection';
import { BILAN_AGENT_IDS } from '@/lib/bilans/validators/contracts';
import { convertBankBatch } from '@/scripts/bilans/convert-bank-batch';
import { buildPack } from '@/scripts/bilans/yaml-bank-to-pack';

const SLUG = 'entree-terminale-maths-complementaires-v1';
const WAVE = 'data/bilans/banks/wave2.manifest.json';
const SOURCE = `data/bilans/banks/${SLUG}.yaml`;
const CPS = 'data/bilans/cps/prerequis-maths-complementaires-vers-terminale.v1.yaml';
const PROMPTS = `content/bilans/prompts/${SLUG}`;
const OUTPUT = `data/bilans/banks/${SLUG}.json`;
const TEMPLATE = 'data/bilans/banks/maths-terminale-bilan-v1.json';
const REVIEWER = 'cmomnwolx0001mi0u8m8zj53w';
const FLAG = packFeatureFlagName(SLUG);

const PAPER_CORRECT_IDS = [
  'B', 'B', 'C', 'C', 'B', 'B',
  'C', 'B', 'B', 'B', 'C', 'C',
  'B', 'B', 'C', 'B', 'B', 'B',
] as const;

describe('Mathématiques complémentaires — vague 2 et saisie papier', () => {
  test('conserve la vague 1 scellée et isole les 18 items dans la vague 2', () => {
    const wave = loadWaveManifest(WAVE);
    expect(wave.wave).toBe('vague-2-maths-complementaires-2026');
    expect(wave.expectedActiveBanks).toBe(1);
    expect(wave.expectedItems).toBe(18);
    expect(wave.banks).toEqual([{
      slug: SLUG,
      source: SOURCE,
      cps: CPS,
      promptDirectory: PROMPTS,
      output: OUTPUT,
    }]);
  });

  test('reconstruit exactement le pack commité depuis la source YAML, le CPS, les prompts et la revue', () => {
    const generated = buildPack({
      sourcePath: SOURCE,
      cpsPath: CPS,
      templatePackPath: TEMPLATE,
      promptDirectory: PROMPTS,
      resolvedReviewerIds: new Set([REVIEWER]),
    });
    const committed = JSON.parse(fs.readFileSync(OUTPUT, 'utf8')) as unknown;
    expect(generated).toEqual(committed);

    const batch = convertBankBatch({
      manifestPath: WAVE,
      resolvedReviewerIds: new Set([REVIEWER]),
    });
    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({ slug: SLUG, items: 18, nodes: 9 });
  });

  test('charge un pack validé et lie les cinq agents du workflow de restitution', () => {
    const pack = loadBilanPack(OUTPUT);
    const validated = loadValidatedPack(OUTPUT);

    expect(pack).toMatchObject({
      slug: SLUG,
      level: 'TERMINALE',
      subject: 'MATHS_COMPLEMENTAIRES',
      version: 1,
      status: 'VALIDATED',
    });
    expect(pack.questionnaire.targetDurationMin).toBe(25);
    expect(pack.questionnaire.items).toHaveLength(18);
    expect(pack.scoring.domains).toEqual([
      'suites',
      'derivation',
      'exponentielle',
      'second-degre',
      'probabilites',
      'pourcentages',
    ]);
    expect(pack.reporting.rag).toMatchObject({ enabled: false, topK: 0 });
    for (const agentId of BILAN_AGENT_IDS) {
      expect(pack.reporting.promptFiles[agentId].path).toContain(`/${SLUG}/`);
      expect(pack.reporting.promptFiles[agentId].checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(pack.reporting.outputSchemas[agentId]).toBeDefined();
    }
    expect(validated.slug).toBe(SLUG);
  });

  test('respecte les lettres réellement imprimées tout en équilibrant les positions internes anti-biais', () => {
    const pack = loadBilanPack(OUTPUT);
    expect(pack.questionnaire.items.map((item) => (
      item.options.find(({ isCorrect }) => isCorrect)!.id
    ))).toEqual(PAPER_CORRECT_IDS);

    const positions = [0, 0, 0, 0];
    for (const item of pack.questionnaire.items) {
      positions[item.options.findIndex(({ isCorrect }) => isCorrect)] += 1;
    }
    expect(positions).toEqual([5, 5, 4, 4]);

    const enabled = {
      pack,
      validatedPack: loadValidatedPack(OUTPUT),
      checksum: 'a'.repeat(64),
      path: OUTPUT,
    } as const;
    const paper = projectPaperEntryItems(enabled);
    for (const item of paper) {
      expect(item.options.map(({ id }) => id)).toEqual(['A', 'B', 'C', 'D']);
    }
  });

  test('traite le logarithme comme bridge Terminale et protège l’anomalie éditoriale de la question 14', () => {
    const pack = loadBilanPack(OUTPUT);
    const q9 = pack.questionnaire.items[8];
    const q10 = pack.questionnaire.items[9];
    const q14 = pack.questionnaire.items[13];

    expect(q9.nodeCpsId).toBe('terminale.maths-complementaires.exponentielle.logarithme-familiarisation');
    expect(q10.nodeCpsId).toBe(q9.nodeCpsId);
    expect(q9.shortCorrection).toContain('familiarisation');
    expect(q10.shortCorrection).toContain('familiarisation');

    expect(q14.id).toBe('MCO-MAT-PRO-02');
    expect(q14.options.find(({ id }) => id === 'B')).toMatchObject({ isCorrect: true });
    expect(q14.shortCorrection).toContain('59,5 %');
    expect(q14.shortCorrection).toContain('« Non » imprimé est incohérent');
  });

  test('n’expose la vague 2 qu’avec son feature flag exact et persiste la discipline large', () => {
    expect(listResolvablePackSlugs({})).not.toContain(SLUG);
    expect(listResolvablePackSlugs({ [FLAG]: 'false' })).not.toContain(SLUG);
    expect(listResolvablePackSlugs({ [FLAG]: 'true' })).toContain(SLUG);

    expect(resolveEnabledPack(SLUG, 1, {})).toBeNull();
    expect(resolveEnabledPack(SLUG, 1, { [FLAG]: 'true' })).not.toBeNull();
    expect(resolvePrismaSubject('MATHS_COMPLEMENTAIRES')).toBe('MATHEMATIQUES');
  });
});
