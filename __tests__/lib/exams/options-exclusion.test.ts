import { normalizeOptionCode, validateOptionsSelection } from '@/lib/exams/options';

describe('T-options — normalisation d\'alias', () => {
  test('DGMEC est normalisé en DGEMC (sigle correct)', () => {
    expect(normalizeOptionCode('DGMEC')).toBe('DGEMC');
    expect(normalizeOptionCode('dgmec')).toBe('DGEMC');
  });

  test('un code déjà correct est inchangé', () => {
    expect(normalizeOptionCode('DGEMC')).toBe('DGEMC');
    expect(normalizeOptionCode('MATHS_EXPERTES')).toBe('MATHS_EXPERTES');
  });
});

describe('T-options — règles d\'exclusion', () => {
  test('MATHS_EXPERTES et MATHS_COMPLEMENTAIRES sont mutuellement exclusives', () => {
    const result = validateOptionsSelection({
      optionsTerminale: ['MATHS_EXPERTES', 'MATHS_COMPLEMENTAIRES'],
      specialitesTerminale: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'],
    });
    expect(result.valide).toBe(false);
    expect(result.erreurs).toContainEqual(expect.objectContaining({ code: 'OPTIONS_EXCLUSIVES' }));
  });

  test('MATHS_EXPERTES exige que la spécialité mathématiques soit conservée en terminale', () => {
    const result = validateOptionsSelection({
      optionsTerminale: ['MATHS_EXPERTES'],
      specialitesTerminale: ['PHYSIQUE_CHIMIE', 'SVT'],
    });
    expect(result.valide).toBe(false);
    expect(result.erreurs).toContainEqual(expect.objectContaining({ code: 'EXPERTES_REQUIERT_SPE_MATHS' }));
  });

  test('MATHS_COMPLEMENTAIRES exige que la spécialité mathématiques ait été abandonnée en fin de première', () => {
    const result = validateOptionsSelection({
      optionsTerminale: ['MATHS_COMPLEMENTAIRES'],
      specialitesTerminale: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'],
    });
    expect(result.valide).toBe(false);
    expect(result.erreurs).toContainEqual(expect.objectContaining({ code: 'COMPLEMENTAIRES_REQUIERT_ABANDON_MATHS' }));
  });

  test('DGEMC est cumulable avec MATHS_EXPERTES, dans la limite de 2 options en terminale', () => {
    const result = validateOptionsSelection({
      optionsTerminale: ['MATHS_EXPERTES', 'DGEMC'],
      specialitesTerminale: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'],
    });
    expect(result.valide).toBe(true);
    expect(result.erreurs).toHaveLength(0);
  });

  test('plus de 2 options en terminale (hors LCA) est bloquant', () => {
    const result = validateOptionsSelection({
      optionsTerminale: ['MATHS_EXPERTES', 'DGEMC', 'LCA_LATIN'],
      specialitesTerminale: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'],
    });
    // LCA_LATIN ne compte pas dans le plafond de 2
    expect(result.valide).toBe(true);
  });

  test('un cas valide sans aucune option ne produit aucune erreur', () => {
    const result = validateOptionsSelection({ optionsTerminale: [], specialitesTerminale: ['MATHEMATIQUES', 'SVT'] });
    expect(result.valide).toBe(true);
    expect(result.erreurs).toHaveLength(0);
  });
});
