/**
 * Intégrité du modèle d'inscriptions : un seul chemin d'écriture, aucune
 * valeur d'enum sans donnée derrière.
 *
 * Ces tests inspectent le dépôt lui-même. Ils échouent dès qu'un nouveau code
 * écrit des inscriptions en contournant le service — c'est précisément par là
 * qu'une clé de cours inexistante finirait en base.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCANNED_DIRS = ['app', 'lib', 'components', 'scripts', 'prisma'];
const CANONICAL_WRITE_PATH = path.join('lib', 'curriculum', 'enrollment.ts');

const MUTATIONS = [
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

const SOURCE_FILES = SCANNED_DIRS.flatMap((dir) => {
  const full = path.join(ROOT, dir);
  try {
    return walk(full);
  } catch {
    return [];
  }
});

describe('un seul chemin d’écriture des inscriptions', () => {
  it('scanne réellement des fichiers', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(100);
  });

  it('ENROLLMENT_WRITE_PATHS=1 : aucune mutation hors du service canonique', () => {
    const offenders: string[] = [];

    for (const file of SOURCE_FILES) {
      const relative = path.relative(ROOT, file);
      if (relative === CANONICAL_WRITE_PATH) continue;

      const content = readFileSync(file, 'utf-8');
      for (const mutation of MUTATIONS) {
        if (content.includes(`studentAcademicEnrollment.${mutation}(`)) {
          offenders.push(`${relative} → studentAcademicEnrollment.${mutation}()`);
        }
      }
      // Écriture imbriquée depuis une création d'élève.
      if (/academicEnrollments:\s*\{\s*(create|createMany|connectOrCreate)/.test(content)) {
        offenders.push(`${relative} → nested academicEnrollments write`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('le service canonique existe et expose bien l’écriture', () => {
    const service = readFileSync(path.join(ROOT, CANONICAL_WRITE_PATH), 'utf-8');
    expect(service).toContain('export async function setStudentChosenCourses');
    // Il valide avant d'écrire : c'est ce qui rend le chemin unique utile.
    expect(service).toContain('validateChosenCourses');
    expect(service).toContain('AcademicEnrollmentError');
  });
});

describe('aucune valeur d’enum sans donnée derrière', () => {
  const SCHEMA = readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf-8');

  function enumValues(name: string): string[] {
    const match = SCHEMA.match(new RegExp(`enum ${name} \\{([^}]*)\\}`));
    if (!match) throw new Error(`enum ${name} introuvable dans le schéma`);
    return match[1]
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').trim())
      .filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line));
  }

  it('ZOMBIE_ACADEMIC_ENUM_VALUES=0 pour la nature des inscriptions', () => {
    // CORE et TRACK_MODULE ne sont jamais persistés : ils sont dérivés.
    expect(enumValues('AcademicEnrollmentKind').sort()).toEqual(['OPTION', 'SPECIALTY']);
  });

  it('ZOMBIE_ACADEMIC_ENUM_VALUES=0 pour la provenance des inscriptions', () => {
    // Une provenance décrivant une donnée non persistée n'a pas lieu d'être.
    const values = enumValues('AcademicEnrollmentSource');
    expect(values).not.toContain('DERIVED_FROM_LEVEL_TRACK');
    expect(values.sort()).toEqual(['ADMIN', 'ASSISTANTE', 'BACKFILL_LEGACY_SPECIALTIES', 'SEED']);
  });

  it('chaque valeur de provenance est réellement écrite quelque part', () => {
    const written = SOURCE_FILES.map((file) => readFileSync(file, 'utf-8')).join('\n');
    const migrations = readFileSync(
      path.join(ROOT, 'prisma/migrations/20260828140000_add_student_academic_enrollments/migration.sql'),
      'utf-8',
    );
    const haystack = `${written}\n${migrations}`;
    for (const value of enumValues('AcademicEnrollmentSource')) {
      expect(haystack).toContain(value);
    }
  });
});

describe('intégrité de l’auteur de vérification', () => {
  const SCHEMA = readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf-8');

  it('VERIFICATION_ACTOR_INTEGRITY : verifiedById est une vraie clé étrangère', () => {
    const model = SCHEMA.match(/model StudentAcademicEnrollment \{([\s\S]*?)\n\}/);
    expect(model).not.toBeNull();
    const body = model![1];

    // Plus de pseudo-clé étrangère libre.
    expect(body).not.toMatch(/^\s*verifiedBy\s+String\?/m);
    expect(body).toMatch(/verifiedById\s+String\?/);
    expect(body).toMatch(/verifiedBy\s+User\?\s+@relation\(/);
    // Supprimer un compte ne doit jamais supprimer l'inscription d'un élève.
    expect(body).toMatch(/onDelete:\s*SetNull/);
  });
});
