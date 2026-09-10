import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Gardes d'architecture Core v2 (mission "Core v2 Canonical Architecture",
 * §21 ; étendues par feat/core-v2-greenfield-foundation §17).
 *
 * Trois catégories de gardes ici :
 *
 * 1. Gardes sur le SCHÉMA DE CONCEPTION `core-v2/prisma/schema.prisma`
 *    (CORE_V2_ASSIGNMENT_IS_SINGLE_COURSE, CORE_V2_ROSTER_SOURCE, etc.) :
 *    vérifient que le schéma proposé respecte ses propres invariants
 *    déclarés.
 *
 * 2. Gardes sur le RUNTIME Core v2 (les 5 gardes "must not") : scannent
 *    `app/api/v2/**` et `lib/core-v2/**`. Depuis feat/core-v2-greenfield-
 *    foundation, `lib/core-v2/**` contient de vrais fichiers (client,
 *    repositories) — ces 5 gardes sont donc RÉELLEMENT actives sur ces
 *    fichiers, plus seulement câblées à l'avance. `app/api/v2/**` reste vide
 *    (aucun endpoint public dans cette PR) donc n'y contribue encore aucune
 *    violation possible.
 *
 * 3. CORE_V2_MUST_NOT_BE_IMPORTED_BY_LIVE_RUNTIME (foundation §12) : le sens
 *    inverse de la garde 2 — aucun fichier EN DEHORS de `lib/core-v2/**`,
 *    `core-v2/**`, `scripts/core-v2/**`, `__tests__/core-v2/**` ne doit
 *    importer quoi que ce soit depuis ces chemins. Tant que ceci est vrai,
 *    le runtime live (app/, le reste de lib/, components/) ne peut package
 *    du code Core v2 dans aucun bundle, même par accident.
 */

const root = process.cwd();
const CORE_V2_RUNTIME_DIRS = [join(root, 'app/api/v2'), join(root, 'lib/core-v2')];

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listFilesRecursive(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function coreV2RuntimeFiles(): string[] {
  return CORE_V2_RUNTIME_DIRS.flatMap(listFilesRecursive);
}

function violatingFiles(pattern: RegExp): string[] {
  return coreV2RuntimeFiles().filter((file) => pattern.test(readFileSync(file, 'utf8')));
}

describe('Core v2 runtime guards (scoped to app/api/v2/** and lib/core-v2/**, vacuous until that runtime exists)', () => {
  test('CORE_V2_MUST_NOT_READ_STUDENT_GRADE_LEGACY', () => {
    const offenders = violatingFiles(/\.grade\b(?!Level)/);
    expect(offenders).toEqual([]);
  });

  test('CORE_V2_MUST_NOT_READ_COACH_SUBJECTS_JSON', () => {
    const offenders = violatingFiles(/coachProfile\.subjects\b|coach\.subjects\b|parseSubjects\(/);
    expect(offenders).toEqual([]);
  });

  test('CORE_V2_MUST_NOT_USE_LEGACY_ASSIGNMENT', () => {
    const offenders = violatingFiles(
      /coachStudentAssignment\b|\bacademicCourseKeys\b|\bcourseScopeState\b|BACKFILL_(AUTO|UNRESOLVED|AMBIGUOUS)/,
    );
    expect(offenders).toEqual([]);
  });

  test('CORE_V2_MUST_NOT_USE_SESSION_LEGACY', () => {
    const offenders = violatingFiles(/prisma\.session\.|tx\.session\.|client\.session\./);
    expect(offenders).toEqual([]);
  });

  test('CORE_V2_MUST_NOT_AUTHORIZE_FROM_SESSIONBOOKING_USER_IDS', () => {
    // Legacy identity fields on SessionBooking: studentId/coachId/parentId
    // resolving directly to a User.id for an authorization decision. Core v2
    // SessionBooking (see core-v2/prisma/schema.prisma) has no such fields at
    // all — this guard exists for defense in depth against a future runtime
    // reintroducing the pattern via a raw query or a shared helper.
    const offenders = violatingFiles(
      /sessionBooking\.(studentId|coachId|parentId)\s*(===|!==)\s*(session\.user\.id|user\.id)/,
    );
    expect(offenders).toEqual([]);
  });
});

describe('Core v2 design-schema guards (active today — check the proposed schema itself)', () => {
  const schemaPath = join(root, 'core-v2/prisma/schema.prisma');
  const schema = readFileSync(schemaPath, 'utf8');

  function modelBlock(name: string): string {
    const match = new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`).exec(schema);
    if (!match) throw new Error(`model ${name} not found in ${schemaPath}`);
    return match[0];
  }

  test('CORE_V2_ASSIGNMENT_IS_SINGLE_COURSE — CoachStudentCourseAssignment.courseKey is a scalar, never an array, and no legacy scope fields exist', () => {
    const block = modelBlock('CoachStudentCourseAssignment');
    expect(block).toMatch(/courseKey\s+String(?!\[\])/);
    expect(block).not.toMatch(/courseKey\s+String\[\]/);
    expect(block).not.toMatch(/\bsubjects\b/);
    expect(block).not.toMatch(/\bacademicCourseKeys\b/);
    expect(block).not.toMatch(/\bcourseScopeState\b/);
    expect(schema).not.toMatch(/BACKFILL_AUTO|BACKFILL_UNRESOLVED|BACKFILL_AMBIGUOUS/);
  });

  test('CORE_V2_ROSTER_SOURCE — StudentAcademicYearEnrollment is the declared roster authority, with a closed status enum and no createdAt-derived status', () => {
    const block = modelBlock('StudentAcademicYearEnrollment');
    expect(block).toMatch(/status\s+StudentAcademicYearEnrollmentStatus/);
    // Roster identity is keyed off the canonical AcademicYear entity, never
    // a free-text schoolYear string (rejected post-review: a typo variant
    // like "2026-27" vs "2026-2027" would defeat this exact uniqueness
    // guard). Regression guard: fail if free-text schoolYear ever reappears.
    expect(block).toMatch(/@@unique\(\[studentId, academicYearId\]\)/);
    expect(block).not.toMatch(/schoolYear\s+String/);

    const enumBlock = /enum StudentAcademicYearEnrollmentStatus \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? '';
    expect(enumBlock).toContain('ACTIVE');
    expect(enumBlock).toContain('WITHDRAWN');

    // Student itself must NOT carry year-specific academic fields anymore.
    const studentBlock = modelBlock('Student');
    expect(studentBlock).not.toMatch(/\bgradeLevel\b/);
    expect(studentBlock).not.toMatch(/\bacademicTrack\b/);
    expect(studentBlock).not.toMatch(/\bgrade\b/);
    expect(studentBlock).not.toMatch(/\bspecialties\b/);
  });

  test('CORE_V2_ACADEMIC_YEAR_IS_CANONICAL — AcademicYear has one unambiguous entered identity (startYear), no free-text label stored as authority', () => {
    const block = modelBlock('AcademicYear');
    expect(block).toMatch(/startYear\s+Int\s+@unique/);
    // No free-text "2026-2027"-shaped label field is ever stored as an
    // entered value on this model — the label is derived at read time.
    expect(block).not.toMatch(/schoolYear\s+String/);
    expect(block).not.toMatch(/label\s+String/);
    expect(block).toMatch(/status\s+AcademicYearStatus/);
  });

  test('CORE_V2_HOUSEHOLD_IS_FAMILY_AUTHORITY — Student is scoped to a Household, not a single ParentProfile', () => {
    const studentBlock = modelBlock('Student');
    expect(studentBlock).toMatch(/householdId\s+String/);
    expect(studentBlock).not.toMatch(/parentId\s+String/);
  });

  test('CORE_V2_SESSIONBOOKING_HAS_NO_LEGACY_USER_ID_IDENTITY', () => {
    const block = modelBlock('SessionBooking');
    expect(block).not.toMatch(/^\s*studentId\s+String\s*$/m);
    expect(block).not.toMatch(/^\s*coachId\s+String\s*$/m);
    expect(block).not.toMatch(/^\s*parentId\s+String/m);
    expect(block).toMatch(/assignmentId\s+String/);
  });
});

describe('CORE_V2_MUST_NOT_BE_IMPORTED_BY_LIVE_RUNTIME (foundation §12)', () => {
  const CORE_V2_OWN_DIRS = ['lib/core-v2', 'core-v2', 'scripts/core-v2', '__tests__/core-v2'];
  const LIVE_RUNTIME_DIRS = ['app', 'lib', 'components', 'scripts'];
  const CORE_V2_IMPORT_PATTERN = /from\s+['"](@\/core-v2|@\/lib\/core-v2|\.\.?\/.*core-v2)[/'"]/;

  function isUnderCoreV2OwnDir(filePath: string): boolean {
    const relative = filePath.slice(root.length + 1);
    return CORE_V2_OWN_DIRS.some((dir) => relative === dir || relative.startsWith(`${dir}/`));
  }

  function listLiveRuntimeFiles(): string[] {
    const files: string[] = [];
    for (const dir of LIVE_RUNTIME_DIRS) {
      const full = join(root, dir);
      if (!existsSync(full)) continue;
      for (const file of listFilesRecursive(full)) {
        if (!isUnderCoreV2OwnDir(file)) files.push(file);
      }
    }
    return files;
  }

  test('no file outside lib/core-v2/**, core-v2/**, scripts/core-v2/**, __tests__/core-v2/** imports from any of them', () => {
    const files = listLiveRuntimeFiles();
    expect(files.length).toBeGreaterThan(0); // sanity: the guard actually scanned something
    const offenders = files.filter((file) => CORE_V2_IMPORT_PATTERN.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
