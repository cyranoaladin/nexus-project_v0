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
