import { sourceFilesUnder, source } from './aria-boundary-helpers';

/**
 * `StudentAcademicEnrollment.courseKey` is a free-form string referencing the
 * file-backed curriculum catalog (no PostgreSQL FK can validate it) — see
 * `scripts/curriculum/verify-enrollment-integrity.ts`. The ONLY thing that
 * keeps every persisted row catalog-valid is that exactly one writer
 * (`lib/curriculum/enrollment.ts`) validates before writing. This test keeps
 * that invariant true by construction: a second application/runtime writer
 * — including a future C05a resource importer — must never be introduced.
 */

const CANONICAL_WRITER = 'lib/curriculum/enrollment.ts';

// Migration/backfill code has a named, validated purpose (a one-time,
// build-time-generated data migration, reviewed once — see
// scripts/curriculum/generate-academic-enrollment-migration.ts) and writes
// raw SQL, not this Prisma call — it is not scanned by this test at all.
const ALLOWED_WRITERS = new Set([CANONICAL_WRITER]);

const WRITE_METHOD_PATTERN = /studentAcademicEnrollment\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g;

describe('StudentAcademicEnrollment — single canonical writer boundary', () => {
  it('no application/runtime source file outside the canonical curriculum enrollment service writes StudentAcademicEnrollment rows', () => {
    const candidates = sourceFilesUnder('app', 'components', 'lib', 'scripts')
      .filter((file) => !file.startsWith('__tests__/'))
      .filter((file) => !ALLOWED_WRITERS.has(file));

    const violations = candidates.flatMap((file) => {
      const text = source(file);
      const matches = [...text.matchAll(WRITE_METHOD_PATTERN)];
      return matches.map((match) => `${file}: studentAcademicEnrollment.${match[1]}(...)`);
    });

    expect(violations).toEqual([]);
  });

  it('the canonical writer file itself still exists and still writes StudentAcademicEnrollment (the boundary above is not vacuously true)', () => {
    const text = source(CANONICAL_WRITER);
    expect(text).toMatch(WRITE_METHOD_PATTERN);
  });
});
