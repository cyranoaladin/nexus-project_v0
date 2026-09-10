/**
 * Intégrité du registre curriculum ARIA (P0).
 *
 * Ces tests protègent la règle anti-fake : aucune capacité ne peut être
 * déclarée sans artefact correspondant dans le dépôt.
 */

import { AcademicTrack, GradeLevel, Subject } from '@/types/enums';
import {
  ARIA_CATALOG_VERSION,
  buildSupportedGradeTrackMatrix,
  countCoursesBySupport,
  getAriaCourse,
  isKnownAriaCourseKey,
  listAriaCourseKeys,
  listAriaCourses,
  listCoursesForGradeAndTrack,
} from '@/lib/aria/curriculum/catalog';

/** Sujets RAG réellement déclarés par lib/rag-client.ts. */
const REAL_RAG_SUBJECTS = ['maths', 'nsi', 'physique_chimie', 'francais', 'svt', 'ses'];

/** Définitions diagnostiques réellement compilées dans le dépôt. */
const REAL_DEFINITION_KEYS = [
  'maths-premiere-p2',
  'maths-terminale-p2',
  'nsi-premiere-p2',
  'nsi-terminale-p2',
  'maths-premiere-stmg-p2',
  'sgn-premiere-stmg-p2',
  'management-premiere-stmg-p2',
  'droit-eco-premiere-stmg-p2',
];

describe('ARIA curriculum catalog', () => {
  it('expose une version stable', () => {
    expect(ARIA_CATALOG_VERSION).toBe('v1');
  });

  it('a des clés de cours uniques et en kebab-case ASCII', () => {
    const keys = listAriaCourseKeys();
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('ne déclare un skill graph que pour une définition réellement compilée', () => {
    for (const course of listAriaCourses()) {
      if (course.definitionKey !== null) {
        expect(REAL_DEFINITION_KEYS).toContain(course.definitionKey);
      }
      expect(course.support.capabilities.skillGraph).toBe(course.definitionKey !== null);
    }
  });

  it('ne déclare du RAG que pour un RAGSubject réellement supporté', () => {
    for (const course of listAriaCourses()) {
      if (course.ragSubject !== null) {
        expect(REAL_RAG_SUBJECTS).toContain(course.ragSubject);
      }
      expect(course.support.capabilities.rag).toBe(course.ragSubject !== null);
    }
  });

  it("ne déclare le chat que pour une matière acceptée par l'API chat", () => {
    const chatSubjects = Object.values(Subject) as string[];
    for (const course of listAriaCourses()) {
      if (course.chatSubject !== null) {
        expect(chatSubjects).toContain(course.chatSubject);
      }
      expect(course.support.capabilities.chat).toBe(course.chatSubject !== null);
    }
  });

  it('reproduit à l’identique le mapping d’entitlement existant (dette P1)', () => {
    for (const course of listAriaCourses()) {
      const expected = course.chatSubject === Subject.NSI ? 'aria_nsi' : 'aria_maths';
      expect(course.requiredFeature).toBe(expected);
    }
  });

  it('ne classe FULL que des cours cumulant skill graph + RAG + chat non approximatif', () => {
    for (const course of listAriaCourses()) {
      if (course.support.level !== 'FULL') continue;
      const caps = course.support.capabilities;
      expect(caps.skillGraph).toBe(true);
      expect(caps.rag).toBe(true);
      expect(caps.chat).toBe(true);
      expect(caps.chatSubjectIsApproximate).toBe(false);
    }
  });

  it("ne classe COMING_SOON que des cours sans aucune capacité", () => {
    for (const course of listAriaCourses()) {
      if (course.support.level !== 'COMING_SOON') continue;
      const caps = course.support.capabilities;
      expect(caps.skillGraph || caps.rag || caps.resources || caps.chat).toBe(false);
    }
  });

  it('couvre les quatre grands niveaux exigés', () => {
    const levels = new Set(listAriaCourses().map((c) => c.gradeLevel));
    expect(levels.has(GradeLevel.TROISIEME)).toBe(true);
    expect(levels.has(GradeLevel.SECONDE)).toBe(true);
    expect(levels.has(GradeLevel.PREMIERE)).toBe(true);
    expect(levels.has(GradeLevel.TERMINALE)).toBe(true);
  });

  it('couvre toutes les voies existantes', () => {
    const tracks = new Set(listAriaCourses().flatMap((c) => c.tracks));
    for (const track of Object.values(AcademicTrack)) {
      expect(tracks.has(track)).toBe(true);
    }
  });

  it('rattache les 8 définitions compilées à un cours du catalogue', () => {
    const declared = listAriaCourses()
      .map((c) => c.definitionKey)
      .filter((k): k is string => k !== null);
    for (const key of REAL_DEFINITION_KEYS) {
      expect(declared).toContain(key);
    }
  });

  it('déclare les 4 modules STMG de Première avec leur skill graph', () => {
    const stmgPremiere = listCoursesForGradeAndTrack(GradeLevel.PREMIERE, AcademicTrack.STMG);
    const keys = stmgPremiere.map((c) => c.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'maths-premiere-stmg',
        'sgn-premiere-stmg',
        'management-premiere-stmg',
        'droit-eco-premiere-stmg',
      ]),
    );
    for (const key of ['sgn-premiere-stmg', 'management-premiere-stmg', 'droit-eco-premiere-stmg']) {
      const course = getAriaCourse(key);
      expect(course?.definitionKey).not.toBeNull();
      // Le contexte chat reste SES : approximation explicitement signalée.
      expect(course?.support.capabilities.chatSubjectIsApproximate).toBe(true);
    }
  });

  it('signale Maths expertes comme non transmissible au chat', () => {
    const course = getAriaCourse('maths-expertes-terminale');
    expect(course).not.toBeNull();
    expect(course?.chatSubject).toBeNull();
    expect(course?.support.level).toBe('COMING_SOON');
  });

  it('ne prétend aucun RAG pour Philosophie ni Histoire-Géo', () => {
    for (const key of ['philosophie-terminale', 'histoire-geo-terminale']) {
      const course = getAriaCourse(key);
      expect(course?.ragSubject).toBeNull();
      expect(course?.support.capabilities.rag).toBe(false);
    }
  });

  it('retourne null (et ne lève pas) pour une clé inconnue', () => {
    expect(getAriaCourse('cours-inexistant')).toBeNull();
    expect(isKnownAriaCourseKey('cours-inexistant')).toBe(false);
    expect(isKnownAriaCourseKey('maths-terminale-eds')).toBe(true);
  });

  it('produit une matrice niveau × voie non vide', () => {
    const matrix = buildSupportedGradeTrackMatrix();
    expect(matrix[`${GradeLevel.TERMINALE}/${AcademicTrack.EDS_GENERALE}`]).toBeGreaterThan(0);
    expect(matrix[`${GradeLevel.PREMIERE}/${AcademicTrack.STMG}`]).toBeGreaterThan(0);
  });

  it("n'attribue EXTERNAL et RESOURCES_ONLY à aucun cours en P0", () => {
    const counts = countCoursesBySupport();
    expect(counts.EXTERNAL).toBe(0);
    expect(counts.RESOURCES_ONLY).toBe(0);
  });
});
