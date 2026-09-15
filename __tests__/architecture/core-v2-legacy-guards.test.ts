import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  findCoreV2ClientAuthorityViolations,
  listFilesRecursive,
} from './helpers/core-v2-client-authority-guard';

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

function coreV2RuntimeFiles(): string[] {
  return CORE_V2_RUNTIME_DIRS.flatMap((dir) => listFilesRecursive(dir));
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

// Go-live mission §Y: one RBAC authority. Any role decision written inline
// (comparison against a role literal, a literal role array, a switch on a
// role, or reading actor/session role at all) outside lib/core-v2/rbac.ts is
// a second authority and fails here. Role values used as DATA (`role: 'PARENT'`
// when creating an account) are legitimately not matched.
describe('CORE_V2_NO_INLINE_RBAC (go-live §Y)', () => {
  const ROLE_LITERAL = "['\"`](ADMIN|ASSISTANTE|COACH|PARENT|ELEVE)['\"`]";
  const INLINE_RBAC_PATTERNS: readonly RegExp[] = [
    new RegExp(`\\brole\\s*(===|!==|==|!=)\\s*${ROLE_LITERAL}`),
    new RegExp(`${ROLE_LITERAL}\\s*(===|!==|==|!=)\\s*\\w*\\.?role\\b`),
    new RegExp(`\\[\\s*${ROLE_LITERAL}\\s*(,\\s*${ROLE_LITERAL}\\s*)*\\]\\s*\\.includes\\(`),
    /\.includes\(\s*\w+(\.\w+)*\.role\s*\)/,
    /switch\s*\(\s*\w+(\.\w+)*\.role\s*\)/,
    /\bactor\.role\b/,
    /session\.user\.role\b/,
    /\bUserRole\.[A-Z]+\b/,
  ];
  const ALLOWED = new Set([join(root, 'lib/core-v2/rbac.ts')]);

  test.each([
    ["if (actor.role === 'ADMIN') {}", true],
    ["if ('ADMIN' === user.role) {}", true],
    ["['ADMIN', 'ASSISTANTE'].includes(session.user.role)", true],
    ["STAFF.includes(ctx.actor.role)", true],
    ["switch (user.role) {}", true],
    ["role: 'PARENT'", false],
    ["assertSubjectRole(user, 'PARENT')", false],
    ["user.role === claims.role", false],
  ])('pattern set flags %j => %p', (source, expected) => {
    expect(INLINE_RBAC_PATTERNS.some((p) => p.test(source))).toBe(expected);
  });

  test('no Core v2 runtime file other than rbac.ts decides on a role inline', () => {
    const offenders = coreV2RuntimeFiles()
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => {
        const src = readFileSync(file, 'utf8');
        return INLINE_RBAC_PATTERNS.some((p) => p.test(src));
      })
      .map((file) => file.slice(root.length + 1));
    expect(offenders).toEqual([]);
  });

  test('sanity: the guard scans the service layer', () => {
    expect(coreV2RuntimeFiles().some((f) => f.includes('lib/core-v2/services/'))).toBe(true);
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
  // Catches every real JS/TS module-reference shape, not just static
  // `import ... from '...'`: a side-effect import (`import '...'`, no
  // `from`), a dynamic `import('...')`, and CommonJS `require('...')` all
  // bind a module the exact same way and must all be caught (foundation §12
  // review finding — the original pattern only matched the `from` form).
  const CORE_V2_PATH_ALTERNATION = "@/core-v2|@/lib/core-v2|\\.\\.?/.*core-v2";
  const CORE_V2_IMPORT_PATTERN = new RegExp(
    `(?:from\\s+['"\`]|import\\s*\\(\\s*['"\`]|require\\s*\\(\\s*['"\`]|import\\s+['"\`])` +
      `(${CORE_V2_PATH_ALTERNATION})[/'"\`]`,
  );

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

  // A file-scan test that finds zero offenders proves nothing if the
  // pattern itself has a blind spot — verify each real module-reference
  // shape directly, so this guard is a genuine RED→GREEN proof, not a
  // scan that would vacuously pass over an undetectable violation.
  test.each([
    ["import { x } from '@/lib/core-v2/client';", true],
    ["export * from '@/core-v2/generated/client';", true],
    ["import '@/lib/core-v2/client';", true], // side-effect import, no `from`
    ["require('@/lib/core-v2/client')", true], // CommonJS
    ["import('@/lib/core-v2/client')", true], // dynamic import
    ["import('../lib/core-v2/client')", true],
    ['const x = 1; // mentions core-v2 in a comment', false],
    ["import { x } from '@/lib/other';", false],
  ])('CORE_V2_IMPORT_PATTERN.test(%j) === %p', (source, expected) => {
    expect(CORE_V2_IMPORT_PATTERN.test(source)).toBe(expected);
  });

  test('no file outside lib/core-v2/**, core-v2/**, scripts/core-v2/**, __tests__/core-v2/** imports from any of them', () => {
    const files = listLiveRuntimeFiles();
    expect(files.length).toBeGreaterThan(0); // sanity: the guard actually scanned something
    const offenders = files.filter((file) => CORE_V2_IMPORT_PATTERN.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

// Review A, P3-3 (database collision guard hardening): the outside-in guard
// above proves nothing outside Core v2's own paths imports it. This is the
// inside guard — only lib/core-v2/client.ts, the sole sanctioned source of
// a validated client (foundation hardening §6-7: URL target-collision
// guard + database identity marker, both fail-closed), may hold a value
// reference to the generated Core v2 Prisma module at all, let alone
// construct one. Any other file doing so would bypass both safety layers
// entirely.
//
// AST-based (see helpers/core-v2-client-authority-guard.ts), not a
// construction-site regex: a regex matching `new PrismaClient` misses an
// aliased import (`import { PrismaClient as X }; new X()`), a namespace
// import, a reassigned variable, a CommonJS require, a dynamic import, or
// an indirect re-export from another Core v2 file. The AST guard instead
// denies VALUE access to the module entirely from any file but client.ts —
// however a reference is obtained, obtaining it at all outside client.ts is
// the violation, closing the whole evasion space in one rule rather than
// enumerating every way a reference could later be used to construct.
describe('CORE_V2_ONLY_CLIENT_TS_MAY_CONSTRUCT_A_CLIENT (foundation hardening, DATABASE_COLLISION_GUARD_WEAKNESS)', () => {
  test('no file other than lib/core-v2/client.ts holds a value reference to the generated Core v2 client module', () => {
    const violations = findCoreV2ClientAuthorityViolations(root);
    expect(violations).toEqual([]);
  });

  test('sanity: the guard actually scans real files (app/api/v2, lib/core-v2, scripts/core-v2)', () => {
    const scanned = ['app/api/v2', 'lib/core-v2', 'scripts/core-v2'].flatMap((d) =>
      listFilesRecursive(join(root, d)),
    );
    expect(scanned.length).toBeGreaterThan(0);
  });

  test('lib/core-v2/client.ts itself does hold a value reference (sanity: the guard is not simply matching nothing)', () => {
    const clientSource = readFileSync(join(root, 'lib/core-v2/client.ts'), 'utf8');
    expect(/\bnew\s+CoreV2PrismaClient\b/.test(clientSource)).toBe(true);
  });
});
