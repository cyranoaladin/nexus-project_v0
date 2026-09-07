/**
 * Inscriptions académiques — résolution et validation.
 *
 * Vérifie l'invariant central : un enseignement n'est « suivi » que s'il est
 * imposé par le niveau et la voie, ou s'il fait l'objet d'une inscription.
 * Aucune sélection produit ne peut le rendre vrai.
 */

import {
  isEnrolledIn,
  listEnrolledSpecialties,
  listFollowedCourses,
  resolveStudentCourses,
  type EnrollmentRecord,
} from '@/lib/curriculum/enrollment';
import { validateChosenCourses } from '@/lib/curriculum/validation';
import { getCourse } from '@/lib/curriculum/catalog';

const TERMINALE_EDS = {
  gradeLevel: 'TERMINALE',
  academicTrack: 'EDS_GENERALE',
  stmgPathway: null,
};

const PREMIERE_STMG = {
  gradeLevel: 'PREMIERE',
  academicTrack: 'STMG',
  stmgPathway: 'GF',
};

function enrollment(courseKey: string, kind: EnrollmentRecord['kind']): EnrollmentRecord {
  return { courseKey, kind, source: 'ADMIN' };
}

function statusOf(views: ReturnType<typeof resolveStudentCourses>, courseKey: string) {
  return views.find((view) => view.course.courseKey === courseKey)?.academicStatus;
}

describe('resolveStudentCourses', () => {
  const views = resolveStudentCourses(TERMINALE_EDS, [
    enrollment('eds-maths-terminale', 'SPECIALTY'),
    enrollment('eds-nsi-terminale', 'SPECIALTY'),
  ]);

  it('marque les spécialités inscrites comme réellement suivies', () => {
    expect(statusOf(views, 'eds-maths-terminale')).toBe('ENROLLED');
    expect(statusOf(views, 'eds-nsi-terminale')).toBe('ENROLLED');
  });

  it('dérive le tronc commun du niveau et de la voie', () => {
    expect(statusOf(views, 'tc-philosophie-terminale')).toBe('DERIVED');
    expect(statusOf(views, 'tc-grand-oral-terminale')).toBe('DERIVED');
    expect(statusOf(views, 'tc-emc-terminale')).toBe('DERIVED');
  });

  it('ne présente jamais une spécialité non choisie comme suivie', () => {
    expect(statusOf(views, 'eds-svt-terminale')).toBe('NOT_ENROLLED');
    expect(statusOf(views, 'eds-ses-terminale')).toBe('NOT_ENROLLED');
  });

  it('ne dérive JAMAIS une option : sans inscription, elle n’est pas suivie', () => {
    // Une option ne se déduit pas du niveau. C'est exactement le piège que le
    // modèle précédent tendait, en confondant sélection produit et vérité scolaire.
    expect(statusOf(views, 'opt-maths-expertes-terminale')).toBe('NOT_ENROLLED');
    expect(statusOf(views, 'opt-maths-complementaires-terminale')).toBe('NOT_ENROLLED');
  });

  it('marque une option suivie dès qu’une inscription existe', () => {
    const withOption = resolveStudentCourses(TERMINALE_EDS, [
      enrollment('eds-maths-terminale', 'SPECIALTY'),
      enrollment('opt-maths-expertes-terminale', 'OPTION'),
    ]);
    expect(statusOf(withOption, 'opt-maths-expertes-terminale')).toBe('ENROLLED');
  });

  it('dérive les modules STMG et n’expose aucune spécialité générale', () => {
    const stmg = resolveStudentCourses(PREMIERE_STMG, []);
    expect(statusOf(stmg, 'stmg-sgn-premiere')).toBe('DERIVED');
    expect(statusOf(stmg, 'stmg-management-premiere')).toBe('DERIVED');
    expect(statusOf(stmg, 'stmg-droit-eco-premiere')).toBe('DERIVED');
    expect(stmg.some((view) => view.course.kind === 'SPECIALTY')).toBe(false);
  });

  it('retourne une carte vide quand le niveau ou la voie manque', () => {
    expect(resolveStudentCourses({ gradeLevel: null, academicTrack: null, stmgPathway: null }, [])).toEqual([]);
  });

  it('expose une inscription devenue hors niveau plutôt que de la masquer', () => {
    const afterLevelChange = resolveStudentCourses(TERMINALE_EDS, [
      enrollment('eds-maths-premiere', 'SPECIALTY'),
    ]);
    expect(statusOf(afterLevelChange, 'eds-maths-premiere')).toBe('ENROLLED');
  });

  it('distingue cours suivis et cours simplement proposables', () => {
    expect(listFollowedCourses(views).every((view) => view.academicStatus !== 'NOT_ENROLLED')).toBe(true);
    expect(listEnrolledSpecialties(views).map((view) => view.course.courseKey)).toEqual([
      'eds-maths-terminale',
      'eds-nsi-terminale',
    ]);
  });

  it('répond sur l’inscription à un cours donné', () => {
    const rows = [enrollment('eds-nsi-terminale', 'SPECIALTY')];
    expect(isEnrolledIn(rows, 'eds-nsi-terminale')).toBe(true);
    expect(isEnrolledIn(rows, 'eds-maths-terminale')).toBe(false);
  });
});

describe('validateChosenCourses', () => {
  it('accepte une combinaison réelle', () => {
    expect(
      validateChosenCourses(TERMINALE_EDS, ['eds-maths-terminale', 'eds-nsi-terminale']),
    ).toEqual([]);
  });

  it('rejette un enseignement inconnu du catalogue', () => {
    expect(validateChosenCourses(TERMINALE_EDS, ['eds-bidon'])[0]).toContain('inconnu');
  });

  it('rejette un enseignement hors du niveau ou de la voie', () => {
    expect(validateChosenCourses(TERMINALE_EDS, ['eds-maths-premiere'])[0]).toContain('hors du niveau');
    expect(validateChosenCourses(TERMINALE_EDS, ['stmg-sgn-premiere'])[0]).toContain('hors du niveau');
  });

  it('refuse qu’un enseignement obligatoire soit déclaré comme un choix', () => {
    expect(validateChosenCourses(TERMINALE_EDS, ['tc-philosophie-terminale'])[0]).toContain(
      'obligatoire',
    );
  });

  it('applique le plafond de spécialités du niveau', () => {
    const issues = validateChosenCourses(TERMINALE_EDS, [
      'eds-maths-terminale',
      'eds-nsi-terminale',
      'eds-svt-terminale',
    ]);
    expect(issues.some((issue) => issue.includes('au plus 2'))).toBe(true);

    expect(
      validateChosenCourses({ ...TERMINALE_EDS, gradeLevel: 'PREMIERE' }, [
        'eds-maths-premiere',
        'eds-nsi-premiere',
        'eds-physique-chimie-premiere',
      ]),
    ).toEqual([]);
  });

  it('exige le cours support d’une option', () => {
    expect(
      validateChosenCourses(TERMINALE_EDS, ['opt-maths-expertes-terminale'])[0],
    ).toContain('eds-maths-terminale');

    expect(
      validateChosenCourses(TERMINALE_EDS, [
        'eds-maths-terminale',
        'opt-maths-expertes-terminale',
      ]),
    ).toEqual([]);
  });

  it('signale les doublons', () => {
    expect(
      validateChosenCourses(TERMINALE_EDS, ['eds-maths-terminale', 'eds-maths-terminale']).some(
        (issue) => issue.includes('doublon'),
      ),
    ).toBe(true);
  });

  it('refuse toute déclaration tant que le niveau est inconnu', () => {
    expect(
      validateChosenCourses(
        { gradeLevel: null, academicTrack: null, stmgPathway: null },
        ['eds-maths-terminale'],
      )[0],
    ).toContain('niveau');
  });
});

describe('N4A — nouvelles spécialités (SES/SVT/HGGSP/HLP) et option DGEMC', () => {
  const PREMIERE_EDS = { gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', stmgPathway: null };
  const TERMINALE_STMG = { gradeLevel: 'TERMINALE', academicTrack: 'STMG', stmgPathway: 'GF' };

  it('accepte une combinaison de spécialités de terminale entièrement composée des nouvelles matières', () => {
    expect(
      validateChosenCourses(TERMINALE_EDS, ['eds-hggsp-terminale', 'eds-hlp-terminale']),
    ).toEqual([]);
  });

  it('applique toujours le plafond de 2 spécialités en terminale avec les nouvelles matières', () => {
    const issues = validateChosenCourses(TERMINALE_EDS, [
      'eds-hggsp-terminale',
      'eds-hlp-terminale',
      'eds-ses-terminale',
    ]);
    expect(issues.some((issue) => issue.includes('au plus 2'))).toBe(true);
  });

  it('applique toujours le plafond de 3 spécialités en première avec les nouvelles matières', () => {
    expect(
      validateChosenCourses(PREMIERE_EDS, [
        'eds-hggsp-premiere',
        'eds-hlp-premiere',
        'eds-ses-premiere',
      ]),
    ).toEqual([]);
    const issues = validateChosenCourses(PREMIERE_EDS, [
      'eds-hggsp-premiere',
      'eds-hlp-premiere',
      'eds-ses-premiere',
      'eds-svt-premiere',
    ]);
    expect(issues.some((issue) => issue.includes('au plus 3'))).toBe(true);
  });

  it('DGEMC (option) ne compte jamais dans le plafond de spécialités', () => {
    expect(
      validateChosenCourses(TERMINALE_EDS, [
        'eds-hggsp-terminale',
        'eds-hlp-terminale',
        'opt-dgemc-terminale',
      ]),
    ).toEqual([]);
  });

  it('DGEMC ne fabrique aucune dépendance de cours support inventée', () => {
    expect(getCourse('opt-dgemc-terminale')?.requiresCourseKey).toBeUndefined();
    expect(validateChosenCourses(TERMINALE_EDS, ['opt-dgemc-terminale'])).toEqual([]);
  });

  it('n’invente aucune dépendance requiresCourseKey entre SES/SVT/HGGSP/HLP', () => {
    for (const key of [
      'eds-ses-premiere', 'eds-ses-terminale',
      'eds-svt-premiere', 'eds-svt-terminale',
      'eds-hggsp-premiere', 'eds-hggsp-terminale',
      'eds-hlp-premiere', 'eds-hlp-terminale',
    ]) {
      expect(getCourse(key)?.requiresCourseKey).toBeUndefined();
    }
  });

  it('DGEMC est proposable à un élève de terminale technologique (STMG), pas seulement générale', () => {
    const dgemcApplicable = resolveStudentCourses(TERMINALE_STMG, [])
      .some((view) => view.course.courseKey === 'opt-dgemc-terminale');
    expect(dgemcApplicable).toBe(true);
  });

  it('une inscription ne dérive jamais un droit commercial ni une disponibilité RAG : la vue ne porte que le statut académique', () => {
    const views = resolveStudentCourses(TERMINALE_EDS, [
      enrollment('eds-hggsp-terminale', 'SPECIALTY'),
      enrollment('opt-dgemc-terminale', 'OPTION'),
    ]);
    const dgemcView = views.find((view) => view.course.courseKey === 'opt-dgemc-terminale');
    expect(dgemcView?.academicStatus).toBe('ENROLLED');
    // La vue académique ne porte que le cours, le statut et la source
    // d'inscription — jamais un droit commercial ni une disponibilité RAG.
    expect(Object.keys(dgemcView ?? {}).sort()).toEqual(
      ['academicStatus', 'course', 'enrollmentSource'],
    );
  });
});
