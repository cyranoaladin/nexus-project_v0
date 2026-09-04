import {
  isFullyNormalized,
  normalizeBrancheBascule,
  normalizeLevel,
  normalizeModalite,
  normalizeOptionCode,
  normalizePublicCandidateInput,
  normalizeStaffExtension,
  normalizeSubject,
  type PublicCandidateInputRaw,
} from '@/lib/exams/normalize';

describe('normalizeSubject — codes stables, jamais de défaut plausible', () => {
  test('résout un code connu', () => {
    expect(normalizeSubject('MATHEMATIQUES')).toEqual({ status: 'RESOLVED', value: 'MATHEMATIQUES' });
  });

  test('tolère la casse/espaces sans jamais fuzzy-matcher au-delà', () => {
    expect(normalizeSubject('mathematiques')).toEqual({ status: 'RESOLVED', value: 'MATHEMATIQUES' });
    expect(normalizeSubject('  NSI  ')).toEqual({ status: 'RESOLVED', value: 'NSI' });
  });

  test('absent (jamais fourni) distinct de inconnu (fourni mais non résolu)', () => {
    expect(normalizeSubject(undefined)).toEqual({ status: 'ABSENT' });
    expect(normalizeSubject(null)).toEqual({ status: 'ABSENT' });
    expect(normalizeSubject('')).toEqual({ status: 'ABSENT' });
    expect(normalizeSubject('Chimie Organique Avancée')).toEqual({ status: 'UNRESOLVED', raw: 'Chimie Organique Avancée' });
  });

  test('ne devine jamais un code proche pour une entrée non reconnue', () => {
    const result = normalizeSubject('MATHS');
    expect(result.status).toBe('UNRESOLVED');
  });
});

describe('normalizeLevel / normalizeModalite', () => {
  test('résout PREMIERE/TERMINALE, tolère l\'accent', () => {
    expect(normalizeLevel('Première')).toEqual({ status: 'RESOLVED', value: 'PREMIERE' });
    expect(normalizeLevel('terminale')).toEqual({ status: 'RESOLVED', value: 'TERMINALE' });
  });

  test('modalité A/B, rejette toute autre valeur', () => {
    expect(normalizeModalite('a')).toEqual({ status: 'RESOLVED', value: 'A' });
    expect(normalizeModalite('C')).toEqual({ status: 'UNRESOLVED', raw: 'C' });
  });
});

describe('normalizeOptionCode — DGMEC -> DGEMC (réutilise lib/exams/options.ts, ne duplique pas)', () => {
  test('normalise DGMEC en DGEMC', () => {
    expect(normalizeOptionCode('DGMEC')).toEqual({ status: 'RESOLVED', value: 'DGEMC' });
  });

  test('option inconnue -> UNRESOLVED, jamais acceptée par défaut', () => {
    expect(normalizeOptionCode('LATIN_AVANCE')).toEqual({ status: 'UNRESOLVED', raw: 'LATIN_AVANCE' });
  });
});

describe('normalizeBrancheBascule', () => {
  test('résout les deux valeurs connues', () => {
    expect(normalizeBrancheBascule('conservation_moyennes_premiere').status).toBe('RESOLVED');
    expect(normalizeBrancheBascule('renonciation_moyennes_premiere').status).toBe('RESOLVED');
  });
});

describe('normalizePublicCandidateInput — vue d\'ensemble + piste d\'audit', () => {
  function raw(overrides: Partial<PublicCandidateInputRaw> = {}): PublicCandidateInputRaw {
    return {
      level: 'TERMINALE',
      modalite: 'A',
      specialite1: 'MATHEMATIQUES',
      specialite2: 'PHYSIQUE_CHIMIE',
      examSession: 2027,
      ...overrides,
    };
  }

  test('un profil entièrement résolu est isFullyNormalized', () => {
    const normalized = normalizePublicCandidateInput(raw());
    expect(isFullyNormalized(normalized)).toBe(true);
    expect(Object.keys(normalized.auditTrail)).toHaveLength(0);
  });

  test('une spécialité inconnue rend le profil non entièrement normalisé et alimente la piste d\'audit', () => {
    const normalized = normalizePublicCandidateInput(raw({ specialite1: 'Chimie Quantique' }));
    expect(isFullyNormalized(normalized)).toBe(false);
    expect(normalized.auditTrail.specialite1).toBe('Chimie Quantique');
  });

  test('une option DGMEC normalisée en DGEMC reste tracée dans auditTrail (valeur originale conservée)', () => {
    const normalized = normalizePublicCandidateInput(raw({ optionsTerminale: ['DGMEC'] }));
    expect(normalized.optionsTerminale[0]).toEqual({ status: 'RESOLVED', value: 'DGEMC' });
    expect(normalized.auditTrail['optionsTerminale[0]']).toBe('DGMEC');
  });

  test('champs booléens absents reçoivent leur défaut structurel documenté, jamais un défaut sur un champ de code', () => {
    const normalized = normalizePublicCandidateInput(raw());
    expect(normalized.estRedoublant).toBe(false);
    expect(normalized.intentionCycleComplet).toBe(true);
  });

  test('specialiteAbandonnee absente reste ABSENT (jamais confondue avec une valeur inconnue)', () => {
    const normalized = normalizePublicCandidateInput(raw());
    expect(normalized.specialiteAbandonnee).toEqual({ status: 'ABSENT' });
  });
});

describe('normalizeStaffExtension — pass-through strict, jamais de normalisation de texte libre', () => {
  test('conserve mécanisme/statut tels quels (déjà structurés par un formulaire staff)', () => {
    const result = normalizeStaffExtension({
      notesConservees: [{ epreuveId: 'eds1', note: 14, sessionObtention: 2026, mecanisme: 'CONSERVATION_DEMANDEE' }],
      dispensesDeclarees: [{ epreuveId: 'eds2', statut: 'DECLAREE' }],
    });
    expect(result.notesConservees).toHaveLength(1);
    expect(result.dispensesDeclarees).toHaveLength(1);
  });

  test('absence -> tableaux vides, jamais null/undefined propagé', () => {
    const result = normalizeStaffExtension({});
    expect(result.notesConservees).toEqual([]);
    expect(result.dispensesDeclarees).toEqual([]);
  });
});
