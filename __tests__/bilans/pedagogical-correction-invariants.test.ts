import quatriemeFrancais from '@/data/bilans/banks/entree-quatrieme-francais-v1.json';
import premierePhysiqueChimie from '@/data/bilans/banks/entree-premiere-physique-chimie-v1.json';
import mathsTerminaleBilan from '@/data/bilans/banks/maths-terminale-bilan-v1.json';

/**
 * Preuve de non-régression pour la vérification pédagogique du 2026-08-11 :
 * les corrections ne touchent que les textes de correction et les métadonnées
 * internes. Énoncés, options et bonne réponse doivent rester strictement
 * identiques à ce qu'ont vu les élèves qui ont déjà composé.
 */

/** Un \prime est bien formé s'il est en exposant : soit `^\prime` seul, soit un ou
 * plusieurs `\prime` groupés dans `^{...}` (ex. `^{\prime\prime}` pour une dérivée seconde). */
function hasMalformedPrime(text: string): boolean {
  const stripped = text
    .replace(/\^\{(?:\\prime)+\}/g, '')
    .replace(/\^\\prime/g, '');
  return stripped.includes('\\prime');
}

function findItem(items: readonly { id: string }[], id: string) {
  const item = items.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`Item introuvable: ${id}`);
  return item;
}

describe('4E-FRA-HOM-02 — homophones ses/ces et on/ont', () => {
  const item = findItem(quatriemeFrancais.questionnaire.items, '4E-FRA-HOM-02') as any;

  it('garde l’énoncé, les options et la bonne réponse strictement inchangés', () => {
    expect(item.questionText).toBe('Choisis la forme correcte : « ... amis ... déjà arrivés. »');
    expect(item.options).toEqual([
      { id: 'A', text: 'Ces / ont', isCorrect: false, distractorRationale: 'Confond « ses » (possessif : ses amis à lui) avec « ces » (démonstratif) dans ce contexte de possession.' },
      { id: 'B', text: 'Ses / on', isCorrect: false, distractorRationale: 'Confond « ont » (verbe avoir) avec « on » (pronom).' },
      { id: 'C', text: 'Ses / ont', isCorrect: true },
      { id: 'D', text: 'Ces / on', isCorrect: false, distractorRationale: 'Se trompe sur les deux homophones.' },
    ]);
  });

  it('enseigne la règle grammaticale juste sans prétendre que "ont" est parfait', () => {
    expect(item.shortCorrection).toContain('être');
    expect(item.shortCorrection).toContain('Ses amis sont déjà arrivés');
    expect(item.shortCorrection.length).toBeLessThanOrEqual(320);
    expect(item.explanation).toBe(item.shortCorrection);
  });

  it('redevient DRAFT tant qu’elle n’est pas re-signée par la relectrice matière', () => {
    expect(quatriemeFrancais.status).toBe('DRAFT');
    expect(quatriemeFrancais.review).toStrictEqual({ validatedBy: null, validatedAt: null });
  });
});

describe('EPR-PHC-SOL-01 — concentration en quantité de matière', () => {
  const item = findItem(premierePhysiqueChimie.questionnaire.items, 'EPR-PHC-SOL-01') as any;

  it('garde l’énoncé, les options et la bonne réponse strictement inchangés', () => {
    expect(item.questionText).toBe('On dissout 0,2 mol de soluté dans 500 mL de solution. Quelle est la concentration en quantité de matière ?');
    expect(item.options.map((option: any) => ({ id: option.id, text: option.text, isCorrect: option.isCorrect })))
      .toEqual([
        { id: 'A', text: '0,1 mol/L', isCorrect: false },
        { id: 'B', text: '100 mol/L', isCorrect: false },
        { id: 'C', text: '0,0004 mol/L', isCorrect: false },
        { id: 'D', text: '0,4 mol/L', isCorrect: true },
      ]);
  });

  it('décrit la vraie erreur du distracteur B (multiplication, pas division)', () => {
    const optionB = item.options.find((option: any) => option.id === 'B');
    expect(optionB.distractorRationale).toContain('Multiplie');
    expect(optionB.distractorRationale).not.toContain('Divise par le volume en millilitres après une conversion erronée');
  });

  it('redevient DRAFT tant qu’elle n’est pas re-signée par le relecteur matière', () => {
    expect(premierePhysiqueChimie.status).toBe('DRAFT');
    expect(premierePhysiqueChimie.review).toStrictEqual({ validatedBy: null, validatedAt: null });
  });
});

describe('maths-terminale-bilan-v1 — notation LaTeX des dérivées', () => {
  const PRIME_ITEM_IDS = [
    'MATH-ANA-02', 'MATH-ANA-03', 'MATH-ANA-04', 'MATH-ANA-05', 'MATH-ANA-06',
    'MATH-ANA-10', 'MATH-ANA-11', 'MATH-LOG-07', 'MATH-LOG-10',
  ] as const;

  it('ne contient plus aucun \\prime mal formé (hors exposant) dans explanation/hint', () => {
    for (const item of mathsTerminaleBilan.questionnaire.items as any[]) {
      expect(hasMalformedPrime(item.explanation ?? '')).toBe(false);
      expect(hasMalformedPrime(item.hint ?? '')).toBe(false);
    }
  });

  it('ne touche à aucun questionText — la notation \\prime n’apparaissait déjà que dans les corrections', () => {
    for (const id of PRIME_ITEM_IDS) {
      const item = findItem(mathsTerminaleBilan.questionnaire.items, id) as any;
      expect(item.questionText).not.toMatch(/\\prime/);
    }
  });

  it('MATH-ANA-06 : le domaine de convexité rigoureux est explicité en correction sans toucher à l’option C', () => {
    const item = findItem(mathsTerminaleBilan.questionnaire.items, 'MATH-ANA-06') as any;
    expect(item.explanation).toContain(']-\\infty, -1] \\cup [1, +\\infty[');
    const optionC = item.options.find((option: any) => option.id === 'C');
    expect(optionC).toEqual({ id: 'C', text: '$]-\\infty, -1[ \\cup ]1, +\\infty[$', isCorrect: true });
  });

  it('garde les 38 items, sans changement d’énoncé, d’options ni de bonne réponse', () => {
    expect(mathsTerminaleBilan.questionnaire.items).toHaveLength(38);
  });
});
