/**
 * Hiérarchie des correspondances de foyer (saisie papier).
 *
 * Le cœur de la correction anti-doublon : le téléphone prime, l'homonymie sans
 * téléphone commun n'est qu'un avertissement, et la normalisation des noms
 * porte sur les deux champs séparément — jamais une concaténation.
 */

import {
  attachRequiresConfirmation,
  classifyHouseholdMatch,
  compareByStrength,
  normalizeNameKey,
  parentNamesMatch,
  type HouseholdCandidateFacts,
  type HouseholdMatchInput,
} from '@/lib/bilans/saisie-papier/household-matching';

describe('normalizeNameKey', () => {
  it('efface casse, accents, espaces multiples et bordures', () => {
    expect(normalizeNameKey('  Bénard  ')).toBe('benard');
    expect(normalizeNameKey('BENARD')).toBe('benard');
    expect(normalizeNameKey('bénard')).toBe('benard');
  });

  it('assimile trait d’union et apostrophe à un espace', () => {
    expect(normalizeNameKey('Jean-Pierre')).toBe(normalizeNameKey('Jean Pierre'));
    expect(normalizeNameKey("D'Angelo")).toBe(normalizeNameKey('D Angelo'));
    expect(normalizeNameKey('D’Angelo')).toBe(normalizeNameKey('d angelo'));
  });

  it('renvoie une chaîne vide pour une entrée sans lettre', () => {
    expect(normalizeNameKey('   ')).toBe('');
  });
});

describe('parentNamesMatch — deux champs, pas une concaténation', () => {
  it('colle quand prénom ET nom normalisés coïncident', () => {
    expect(parentNamesMatch(
      { firstName: 'Alaeddine', lastName: 'Ben Rhouma' },
      { firstName: 'alaeddine', lastName: 'ben rhouma' },
    )).toBe(true);
  });

  it('ne colle pas si la coupure prénom/nom diffère', () => {
    // « Ali Ben » + « Salah » ≠ « Ali » + « Ben Salah » même si la
    // concaténation « ali ben salah » serait identique.
    expect(parentNamesMatch(
      { firstName: 'Ali Ben', lastName: 'Salah' },
      { firstName: 'Ali', lastName: 'Ben Salah' },
    )).toBe(false);
  });

  it('refuse un champ vide', () => {
    expect(parentNamesMatch(
      { firstName: '', lastName: 'Bernard' },
      { firstName: '', lastName: 'Bernard' },
    )).toBe(false);
  });
});

const INPUT: HouseholdMatchInput = {
  parentFirstName: 'Claire',
  parentLastName: 'Bernard',
  phoneNormalized: '99192829',
  childLevels: ['TERMINALE'],
};

function candidate(overrides: Partial<HouseholdCandidateFacts> = {}): HouseholdCandidateFacts {
  return {
    parentFirstName: 'Claire',
    parentLastName: 'Bernard',
    phoneNormalized: '55000000',
    mergedSourcePhonesNormalized: [],
    childLevels: [],
    ...overrides,
  };
}

describe('classifyHouseholdMatch — hiérarchie des signaux', () => {
  it('téléphone identique → signal fort PHONE, quel que soit le nom', () => {
    expect(classifyHouseholdMatch(INPUT, candidate({
      phoneNormalized: '99192829',
      parentFirstName: 'Autre',
      parentLastName: 'Nom',
    }))).toBe('PHONE');
  });

  it('téléphone d’un compte source fusionné → PHONE', () => {
    expect(classifyHouseholdMatch(INPUT, candidate({
      phoneNormalized: '55000000',
      mergedSourcePhonesNormalized: ['99192829'],
    }))).toBe('PHONE');
  });

  it('même nom, téléphone différent, niveau enfant commun → NAME_AND_LEVEL', () => {
    expect(classifyHouseholdMatch(INPUT, candidate({
      childLevels: ['TERMINALE'],
    }))).toBe('NAME_AND_LEVEL');
  });

  it('même nom, téléphone différent, aucun niveau commun → NAME_ONLY', () => {
    expect(classifyHouseholdMatch(INPUT, candidate({
      childLevels: ['SECONDE'],
    }))).toBe('NAME_ONLY');
  });

  it('ni téléphone ni nom → aucun signal', () => {
    expect(classifyHouseholdMatch(INPUT, candidate({
      parentFirstName: 'Autre',
      parentLastName: 'Nom',
    }))).toBeNull();
  });
});

describe('attachRequiresConfirmation — le rattachement délibéré', () => {
  it('n’exige rien sur le signal fort', () => {
    expect(attachRequiresConfirmation('PHONE')).toBe(false);
  });

  it('exige une confirmation sur toute correspondance de nom', () => {
    expect(attachRequiresConfirmation('NAME_AND_LEVEL')).toBe(true);
    expect(attachRequiresConfirmation('NAME_ONLY')).toBe(true);
  });
});

describe('compareByStrength — présentation du fort vers l’homonymie', () => {
  it('trie PHONE avant NAME_AND_LEVEL avant NAME_ONLY', () => {
    const order = ['NAME_ONLY', 'PHONE', 'NAME_AND_LEVEL'] as const;
    expect([...order].sort(compareByStrength)).toEqual(['PHONE', 'NAME_AND_LEVEL', 'NAME_ONLY']);
  });
});
