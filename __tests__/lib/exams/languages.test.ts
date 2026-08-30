jest.mock('server-only', () => ({}));

import { requireExamPolicy } from '@/lib/exams/catalog';
import {
  LANGUAGE_CODES,
  LANGUAGE_LABELS,
  isLanguageCode,
  validateLanguagePair,
} from '@/lib/exams/languages';
import { normalizePublicCandidateInput, normalizeSubject } from '@/lib/exams/normalize';
import type { ProfilCandidatInput } from '@/lib/exams/parcours';
import { validateProfilCandidat } from '@/lib/exams/profile-validation';

const EXPECTED_LANGUAGES = ['ARABE', 'ANGLAIS', 'ESPAGNOL', 'ITALIEN', 'RUSSE', 'ALLEMAND'] as const;

function baseProfil(overrides: Partial<ProfilCandidatInput> = {}): ProfilCandidatInput {
  return {
    level: 'TERMINALE',
    examSession: 2027,
    modalite: 'A',
    specialite1: 'MATHEMATIQUES',
    specialite2: 'PHYSIQUE_CHIMIE',
    specialiteAbandonnee: null,
    langueA: null,
    langueB: null,
    estRedoublant: false,
    estTitulaireBacDejaObtenu: false,
    changementSpecialite: false,
    intentionAmelioration: false,
    intentionCycleComplet: true,
    brancheBascule: null,
    epreuvesDispenseesDeclarees: [],
    dispensesDeclarees: [],
    etalementPlurisessionsDeclare: false,
    moyenneRattrapage: null,
    optionsTerminale: [],
    notesConservees: [],
    ...overrides,
  };
}

describe('contrat canonique LVA/LVB', () => {
  test('expose exactement les six langues arbitrees et leurs libelles humains', () => {
    expect(LANGUAGE_CODES).toEqual(EXPECTED_LANGUAGES);
    expect(EXPECTED_LANGUAGES.map((code) => LANGUAGE_LABELS[code])).toEqual([
      'Arabe', 'Anglais', 'Espagnol', 'Italien', 'Russe', 'Allemand',
    ]);
  });

  test.each(EXPECTED_LANGUAGES)('%s est une langue autorisee', (code) => {
    expect(isLanguageCode(code)).toBe(true);
  });

  test.each(['PORTUGAIS', 'MATHEMATIQUES', '', null, undefined])('%p est refuse comme langue', (code) => {
    expect(isLanguageCode(code)).toBe(false);
  });

  test('accepte deux langues distinctes et refuse un doublon LVA/LVB', () => {
    expect(validateLanguagePair('ARABE', 'ALLEMAND')).toEqual({ valid: true, issues: [] });
    expect(validateLanguagePair('RUSSE', 'RUSSE')).toEqual({
      valid: false,
      issues: [{
        code: 'LANGUES_IDENTIQUES',
        field: 'langueB',
        message: 'La LVA et la LVB doivent être deux langues différentes.',
      }],
    });
  });
});

describe('normalisation contextuelle des langues et specialites', () => {
  test.each(['MATHS_EXPERTES', 'FRANCAIS', 'PHILOSOPHIE', 'HISTOIRE_GEO'])(
    '%s reste une matiere connue hors du contexte EDS V1',
    (code) => {
      expect(normalizeSubject(code)).toEqual({ status: 'RESOLVED', value: code });
    },
  );

  test.each(EXPECTED_LANGUAGES)('%s est resolue pour LVA et LVB', (code) => {
    const normalized = normalizePublicCandidateInput({
      level: 'TERMINALE', modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
      langueA: code, langueB: code === 'ARABE' ? 'ANGLAIS' : 'ARABE',
    });
    expect(normalized.langueA).toEqual({ status: 'RESOLVED', value: code });
    expect(normalized.langueB).toEqual({
      status: 'RESOLVED',
      value: code === 'ARABE' ? 'ANGLAIS' : 'ARABE',
    });
  });

  test.each(['PORTUGAIS', 'MATHEMATIQUES'])('%s reste non resolue comme LVA', (code) => {
    const normalized = normalizePublicCandidateInput({
      level: 'TERMINALE', modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', langueA: code,
    });
    expect(normalized.langueA).toEqual({ status: 'UNRESOLVED', raw: code });
  });

  test.each(['PORTUGAIS', 'MATHEMATIQUES'])('%s reste non resolue comme LVB', (code) => {
    const normalized = normalizePublicCandidateInput({
      level: 'TERMINALE', modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', langueB: code,
    });
    expect(normalized.langueB).toEqual({ status: 'UNRESOLVED', raw: code });
  });

  test('ARABE reste non resolue comme specialite', () => {
    const normalized = normalizePublicCandidateInput({
      level: 'TERMINALE', modalite: 'A', specialite1: 'ARABE', specialite2: 'NSI',
    });
    expect(normalized.specialite1).toEqual({ status: 'UNRESOLVED', raw: 'ARABE' });
  });
});

describe('validation reglementaire du profil', () => {
  const policy = requireExamPolicy(2027);

  test('refuse une matiere generale dans le champ LVA', () => {
    const result = validateProfilCandidat(policy, {
      profil: baseProfil({ langueA: 'MATHEMATIQUES' as ProfilCandidatInput['langueA'] }),
    });
    expect(result.erreurs).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'LANGUE_CODE_INVALIDE', field: 'langueA' }),
    ]));
  });

  test('refuse deux langues identiques', () => {
    const result = validateProfilCandidat(policy, {
      profil: baseProfil({ langueA: 'ANGLAIS', langueB: 'ANGLAIS' }),
    });
    expect(result.erreurs).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'LANGUES_IDENTIQUES', field: 'langueB' }),
    ]));
  });

  test('accepte un couple distinct parmi les six langues', () => {
    const result = validateProfilCandidat(policy, {
      profil: baseProfil({
        langueA: 'ARABE' as ProfilCandidatInput['langueA'],
        langueB: 'RUSSE' as ProfilCandidatInput['langueB'],
      }),
    });
    expect(result.erreurs.filter((issue) => issue.field === 'langueA' || issue.field === 'langueB')).toEqual([]);
  });

  test('refuse ARABE comme specialite', () => {
    const result = validateProfilCandidat(policy, {
      profil: baseProfil({ specialite1: 'ARABE' as ProfilCandidatInput['specialite1'] }),
    });
    expect(result.erreurs).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SPECIALITE_CODE_INCONNU', field: 'specialite1' }),
    ]));
  });
});
