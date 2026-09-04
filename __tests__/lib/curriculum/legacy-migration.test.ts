/**
 * Reprise des données héritées de `students.specialties`.
 *
 * L'invariant vérifié ici est celui qui distingue une migration honnête d'une
 * migration approximative : ce qui relève du tronc commun ne doit produire
 * AUCUNE ligne, et doit réapparaître par dérivation. Une ligne de plus, et la
 * base porterait deux fois la même affirmation, avec deux façons de diverger.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getCourse } from '@/lib/curriculum/catalog';
import { resolveStudentCourses } from '@/lib/curriculum/enrollment';
import {
  classifyLegacySpecialty,
  listMigratedChoices,
  listRedundantLegacyCore,
} from '@/lib/curriculum/legacy-migration-map';

const MIGRATIONS = path.join(process.cwd(), 'prisma/migrations');
// Une seule migration, générée depuis la source canonique.
const MIGRATION_SQL = readFileSync(
  path.join(MIGRATIONS, '20260828140000_academic_enrollment_ssot/migration.sql'),
  'utf-8',
);
const CREATE_SQL = MIGRATION_SQL;
const DROP_SQL = MIGRATION_SQL;

const TERMINALE = { gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE', stmgPathway: null };
const PREMIERE = { gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', stmgPathway: null };

function statusOf(views: ReturnType<typeof resolveStudentCourses>, courseKey: string) {
  return views.find((view) => view.course.courseKey === courseKey)?.academicStatus;
}

describe('déterminisme de la reprise', () => {
  it("n'utilise ni aléa ni horloge pour fabriquer les identifiants", () => {
    // Un id non déterministe rendrait tout replay sur clone non comparable.
    expect(CREATE_SQL).not.toMatch(/random\s*\(/i);
    expect(CREATE_SQL).not.toMatch(/clock_timestamp\s*\(/i);
    expect(CREATE_SQL).not.toMatch(/gen_random_uuid\s*\(/i);
    expect(CREATE_SQL).toMatch(/md5\(e\."studentId" \|\| '\|' \|\| e\."courseKey"\)/);
  });

  it('est déterministe sur les IDENTITÉS, pas sur les horodatages', () => {
    // Ce qui est reproductible : (id, studentId, courseKey, kind, source).
    // Ce qui ne l'est pas, et n'a pas à l'être : createdAt / updatedAt, posés
    // à CURRENT_TIMESTAMP. Deux replays produisent donc des lignes de même
    // identité, pas des lignes identiques octet pour octet — la nuance compte
    // dès qu'on prétend comparer deux bases.
    expect(CREATE_SQL).toMatch(/"createdAt"[\s\S]{0,200}CURRENT_TIMESTAMP/);
    expect(CREATE_SQL).toMatch(/CURRENT_TIMESTAMP,\s*\n\s*CURRENT_TIMESTAMP/);
  });
});

describe('la reprise ne stocke que des choix', () => {
  it("ne déclare que SPECIALTY et OPTION dans l'enum persistée", () => {
    expect(CREATE_SQL).toMatch(/CREATE TYPE "AcademicEnrollmentKind" AS ENUM \('SPECIALTY', 'OPTION'\)/);
    expect(CREATE_SQL).not.toMatch(/'CORE'/);
    expect(CREATE_SQL).not.toMatch(/'TRACK_MODULE'/);
  });

  it("n'écrit aucune clé de tronc commun", () => {
    const written = [...CREATE_SQL.matchAll(/THEN '([a-z0-9-]+)'/g)].map((match) => match[1]);
    expect(written.length).toBeGreaterThan(0);
    for (const courseKey of written) {
      const course = getCourse(courseKey);
      expect(course).not.toBeNull();
      expect(['SPECIALTY', 'OPTION']).toContain(course!.kind);
    }
  });

  it('fait correspondre chaque clé écrite à un cours réel du catalogue', () => {
    const written = new Set([...CREATE_SQL.matchAll(/THEN '([a-z0-9-]+)'/g)].map((m) => m[1]));
    for (const courseKey of written) {
      expect(getCourse(courseKey)).not.toBeNull();
    }
  });
});

describe('classification des valeurs héritées', () => {
  it.each([
    ['MATHEMATIQUES', 'TERMINALE', 'MIGRATED_CHOICE'],
    ['NSI', 'TERMINALE', 'MIGRATED_CHOICE'],
    ['PHYSIQUE_CHIMIE', 'TERMINALE', 'MIGRATED_CHOICE'],
    ['SVT', 'TERMINALE', 'MIGRATED_CHOICE'],
    ['SES', 'TERMINALE', 'MIGRATED_CHOICE'],
    ['MATHS_EXPERTES', 'TERMINALE', 'MIGRATED_CHOICE'],
    ['MATHEMATIQUES', 'PREMIERE', 'MIGRATED_CHOICE'],
    ['SES', 'PREMIERE', 'MIGRATED_CHOICE'],
    // Tronc commun : redondant avec le niveau, reproduit par dérivation.
    ['PHILOSOPHIE', 'TERMINALE', 'REDUNDANT_LEGACY_CORE'],
    ['HISTOIRE_GEO', 'TERMINALE', 'REDUNDANT_LEGACY_CORE'],
    ['FRANCAIS', 'PREMIERE', 'REDUNDANT_LEGACY_CORE'],
    ['MATHEMATIQUES', 'SECONDE', 'REDUNDANT_LEGACY_CORE'],
    // Indécidable : rien dans la donnée ne dit s'il s'agit de LVA ou de LVB.
    ['ANGLAIS', 'TERMINALE', 'UNRESOLVED'],
    ['ESPAGNOL', 'TERMINALE', 'UNRESOLVED'],
    ['ANGLAIS', 'PREMIERE', 'UNRESOLVED'],
  ])('classe %s en %s comme %s', (subject, level, expected) => {
    expect(classifyLegacySpecialty(subject, level)).toBe(expected);
  });
});

describe('le tronc commun hérité réapparaît par dérivation', () => {
  it('Philosophie de terminale : aucune ligne, mais bien DERIVED', () => {
    // Aucune inscription n'est créée pour cette valeur héritée…
    expect(classifyLegacySpecialty('PHILOSOPHIE', 'TERMINALE')).toBe('REDUNDANT_LEGACY_CORE');
    // …et pourtant l'élève suit bien la Philosophie.
    const views = resolveStudentCourses(TERMINALE, []);
    expect(statusOf(views, 'tc-philosophie-terminale')).toBe('DERIVED');
  });

  it('Histoire-Géographie de terminale : aucune ligne, mais bien DERIVED', () => {
    expect(classifyLegacySpecialty('HISTOIRE_GEO', 'TERMINALE')).toBe('REDUNDANT_LEGACY_CORE');
    const views = resolveStudentCourses(TERMINALE, []);
    expect(statusOf(views, 'tc-histoire-geo-terminale')).toBe('DERIVED');
  });

  it('Français de première : aucune ligne, mais bien DERIVED', () => {
    expect(classifyLegacySpecialty('FRANCAIS', 'PREMIERE')).toBe('REDUNDANT_LEGACY_CORE');
    const views = resolveStudentCourses(PREMIERE, []);
    expect(statusOf(views, 'tc-francais-premiere')).toBe('DERIVED');
  });

  it('aucun cours de tronc commun ne peut être porté par une inscription', () => {
    const views = resolveStudentCourses(TERMINALE, []);
    for (const view of views) {
      if (view.course.kind === 'CORE') {
        expect(view.academicStatus).toBe('DERIVED');
        expect(view.enrollmentSource).toBeNull();
      }
    }
  });
});

describe('barrière de la migration destructive', () => {
  it('lève une exception plutôt que de supprimer une donnée non reprise', () => {
    expect(DROP_SQL).toMatch(/RAISE EXCEPTION/);
    expect(DROP_SQL).toMatch(/MIGRATION_BLOCKED_UNRESOLVED_LEGACY_SPECIALTIES/);
    expect(DROP_SQL).toMatch(/MIGRATION_BLOCKED_BACKFILL_SET_MISMATCH/);
  });

  it('compare des ENSEMBLES, jamais des compteurs', () => {
    // Comparer deux cardinalités laisse passer une ligne manquante compensée
    // par une ligne en trop : les compteurs restent égaux, l'ensemble est faux.
    expect(DROP_SQL).toMatch(/EXCEPT/);
    expect(DROP_SQL).toMatch(/_expected_choices/);
    expect(DROP_SQL).not.toMatch(/migrated_count\s*<\s*expected_count/);
  });

  it("ne conserve aucun champ de garde inutilisé", () => {
    // Un indicateur calculé puis jamais lu donne l'illusion d'une vérification.
    expect(DROP_SQL).not.toMatch(/student_has_backfill/);
    const declared = [...DROP_SQL.matchAll(/^\s{2}([a-z_]+)\s+(?:INTEGER|TEXT);$/gm)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(0);
    for (const variable of declared) {
      // Chaque variable déclarée doit être utilisée ailleurs que dans sa déclaration.
      const uses = DROP_SQL.split(new RegExp(`\\b${variable}\\b`)).length - 1;
      expect(uses).toBeGreaterThan(1);
    }
  });

  it('ne supprime plus la colonne héritée : la phase CONTRACT est différée', () => {
    // `students.specialties` porte des données réelles en production. La
    // supprimer ici interdirait tout rollback sans perte, alors que le
    // backfill vers StudentAcademicEnrollment suffit à basculer les lecteurs.
    // La suppression relève d'un lot CONTRACT dédié, jamais de cette migration.
    expect(DROP_SQL).not.toMatch(/DROP\s+COLUMN\s+"?specialties"?/i);
    expect(DROP_SQL).toMatch(/SPECIALTIES_CONTRACT_STATUS=DEFERRED_SAFELY/);
    expect(DROP_SQL).toMatch(/DATA_LOSS_RISK=0/);
  });

  it('conserve la barrière et le backfill malgré le report de la suppression', () => {
    // Le report ne doit pas dégrader les garanties : la migration reste
    // atomique, gardée, et alimente toujours le modèle canonique.
    expect(DROP_SQL).toMatch(/student_academic_enrollments/);
    expect(DROP_SQL).toMatch(/DO \$migration\$/);
  });

  it('reconnaît comme redondantes exactement les valeurs que le script classe ainsi', () => {
    // Les deux implémentations doivent rester alignées, sinon la barrière
    // bloquerait des données que la reprise considère couvertes, ou l'inverse.
    for (const [level, subjects] of Object.entries({
      QUATRIEME: ['MATHEMATIQUES', 'FRANCAIS'],
      TROISIEME: ['MATHEMATIQUES', 'FRANCAIS'],
      SECONDE: ['MATHEMATIQUES', 'FRANCAIS'],
      PREMIERE: ['FRANCAIS'],
      TERMINALE: ['PHILOSOPHIE', 'HISTOIRE_GEO'],
    })) {
      for (const subject of subjects) {
        expect(classifyLegacySpecialty(subject, level)).toBe('REDUNDANT_LEGACY_CORE');
        expect(DROP_SQL).toContain(subject);
      }
    }
  });
});

describe('une seule source de correspondance', () => {
  it('LEGACY_MAPPING_SOURCES=1 : le SQL est généré, jamais écrit à la main', () => {
    expect(MIGRATION_SQL).toContain('FICHIER GÉNÉRÉ');
    expect(MIGRATION_SQL).toContain('data/curriculum/v1/legacy-specialties-migration.json');
  });

  it('la migration ne contient pas une seconde correspondance divergente', () => {
    // Chaque couple (niveau, matière) de la source canonique doit apparaître
    // dans le SQL, et le SQL ne doit rien contenir d'autre.
    const sqlPairs = new Set(
      [...MIGRATION_SQL.matchAll(/s\."gradeLevel" = '([A-Z]+)' AND legacy\.subject = '([A-Z_]+)'/g)].map(
        (match) => `${match[1]}|${match[2]}`,
      ),
    );
    const canonicalChoices = new Set(
      listMigratedChoices().map((entry) => `${entry.gradeLevel}|${entry.legacySubject}`),
    );
    expect([...sqlPairs].sort()).toEqual([...canonicalChoices].sort());
  });

  it('les prédicats de tronc commun redondant viennent de la même source', () => {
    for (const entry of listRedundantLegacyCore()) {
      expect(MIGRATION_SQL).toContain(
        `(grade_level = '${entry.gradeLevel}' AND subject = '${entry.legacySubject}')`,
      );
    }
  });

  it('est atomique : tout tient dans un unique bloc DO', () => {
    // Un DDL exécuté hors du bloc survivrait à l'échec de la barrière.
    expect((MIGRATION_SQL.match(/DO \$migration\$/g) ?? []).length).toBe(1);
    const outsideDdl = MIGRATION_SQL.split('DO $migration$')[0];
    expect(outsideDdl).not.toMatch(/CREATE TABLE|CREATE TYPE|ALTER TABLE/);
  });
});
