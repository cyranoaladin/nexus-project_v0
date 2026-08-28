/**
 * Resolver curriculum ARIA — dérivation de la carte scolaire.
 *
 * Vérifie surtout la séparation stricte des quatre dimensions d'accès :
 * académique / produit / commercial / sélection.
 */

import { AcademicTrack, GradeLevel, StmgPathway, Subject } from '@/types/enums';
import {
  listSelectableCourseKeys,
  resolveAriaCurriculum,
  type ResolveAriaCurriculumInput,
} from '@/lib/aria/curriculum/resolver';

function input(overrides: Partial<ResolveAriaCurriculumInput> = {}): ResolveAriaCurriculumInput {
  return {
    gradeLevel: GradeLevel.TERMINALE,
    academicTrack: AcademicTrack.EDS_GENERALE,
    specialties: [Subject.MATHEMATIQUES],
    stmgPathway: null,
    school: null,
    selectedCourseKeys: [],
    entitlements: ['aria_maths'],
    ...overrides,
  };
}

function viewOf(result: ReturnType<typeof resolveAriaCurriculum>, key: string) {
  return result.courses.find((c) => c.course.key === key);
}

describe('resolveAriaCurriculum', () => {
  describe('Première EDS Mathématiques', () => {
    const result = resolveAriaCurriculum(
      input({
        gradeLevel: GradeLevel.PREMIERE,
        specialties: [Subject.MATHEMATIQUES],
      }),
    );

    it('inclut la spécialité Maths avec son skill graph', () => {
      const maths = viewOf(result, 'maths-premiere-eds');
      expect(maths).toBeDefined();
      expect(maths?.course.hasSkillGraph).toBe(true);
      expect(maths?.course.support).toBe('FULL');
      expect(maths?.access.academicallyRelevant).toBe(true);
    });

    it('inclut le Français des épreuves anticipées au tronc commun', () => {
      const francais = viewOf(result, 'francais-premiere');
      expect(francais).toBeDefined();
      expect(francais?.access.academicallyRelevant).toBe(true);
      expect(result.requiredCourseKeys).toContain('francais-premiere');
    });

    it("n'inclut aucune spécialité non suivie", () => {
      expect(viewOf(result, 'nsi-premiere-eds')).toBeUndefined();
      expect(viewOf(result, 'svt-premiere-eds')).toBeUndefined();
    });

    it("n'inclut aucun module STMG", () => {
      expect(viewOf(result, 'sgn-premiere-stmg')).toBeUndefined();
      expect(viewOf(result, 'maths-premiere-stmg')).toBeUndefined();
    });
  });

  describe('Terminale EDS Maths + NSI', () => {
    const result = resolveAriaCurriculum(
      input({
        specialties: [Subject.MATHEMATIQUES, Subject.NSI],
        entitlements: ['aria_maths'],
      }),
    );

    it('inclut les deux spécialités', () => {
      expect(viewOf(result, 'maths-terminale-eds')?.course.support).toBe('FULL');
      expect(viewOf(result, 'nsi-terminale-eds')?.course.support).toBe('FULL');
    });

    it('verrouille NSI commercialement sans entitlement aria_nsi', () => {
      const nsi = viewOf(result, 'nsi-terminale-eds');
      expect(nsi?.access.productSupported).toBe(true);
      expect(nsi?.access.commerciallyEntitled).toBe(false);
      expect(result.lockedCourseKeys).toContain('nsi-terminale-eds');
      expect(result.availableCourseKeys).not.toContain('nsi-terminale-eds');
    });

    it('débloque NSI dès que aria_nsi est actif', () => {
      const withNsi = resolveAriaCurriculum(
        input({
          specialties: [Subject.MATHEMATIQUES, Subject.NSI],
          entitlements: ['aria_maths', 'aria_nsi'],
        }),
      );
      expect(withNsi.availableCourseKeys).toContain('nsi-terminale-eds');
      expect(withNsi.lockedCourseKeys).not.toContain('nsi-terminale-eds');
    });

    it('classe Philosophie comme suivie mais sans base documentaire', () => {
      const philo = viewOf(result, 'philosophie-terminale');
      expect(philo?.access.academicallyRelevant).toBe(true);
      expect(philo?.course.capabilities.rag).toBe(false);
      expect(philo?.course.capabilities.chat).toBe(true);
    });

    it('classe EMC comme suivi mais non supporté par le produit', () => {
      const emc = viewOf(result, 'emc-terminale');
      expect(emc?.access.academicallyRelevant).toBe(true);
      expect(emc?.access.productSupported).toBe(false);
      expect(result.unsupportedCourseKeys).toContain('emc-terminale');
    });

    it("n'expose une option que si l'élève l'a explicitement retenue", () => {
      const sansOption = viewOf(result, 'maths-complementaires-terminale');
      expect(sansOption?.access.academicallyRelevant).toBe(false);
      expect(result.requiredCourseKeys).not.toContain('maths-complementaires-terminale');

      const avecOption = resolveAriaCurriculum(
        input({
          specialties: [Subject.MATHEMATIQUES],
          selectedCourseKeys: ['maths-complementaires-terminale'],
        }),
      );
      expect(
        viewOf(avecOption, 'maths-complementaires-terminale')?.access.academicallyRelevant,
      ).toBe(true);
    });
  });

  describe('Première STMG', () => {
    const result = resolveAriaCurriculum(
      input({
        gradeLevel: GradeLevel.PREMIERE,
        academicTrack: AcademicTrack.STMG,
        specialties: [],
        stmgPathway: StmgPathway.INDETERMINE,
      }),
    );

    it('inclut les quatre modules de la voie', () => {
      for (const key of [
        'maths-premiere-stmg',
        'sgn-premiere-stmg',
        'management-premiere-stmg',
        'droit-eco-premiere-stmg',
      ]) {
        expect(viewOf(result, key)?.access.academicallyRelevant).toBe(true);
        expect(result.requiredCourseKeys).toContain(key);
      }
    });

    it('inclut le Français/EAF du tronc commun', () => {
      expect(viewOf(result, 'francais-premiere')).toBeDefined();
    });

    it('signale l’approximation de matière sur les modules SGN/Management/Droit-Éco', () => {
      for (const key of ['sgn-premiere-stmg', 'management-premiere-stmg', 'droit-eco-premiere-stmg']) {
        const view = viewOf(result, key);
        expect(view?.course.capabilities.chatSubjectIsApproximate).toBe(true);
        expect(view?.course.support).toBe('PARTIAL');
      }
    });

    it("n'exige pas de spécialités EDS pour une Première STMG", () => {
      expect(result.academicProfile.incomplete).toBe(false);
    });
  });

  describe('parcours STMG de Terminale', () => {
    it('n’expose que le parcours réellement suivi', () => {
      const result = resolveAriaCurriculum(
        input({
          gradeLevel: GradeLevel.TERMINALE,
          academicTrack: AcademicTrack.STMG,
          specialties: [],
          stmgPathway: StmgPathway.GF,
        }),
      );
      expect(viewOf(result, 'parcours-gf-terminale-stmg')).toBeDefined();
      expect(viewOf(result, 'parcours-rhc-terminale-stmg')).toBeUndefined();
      expect(viewOf(result, 'parcours-sig-terminale-stmg')).toBeUndefined();
    });
  });

  describe('profil incomplet', () => {
    it('signale un niveau manquant et retourne une carte vide', () => {
      const result = resolveAriaCurriculum(input({ gradeLevel: null }));
      expect(result.academicProfile.incomplete).toBe(true);
      expect(result.academicProfile.missingFields).toContain('gradeLevel');
      expect(result.courses).toHaveLength(0);
    });

    it('signale une voie manquante', () => {
      const result = resolveAriaCurriculum(input({ academicTrack: null }));
      expect(result.academicProfile.incomplete).toBe(true);
      expect(result.academicProfile.missingFields).toContain('academicTrack');
    });

    it('signale des spécialités manquantes en Terminale générale', () => {
      const result = resolveAriaCurriculum(input({ specialties: [] }));
      expect(result.academicProfile.missingFields).toContain('specialties');
    });

    it('signale un parcours STMG manquant en Terminale STMG', () => {
      const result = resolveAriaCurriculum(
        input({
          gradeLevel: GradeLevel.TERMINALE,
          academicTrack: AcademicTrack.STMG,
          specialties: [],
          stmgPathway: null,
        }),
      );
      expect(result.academicProfile.missingFields).toContain('stmgPathway');
    });
  });

  describe('sélection', () => {
    it('ignore une clé de cours inconnue', () => {
      const result = resolveAriaCurriculum(
        input({ selectedCourseKeys: ['cours-inexistant'] }),
      );
      expect(result.selectedCourseKeys).not.toContain('cours-inexistant');
    });

    it('ignore une clé académiquement non applicable', () => {
      const result = resolveAriaCurriculum(
        input({ selectedCourseKeys: ['sgn-premiere-stmg'] }),
      );
      expect(result.selectedCourseKeys).not.toContain('sgn-premiere-stmg');
    });

    it('marque la sélection sans jamais toucher aux droits commerciaux', () => {
      const result = resolveAriaCurriculum(
        input({
          specialties: [Subject.MATHEMATIQUES, Subject.NSI],
          selectedCourseKeys: ['nsi-terminale-eds'],
          entitlements: ['aria_maths'],
        }),
      );
      const nsi = viewOf(result, 'nsi-terminale-eds');
      expect(nsi?.access.selectedForAria).toBe(true);
      expect(nsi?.access.commerciallyEntitled).toBe(false);
    });
  });

  describe('listSelectableCourseKeys', () => {
    it('rejette les cours hors scolarité', () => {
      const keys = listSelectableCourseKeys({
        gradeLevel: GradeLevel.TERMINALE,
        academicTrack: AcademicTrack.EDS_GENERALE,
        specialties: [Subject.MATHEMATIQUES],
        stmgPathway: null,
        school: null,
      });
      expect(keys).toContain('maths-terminale-eds');
      expect(keys).not.toContain('nsi-terminale-eds');
      expect(keys).not.toContain('sgn-premiere-stmg');
    });

    it('retourne une liste vide si le profil est incomplet', () => {
      expect(
        listSelectableCourseKeys({
          gradeLevel: null,
          academicTrack: null,
          specialties: [],
          stmgPathway: null,
          school: null,
        }),
      ).toHaveLength(0);
    });
  });
});
