import {
  guardCandidateDiagnosticFeature,
  guardCandidateDiagnosticForStudent,
  isCandidateDiagnosticEnabledForStudent,
  isCandidateDiagnosticFeatureEnabled,
  listAllowedCandidateStudentIds,
} from '@/lib/diagnostics/candidat-libre/feature-flag';

/**
 * Allowlist par `studentId`.
 *
 * Le rôle `ELEVE_CANDIDAT_LIBRE` n'existe pas, et la fonctionnalité n'a aucun
 * contrôle d'éligibilité : le drapeau seul ouvrirait à tous les élèves et
 * parents de la base. L'allowlist remplace les deux — elle scope l'ouverture au
 * dossier réellement autorisé.
 *
 * Elle est **additive** : le kill switch garde son mot final, et une allowlist
 * vide ne peut pas ouvrir la fonctionnalité.
 */

const ORIGINAL_FLAG = process.env.CANDIDATE_DIAGNOSTIC_ENABLED;
const ORIGINAL_ALLOWLIST = process.env.CANDIDATE_DIAGNOSTIC_STUDENT_IDS;

function configure(flag?: string, allowlist?: string): void {
  if (flag === undefined) delete process.env.CANDIDATE_DIAGNOSTIC_ENABLED;
  else process.env.CANDIDATE_DIAGNOSTIC_ENABLED = flag;
  if (allowlist === undefined) delete process.env.CANDIDATE_DIAGNOSTIC_STUDENT_IDS;
  else process.env.CANDIDATE_DIAGNOSTIC_STUDENT_IDS = allowlist;
}

afterAll(() => {
  configure(ORIGINAL_FLAG, ORIGINAL_ALLOWLIST);
});

describe('listAllowedCandidateStudentIds', () => {
  it('est vide quand rien n’est configuré', () => {
    configure('true', undefined);
    expect(listAllowedCandidateStudentIds()).toEqual([]);
  });

  it('accepte une liste séparée par des virgules, en ignorant les espaces', () => {
    configure('true', ' stu_a , stu_b ,,stu_c ');
    expect(listAllowedCandidateStudentIds()).toEqual(['stu_a', 'stu_b', 'stu_c']);
  });

  it('déduplique sans changer l’ordre', () => {
    configure('true', 'stu_a,stu_b,stu_a');
    expect(listAllowedCandidateStudentIds()).toEqual(['stu_a', 'stu_b']);
  });
});

describe('isCandidateDiagnosticEnabledForStudent', () => {
  it('autorise un élève inscrit à l’allowlist', () => {
    configure('true', 'stu_autorise');
    expect(isCandidateDiagnosticEnabledForStudent('stu_autorise')).toBe(true);
  });

  it('refuse un élève absent de l’allowlist, drapeau allumé', () => {
    configure('true', 'stu_autorise');
    expect(isCandidateDiagnosticEnabledForStudent('stu_autre')).toBe(false);
  });

  /** Le kill switch garde le dernier mot : l'allowlist ne peut jamais l'outrepasser. */
  it('refuse même un élève de l’allowlist quand le drapeau est éteint', () => {
    configure(undefined, 'stu_autorise');
    expect(isCandidateDiagnosticEnabledForStudent('stu_autorise')).toBe(false);
  });

  it('refuse tout le monde quand l’allowlist est vide', () => {
    configure('true', '');
    expect(isCandidateDiagnosticEnabledForStudent('stu_autorise')).toBe(false);
  });

  it.each([undefined, null, ''])('refuse un studentId absent (%p)', (value) => {
    configure('true', 'stu_autorise');
    expect(isCandidateDiagnosticEnabledForStudent(value as unknown as string)).toBe(false);
  });

  it('n’ouvre pas par correspondance partielle', () => {
    configure('true', 'stu_autorise');
    expect(isCandidateDiagnosticEnabledForStudent('stu_autorise_bis')).toBe(false);
    expect(isCandidateDiagnosticEnabledForStudent('stu_autoris')).toBe(false);
  });
});

describe('guardCandidateDiagnosticForStudent', () => {
  it('laisse passer un élève autorisé', () => {
    configure('true', 'stu_autorise');
    expect(guardCandidateDiagnosticForStudent('stu_autorise')).toBeNull();
  });

  /**
   * 404 et non 403 : hors allowlist, la fonctionnalité doit paraître absente,
   * exactement comme lorsque le kill switch est éteint. Un 403 révélerait son
   * existence.
   */
  it('répond 404 pour un élève non autorisé', async () => {
    configure('true', 'stu_autorise');
    const response = guardCandidateDiagnosticForStudent('stu_autre');
    expect(response?.status).toBe(404);
    expect((await response?.json()).error).toBe('Not Found');
  });

  it('répond 404 quand le drapeau est éteint, allowlist non vide', () => {
    configure(undefined, 'stu_autorise');
    expect(guardCandidateDiagnosticForStudent('stu_autorise')?.status).toBe(404);
  });
});

describe('compatibilité avec le kill switch existant', () => {
  it('conserve le comportement global du drapeau', () => {
    configure('true', 'stu_a');
    expect(isCandidateDiagnosticFeatureEnabled()).toBe(true);
    expect(guardCandidateDiagnosticFeature()).toBeNull();

    configure(undefined, 'stu_a');
    expect(isCandidateDiagnosticFeatureEnabled()).toBe(false);
    expect(guardCandidateDiagnosticFeature()?.status).toBe(404);
  });

  it.each(['TRUE', '1', 'yes', 'on', ' true'])(
    'reste fermé pour une valeur de drapeau non conforme (%p)',
    (value) => {
      configure(value, 'stu_a');
      expect(isCandidateDiagnosticEnabledForStudent('stu_a')).toBe(false);
    },
  );
});
