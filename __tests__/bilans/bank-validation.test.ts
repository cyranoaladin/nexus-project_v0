import { BANK_ITEM_ID_PATTERN, validateBankCollection, validateBankSource } from '@/lib/bilans/catalog/bank-validation';

const item = (id: string, nodeCpsId = '5e.maths.calcul.fixture') => ({
  id,
  nodeCpsId,
  type: 'QCM_SIMPLE' as const,
  difficulty: 1,
  targetTimeSec: 30,
  statement: 'Quel résultat est correct dans cette situation ?',
  shortCorrection: 'La démarche consiste à appliquer la définition.',
  options: [
    { key: 'A', label: 'Réponse juste', correct: true },
    { key: 'B', label: 'Distracteur un', correct: false, distractorRationale: 'Erreur de définition.' },
    { key: 'C', label: 'Distracteur deux', correct: false, distractorRationale: 'Erreur de calcul.' },
    { key: 'D', label: 'Distracteur trois', correct: false, distractorRationale: 'Erreur de lecture.' },
  ],
});

const bank = (subject = 'MATHS', nodeCpsId = '5e.maths.calcul.fixture') => ({
  slug: 'fixture-bank-v1', level: 'QUATRIEME', subject, version: 1, status: 'DRAFT', targetDurationMin: 10,
  items: [item('4E-MAT-FIX-01', nodeCpsId), { ...item('4E-MAT-FIX-02', nodeCpsId), options: [
    { key: 'A', label: 'Distracteur un', correct: false, distractorRationale: 'Erreur de définition.' },
    { key: 'B', label: 'Réponse juste', correct: true },
    { key: 'C', label: 'Distracteur deux', correct: false, distractorRationale: 'Erreur de calcul.' },
    { key: 'D', label: 'Distracteur trois', correct: false, distractorRationale: 'Erreur de lecture.' },
  ] }],
});

const catalog = (nodeId = '5e.maths.calcul.fixture') => ({
  schemaVersion: 'nexus-cps-catalog/v1' as const,
  slug: 'fixture-cps-v1', version: 1,
  nodes: [{ id: nodeId, label: 'Calcul', sourceLevel: 'CINQUIEME' as const, targetLevel: 'QUATRIEME' as const, pedagogicalRationale: 'Prérequis structurant explicite.' }],
});

describe('bank validation contracts V1 and V2', () => {
  test.each(['4E-MAT-CAL-01', 'ESE-MAT-CAL-01', 'EPR-PHC-MOL-01'])(
    'accepts canonical identifier %s',
    (id) => expect(BANK_ITEM_ID_PATTERN.test(id)).toBe(true),
  );

  test.each([
    'E-MAT-CAL-01',
    'LONG-MAT-CAL-01',
    '4e-MAT-CAL-01',
    '4E-M@T-CAL-01',
    '4E-MAT-AB-01',
    '4E-MAT-CAL-1',
  ])('rejects non-canonical identifier %s', (id) => expect(BANK_ITEM_ID_PATTERN.test(id)).toBe(false));

  it('accepts an explicit interdisciplinary bank-to-CPS relation', () => {
    const interdisciplinary = bank('PHILOSOPHIE', '1re.francais.argumentation.fixture');
    const frenchCatalog = {
      ...catalog('1re.francais.argumentation.fixture'),
      nodes: [{
        id: '1re.francais.argumentation.fixture', label: 'Argumentation', sourceLevel: 'PREMIERE' as const,
        targetLevel: 'TERMINALE' as const, pedagogicalRationale: 'Le raisonnement argumentatif précède la philosophie.',
      }],
    };
    const terminaleBank = { ...interdisciplinary, level: 'TERMINALE' };
    expect(validateBankSource(terminaleBank, frenchCatalog).filter(({ rule }) => rule === 'V2')).toEqual([]);
  });

  it('reports a real CPS collision across catalogues', () => {
    const first = { bank: bank(), catalog: catalog() };
    const second = {
      bank: { ...bank(), slug: 'second-bank-v1', items: [item('4E-MAT-ALT-01'), item('4E-MAT-ALT-02')] },
      catalog: { ...catalog(), slug: 'another-catalog', nodes: [{ ...catalog().nodes[0], sourceLevel: 'QUATRIEME' as const }] },
    };
    expect(validateBankCollection([first, second]).some(({ message }) => message.includes('CPS collision'))).toBe(true);
  });
});
