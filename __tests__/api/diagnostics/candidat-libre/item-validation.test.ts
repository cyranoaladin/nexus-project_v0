/**
 * Validation pédagogique par item.
 *
 * Un item n'est montré à l'étudiant — score compris — que s'il a été relu et
 * validé par un enseignant qualifié. Deux propriétés portent tout le reste :
 *
 * - la validation **nomme** son relecteur, jamais implicitement ;
 * - elle porte l'**empreinte** de l'item relu, de sorte que modifier ensuite
 *   l'énoncé, les options ou la réponse attendue l'invalide au lieu de laisser
 *   la validation couvrir un contenu que personne n'a lu.
 */

const mockFindMany = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    candidateDiagnosticItemValidation: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
  },
}));

import {
  computeItemChecksum,
  filterValidatedScores,
  isItemValidated,
  loadValidationIndex,
} from '@/lib/diagnostics/candidat-libre/item-validation.server';

const ITEM = Object.freeze({
  id: 'math-01',
  prompt: 'Calculer : 3/4 − 5/8.',
  options: [{ id: 'a', label: '1/8' }, { id: 'b', label: '-1/8' }],
});
const ANSWER = Object.freeze({ kind: 'single', correct: 'b' });

describe('computeItemChecksum', () => {
  it('est stable pour un item inchangé', () => {
    expect(computeItemChecksum(ITEM, ANSWER)).toBe(computeItemChecksum(ITEM, ANSWER));
  });

  it('change si l’énoncé est modifié', () => {
    const modified = { ...ITEM, prompt: 'Calculer : 3/4 − 5/9.' };
    expect(computeItemChecksum(modified, ANSWER)).not.toBe(computeItemChecksum(ITEM, ANSWER));
  });

  it('change si une option est modifiée', () => {
    const modified = { ...ITEM, options: [{ id: 'a', label: '1/8' }, { id: 'b', label: '-3/8' }] };
    expect(computeItemChecksum(modified, ANSWER)).not.toBe(computeItemChecksum(ITEM, ANSWER));
  });

  /** Le cas le plus dangereux : l'énoncé ne bouge pas, la bonne réponse si. */
  it('change si la réponse attendue est modifiée', () => {
    expect(computeItemChecksum(ITEM, { kind: 'single', correct: 'a' }))
      .not.toBe(computeItemChecksum(ITEM, ANSWER));
  });

  it('produit une empreinte hexadécimale de longueur fixe', () => {
    expect(computeItemChecksum(ITEM, ANSWER)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('isItemValidated', () => {
  const checksum = computeItemChecksum(ITEM, ANSWER);

  it('reconnaît un item validé dont l’empreinte concorde', () => {
    const index = new Map([['math-01', { reviewerName: 'M. Marsani', itemChecksum: checksum, validatedAt: new Date() }]]);
    expect(isItemValidated(index, 'math-01', checksum)).toBe(true);
  });

  it('refuse un item jamais validé', () => {
    expect(isItemValidated(new Map(), 'math-01', checksum)).toBe(false);
  });

  /** Le point de tout le mécanisme. */
  it('refuse un item modifié après sa validation', () => {
    const index = new Map([['math-01', { reviewerName: 'M. Marsani', itemChecksum: checksum, validatedAt: new Date() }]]);
    const afterEdit = computeItemChecksum({ ...ITEM, prompt: 'Autre énoncé' }, ANSWER);
    expect(isItemValidated(index, 'math-01', afterEdit)).toBe(false);
  });
});

describe('filterValidatedScores — rétention d’autoScore', () => {
  const checksum = computeItemChecksum(ITEM, ANSWER);
  const index = new Map([['math-01', { reviewerName: 'M. Marsani', itemChecksum: checksum, validatedAt: new Date() }]]);

  it('expose le score d’un item validé', () => {
    const out = filterValidatedScores(
      [{ itemId: 'math-01', score: 2, checksum }],
      index,
    );
    expect(out).toEqual([{ itemId: 'math-01', score: 2 }]);
  });

  /** Un score non validé ne doit pas atteindre l'étudiant, même correct. */
  it('retient le score d’un item non validé', () => {
    const out = filterValidatedScores(
      [{ itemId: 'ses-01', score: 2, checksum: 'peu importe' }],
      index,
    );
    expect(out).toEqual([]);
  });

  it('retient le score d’un item modifié depuis sa validation', () => {
    const out = filterValidatedScores(
      [{ itemId: 'math-01', score: 2, checksum: 'empreinte-differente' }],
      index,
    );
    expect(out).toEqual([]);
  });

  it('ne laisse rien passer quand aucun item n’est validé', () => {
    const out = filterValidatedScores(
      [{ itemId: 'math-01', score: 2, checksum }, { itemId: 'nsi-01', score: 1, checksum }],
      new Map(),
    );
    expect(out).toEqual([]);
  });
});

describe('loadValidationIndex', () => {
  it('indexe les validations par identifiant d’item', async () => {
    mockFindMany.mockResolvedValue([
      { itemId: 'ses-01', reviewerName: 'M. Marsani', itemChecksum: 'abc', validatedAt: new Date('2026-08-08') },
    ]);
    const index = await loadValidationIndex();
    expect(index.get('ses-01')?.reviewerName).toBe('M. Marsani');
  });

  it('rend un index vide si rien n’est validé', async () => {
    mockFindMany.mockResolvedValue([]);
    expect((await loadValidationIndex()).size).toBe(0);
  });
});
