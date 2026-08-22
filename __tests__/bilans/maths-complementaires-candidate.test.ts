import fs from 'node:fs';
import path from 'node:path';

const { parse: parseYaml } = require(path.join(
  path.dirname(require.resolve('yaml/package.json')),
  'dist/index.js',
)) as typeof import('yaml');

import {
  cpsCatalogSchema,
  validateBankSource,
  type SourceBank,
} from '@/lib/bilans/catalog/bank-validation';
import { isPackDeliveryEnabled } from '@/lib/bilans/api/pack-access';
import { resolvePrismaSubject } from '@/lib/bilans/api/create-attempt';
import { bilanPackSubjectLabel } from '@/lib/bilans/catalog/subjects';
import { buildPreRentreeStageLabel } from '@/lib/bilans/render/stage-label';
import { buildPack } from '@/scripts/bilans/yaml-bank-to-pack';

const SOURCE = 'data/bilans/banks/entree-terminale-maths-complementaires-v1.yaml';
const CPS = 'data/bilans/cps/1re-maths-vers-terminale-complementaires.v1.yaml';
const PROMPTS = 'content/bilans/prompts/entree-terminale-maths-complementaires-v1';
const TEMPLATE = 'data/bilans/banks/maths-terminale-bilan-v1.json';

function readYaml<T>(relativePath: string): T {
  return parseYaml(fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')) as T;
}

function correctLetter(item: SourceBank['items'][number]): string {
  const correct = item.options?.find(({ correct: isCorrect }) => isCorrect);
  if (correct === undefined) throw new Error(`MISSING_CORRECT_OPTION:${item.id}`);
  return correct.key;
}

describe('candidat Maths complémentaires — entrée en Terminale', () => {
  const bank = readYaml<SourceBank>(SOURCE);
  const cps = cpsCatalogSchema.parse(readYaml<unknown>(CPS));

  it('reproduit les 18 questions de la copie papier en 9 nœuds, sans affaiblir les autres règles', () => {
    expect(bank.slug).toBe('entree-terminale-maths-complementaires-v1');
    expect(bank.level).toBe('TERMINALE');
    expect(bank.subject).toBe('MATHS_COMPLEMENTAIRES');
    expect(bank.items).toHaveLength(18);
    expect(new Set(bank.items.map(({ nodeCpsId }) => nodeCpsId)).size).toBe(9);
    expect(cps.nodes).toHaveLength(9);
    expect(validateBankSource(bank, cps)).toEqual([]);
    expect(bank.items.reduce((sum, item) => sum + item.targetTimeSec, 0)).toBeLessThanOrEqual(25 * 60);
  });

  it('préserve exactement les lettres A/B/C/D de la copie déjà imprimée', () => {
    expect(bank.items.map(correctLetter)).toEqual([
      'B', 'B', 'C', 'C', 'B', 'B', 'C', 'B', 'B', 'B', 'C', 'C', 'B', 'B', 'C', 'B', 'B', 'B',
    ]);
    expect(bank.delivery).toEqual({ online: false, paperEntry: true, fixedPaperForm: true });
  });

  it('ne désactive V14 que pour un formulaire papier fixe impossible à permuter', () => {
    const onlineEquivalent: SourceBank = {
      ...bank,
      delivery: { online: true, paperEntry: true, fixedPaperForm: false },
    };
    expect(validateBankSource(onlineEquivalent, cps)).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'V14', path: '$.items' }),
    ]));
  });

  it('corrige la formulation contradictoire de la question 14 sans changer la lettre de la copie', () => {
    const item = bank.items[13];
    expect(item.id).toBe('EMC-MAT-PRO-02');
    expect(correctLetter(item)).toBe('B');
    expect(item.options?.find(({ key }) => key === 'B')?.label).toBe('Oui, à environ 59 %');
    const posterior = (0.03 * 0.95) / ((0.03 * 0.95) + (0.97 * 0.02));
    expect(posterior).toBeGreaterThan(0.59);
    expect(posterior).toBeLessThan(0.60);
  });

  it('garde les notions nouvelles de Terminale identifiables comme ponts pédagogiques', () => {
    const bridgeNodes = cps.nodes.filter(({ id }) => id.startsWith('terminale.maths-complementaires.'));
    expect(bridgeNodes.map(({ id }) => id)).toEqual([
      'terminale.maths-complementaires.logarithme.proprietes-inequations',
      'terminale.maths-complementaires.probabilites.independance-bayes',
      'terminale.maths-complementaires.esperance.binomiale-jeu',
    ]);
    expect(bridgeNodes.every(({ sourceLevel, targetLevel }) => sourceLevel === 'TERMINALE' && targetLevel === 'TERMINALE')).toBe(true);
  });

  it('construit un pack DRAFT complet, relié aux cinq agents génériques', () => {
    const pack = buildPack({
      sourcePath: SOURCE,
      cpsPath: CPS,
      templatePackPath: TEMPLATE,
      promptDirectory: PROMPTS,
      reviewRegistry: null,
      resolvedReviewerIds: new Set<string>(),
    });

    expect(pack.status).toBe('DRAFT');
    expect(pack.review).toEqual({ validatedBy: null, validatedAt: null });
    expect(pack.delivery).toEqual({ online: false, paperEntry: true, fixedPaperForm: true });
    expect(pack.questionnaire.items).toHaveLength(18);
    expect(pack.scoring.domains).toHaveLength(9);
    expect(Object.keys(pack.reporting.promptFiles).sort()).toEqual([
      'eleve', 'nexus', 'parents', 'preAnalysis', 'verifier',
    ]);
    for (const reference of Object.values(pack.reporting.promptFiles) as Array<{ path: string }>) {
      expect(reference.path).toContain('entree-terminale-maths-complementaires-v1');
    }
  });

  it('présente la matière distinctement mais la persiste dans la famille mathématique existante', () => {
    expect(bilanPackSubjectLabel('MATHS_COMPLEMENTAIRES')).toBe('Mathématiques complémentaires');
    expect(buildPreRentreeStageLabel('TERMINALE', 'MATHS_COMPLEMENTAIRES')).toContain('Mathématiques complémentaires');
    expect(resolvePrismaSubject('MATHS_COMPLEMENTAIRES')).toBe('MATHEMATIQUES');
  });

  it('interdit le canal en ligne et autorise la saisie papier sur le pack construit', () => {
    const pack = buildPack({
      sourcePath: SOURCE,
      cpsPath: CPS,
      templatePackPath: TEMPLATE,
      promptDirectory: PROMPTS,
      reviewRegistry: null,
      resolvedReviewerIds: new Set<string>(),
    });
    expect(isPackDeliveryEnabled(pack as never, 'online')).toBe(false);
    expect(isPackDeliveryEnabled(pack as never, 'paperEntry')).toBe(true);
  });
});
