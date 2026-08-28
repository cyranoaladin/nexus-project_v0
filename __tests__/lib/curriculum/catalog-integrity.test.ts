/**
 * Intégrité du catalogue d'enseignements.
 *
 * Ces tests protègent les invariants qui, s'ils cèdent, produisent une carte
 * scolaire fausse : provenance non prouvée, fausses spécialités, et
 * approximation d'un module STMG par une matière générique.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  getCourse,
  getCourseSources,
  getMaxSpecialties,
  getSpecialtyRuleSources,
  hasOfficialProvenance,
  listCourses,
  listCoursesFor,
  listCoursesWithProgrammeSelector,
  listSources,
  listSpecialtyCourses,
  resolveCourseProgramme,
} from '@/lib/curriculum/catalog';

describe('provenance', () => {
  it('donne au moins une source à chaque enseignement', () => {
    for (const course of listCourses()) {
      expect(course.sourceRefs.length).toBeGreaterThan(0);
      expect(getCourseSources(course.courseKey).length).toBe(course.sourceRefs.length);
    }
  });

  it('NO_UNSOURCED_PROVENANCE : chaque source est réellement atteignable', () => {
    for (const source of listSources()) {
      const reachable = Boolean(source.url) || Boolean(source.repoRef);
      expect(reachable).toBe(true);
    }
  });

  it('vérifie sur disque chaque source qui référence un fichier du dépôt', () => {
    for (const source of listSources()) {
      if (!source.repoRef) continue;
      const absolute = path.join(process.cwd(), source.repoRef);
      expect(existsSync(absolute)).toBe(true);
    }
  });

  it("ne laisse aucune source officielle sans URL ni document du dépôt", () => {
    for (const source of listSources()) {
      if (source.kind !== 'OFFICIAL_PROGRAMME') continue;
      expect(source.url).toBeDefined();
    }
  });

  it("n'attribue jamais une provenance officielle à une source Nexus", () => {
    for (const source of listSources()) {
      if (source.kind === 'NEXUS_PROGRAMME_MAPPING' || source.kind === 'NEXUS_COMMERCIAL_SCOPE') {
        expect(source.publisher).toContain('Nexus');
      }
    }
  });

  it('adosse les spécialités des voies générales à une source officielle', () => {
    for (const course of listSpecialtyCourses('TERMINALE')) {
      // Une spécialité sans programme officiel au dépôt reste déclarée, mais
      // uniquement sur un périmètre commercial Nexus assumé comme tel.
      const sources = getCourseSources(course.courseKey);
      expect(sources.length).toBeGreaterThan(0);
      if (!hasOfficialProvenance(course.courseKey)) {
        expect(sources.every((source) => source.publisher.includes('Nexus'))).toBe(true);
      }
    }
  });
});

describe('taxonomie académique', () => {
  const GENERIC_SUBJECTS_NEVER_SPECIALTIES = [
    'FRANCAIS',
    'PHILOSOPHIE',
    'HISTOIRE_GEO',
    'ANGLAIS',
    'ESPAGNOL',
  ];

  it.each(GENERIC_SUBJECTS_NEVER_SPECIALTIES)(
    'ne fabrique jamais une spécialité à partir de la matière générique %s',
    (subject) => {
      const fabricated = listCourses().filter(
        (course) => course.kind === 'SPECIALTY' && course.legacySubject === subject,
      );
      expect(fabricated).toEqual([]);
    },
  );

  it("n'expose aucun libellé « — spécialité » sur un enseignement de tronc commun", () => {
    for (const course of listCourses()) {
      if (course.kind === 'CORE' || course.kind === 'TRACK_MODULE') {
        expect(course.longLabel.toLowerCase()).not.toContain('spécialité');
      }
    }
  });

  it('ne compte jamais Mathématiques expertes comme une spécialité', () => {
    const expertes = getCourse('opt-maths-expertes-terminale');
    expect(expertes?.kind).toBe('OPTION');
    expect(expertes?.requiresCourseKey).toBe('eds-maths-terminale');
  });

  it('classe Philosophie en tronc commun de terminale', () => {
    expect(getCourse('tc-philosophie-terminale')?.kind).toBe('CORE');
  });

  it('borne le nombre de spécialités et le source', () => {
    expect(getMaxSpecialties('PREMIERE')).toBe(3);
    expect(getMaxSpecialties('TERMINALE')).toBe(2);
    expect(getMaxSpecialties('SECONDE')).toBeNull();
    expect(getSpecialtyRuleSources('TERMINALE').length).toBeGreaterThan(0);
  });
});

describe('modules STMG', () => {
  const STMG_MODULES = ['stmg-sgn-premiere', 'stmg-management-premiere', 'stmg-droit-eco-premiere'];

  it.each(STMG_MODULES)(
    "%s n'est jamais assimilé à une matière générique",
    (courseKey) => {
      const course = getCourse(courseKey);
      expect(course).not.toBeNull();
      // C'est précisément le rattachement à SES qui faisait passer un module
      // STMG pour de l'économie générale.
      expect(course?.legacySubject).toBeNull();
    },
  );

  it('classe les modules STMG comme modules de voie, jamais comme spécialités', () => {
    for (const courseKey of [...STMG_MODULES, 'stmg-maths-premiere']) {
      expect(getCourse(courseKey)?.kind).toBe('TRACK_MODULE');
    }
  });

  it("n'expose aucune spécialité générale à un élève STMG", () => {
    const stmgCourses = listCoursesFor({ gradeLevel: 'PREMIERE', track: 'STMG' });
    expect(stmgCourses.some((course) => course.kind === 'SPECIALTY')).toBe(false);
  });
});

describe('invariants structurels', () => {
  it('a des clés uniques et en kebab-case', () => {
    const keys = listCourses().map((course) => course.courseKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('ne référence que des graphes de compétences réellement compilés', () => {
    const compiled = [
      'maths-premiere-p2',
      'maths-terminale-p2',
      'nsi-premiere-p2',
      'nsi-terminale-p2',
      'maths-premiere-stmg-p2',
      'sgn-premiere-stmg-p2',
      'management-premiere-stmg-p2',
      'droit-eco-premiere-stmg-p2',
    ];
    for (const course of listCourses()) {
      if (course.skillGraphRef) expect(compiled).toContain(course.skillGraphRef);
    }
  });

  it('retourne null pour une clé inconnue ou malformée, sans jamais lever', () => {
    for (const key of ['inconnu', '../../etc/passwd', '']) {
      expect(() => getCourse(key)).not.toThrow();
      expect(getCourse(key)).toBeNull();
    }
  });
});

describe('pont vers le registre de programmes versionnés', () => {
  // Le registre `lib/curriculum/registry` porte les références BO datées et la
  // validité par année scolaire. Il était jusqu'ici orphelin : ces tests
  // garantissent qu'il est réellement consommé, et correctement.
  const CURRENT_ACADEMIC_YEAR = '2026-2027';

  it('relie au registre les cours dont le programme y figure', () => {
    expect(listCoursesWithProgrammeSelector().length).toBeGreaterThan(0);
  });

  it('résout une version de programme publiée pour chaque cours relié', () => {
    for (const course of listCoursesWithProgrammeSelector()) {
      const programme = resolveCourseProgramme(course.courseKey, CURRENT_ACADEMIC_YEAR);
      expect(programme).not.toBeNull();
      expect(programme!.status).toBe('PUBLISHED');
      expect(programme!.officialSources.length).toBeGreaterThan(0);
      expect(programme!.officialSources[0].uri).toMatch(/^https?:\/\//);
    }
  });

  it('sélectionne la version en vigueur, pas une version périmée', () => {
    // Le programme de spécialité Maths de première a été republié au BO n° 14
    // du 2 avril 2026 : c'est celui-là qui doit s'appliquer en 2026-2027.
    const programme = resolveCourseProgramme('eds-maths-premiere', CURRENT_ACADEMIC_YEAR);
    expect(programme?.id).toBe('fr-maths-premiere-speciality-2026');

    // Et l'année précédente, c'est bien l'ancien programme.
    expect(resolveCourseProgramme('eds-maths-premiere', '2025-2026')?.id).toBe(
      'fr-maths-premiere-speciality-2019',
    );
  });

  it('retourne null hors période de validité, sans repli sur une version voisine', () => {
    expect(resolveCourseProgramme('eds-maths-premiere', '2010-2011')).toBeNull();
  });

  it('retourne null pour un cours sans programme au registre', () => {
    // Les modules STMG n'ont pas encore d'entrée au registre versionné :
    // on le dit, plutôt que de rattacher un programme approchant.
    expect(resolveCourseProgramme('stmg-sgn-premiere', CURRENT_ACADEMIC_YEAR)).toBeNull();
    expect(resolveCourseProgramme('inconnu', CURRENT_ACADEMIC_YEAR)).toBeNull();
  });
});
