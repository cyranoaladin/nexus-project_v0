/** @jest-environment node */

/**
 * Cubic P2 (concurrency) / P1-C — the canonical ARIA_ACCESS grant is now
 * invoice-scoped: at most ONE Entitlement(productCode='ARIA_ACCESS') row
 * per (userId, sourceInvoiceId), enforced at the DB boundary by the
 * partial unique index `entitlements_aria_access_invoice_key`
 * (migration 20260903120000_aria_canonical_grant_invoice_uniqueness) —
 * not merely by `activateCanonicalAriaGrant()`'s own
 * findFirst-then-create ordering, which alone cannot prevent a genuine
 * race between two concurrent activations of the SAME invoice.
 *
 * This proves the guarantee against a REAL PostgreSQL instance with the
 * migration applied: several concurrent `activateEntitlements()` calls for
 * the SAME invoice, at READ COMMITTED (Prisma's default — no artificial
 * serialization), must converge on exactly one canonical row and exactly
 * one scope, never a duplicate grant or a duplicate scope.
 */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { prisma } from '@/lib/prisma';
import { activateEntitlements } from '@/lib/entitlement/engine';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe('Canonical ARIA_ACCESS grant — concurrent activation on PostgreSQL', () => {
  let pool: Pool;
  const ids = {
    parentUser: randomUUID(),
    parent: randomUUID(),
    studentUser: randomUUID(),
    student: randomUUID(),
    invoice: randomUUID(),
  };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl, max: 8 });

    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
       ($1, $2, 'PARENT', NOW()), ($3, $4, 'ELEVE', NOW())`,
      [ids.parentUser, `parent-${ids.parentUser}@invalid.test`, ids.studentUser, `student-${ids.studentUser}@invalid.test`],
    );
    await pool.query('INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)', [ids.parent, ids.parentUser]);
    await pool.query(
      `INSERT INTO students
       (id, "parentId", "userId", "gradeLevel", "academicTrack", "updatedAt")
       VALUES ($1, $2, $3, 'TERMINALE', 'EDS_GENERALE', NOW())`,
      [ids.student, ids.parent, ids.studentUser],
    );
    await pool.query(
      `INSERT INTO student_academic_enrollments
       (id, "studentId", "courseKey", kind, source, "curriculumVersion", "createdAt", "updatedAt")
       VALUES ($1, $2, 'eds-maths-terminale', 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW())`,
      [randomUUID(), ids.student],
    );
    await pool.query(
      `INSERT INTO invoices
       (id, number, status, "customerName", "createdByUserId", "beneficiaryUserId", "updatedAt")
       VALUES ($1, $2, 'PAID', 'Test Parent', $3, $4, NOW())`,
      [ids.invoice, `TEST-${ids.invoice.slice(0, 8)}`, ids.parentUser, ids.studentUser],
    );
    await pool.query(
      `INSERT INTO invoice_items
       (id, "invoiceId", label, "productCode", qty, "unitPrice", total)
       VALUES ($1, $2, 'ARIA — Maths', 'ARIA_ADDON_MATHS', 1, 45000, 45000)`,
      [randomUUID(), ids.invoice],
    );
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM aria_entitlement_scopes WHERE "entitlementId" IN (
         SELECT id FROM entitlements WHERE "userId" = $1
       )`,
      [ids.studentUser],
    );
    await pool.query('DELETE FROM entitlements WHERE "userId" = $1', [ids.studentUser]);
    await pool.query('DELETE FROM invoice_items WHERE "invoiceId" = $1', [ids.invoice]);
    await pool.query('DELETE FROM invoices WHERE id = $1', [ids.invoice]);
    await pool.query('DELETE FROM student_academic_enrollments WHERE "studentId" = $1', [ids.student]);
    await pool.query('DELETE FROM students WHERE id = $1', [ids.student]);
    await pool.query('DELETE FROM parent_profiles WHERE id = $1', [ids.parent]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [[ids.studentUser, ids.parentUser]]);
    await pool.end();
    await prisma.$disconnect();
  });

  it('CODEX_CUBIC_P2_CONCURRENCY_RED: N concurrent activations of the SAME invoice converge on exactly one canonical ARIA_ACCESS row and one scope', async () => {
    const CONCURRENCY = 8;
    const attempts = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, () =>
        // Deliberately READ COMMITTED (Prisma's default, no isolationLevel
        // override) — the guarantee under test is the DB-level partial
        // unique index, not application-level Serializable isolation.
        prisma.$transaction((tx) => activateEntitlements(ids.invoice, tx))),
    );

    // A concurrent loser races on the DB-enforced unique index and its
    // whole `activateEntitlements()` transaction fails (Postgres aborts
    // the transaction on the violation — the same shape as the pre-existing
    // P2034 serialization-conflict handling in payments/validate/route.ts,
    // which now also maps this P2002 to a 409/retry). At least one attempt
    // — the winner — must succeed and actually grant canonical access; any
    // rejection must be exactly this unique-constraint conflict, never some
    // other failure.
    const fulfilled = attempts.filter(
      (a): a is PromiseFulfilledResult<Awaited<ReturnType<typeof activateEntitlements>>> => a.status === 'fulfilled',
    );
    const rejected = attempts.filter((a): a is PromiseRejectedResult => a.status === 'rejected');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(fulfilled.some((f) => f.value.ariaAccessGranted === 1)).toBe(true);
    for (const { value } of fulfilled) {
      expect(value.ariaAccessSkipped).toBe(0);
    }
    for (const { reason } of rejected) {
      expect(String((reason as { code?: string })?.code ?? reason)).toMatch(/P2002|Unique constraint/);
    }

    const canonicalRows = await pool.query(
      `SELECT id FROM entitlements
       WHERE "userId" = $1 AND "productCode" = 'ARIA_ACCESS' AND "sourceInvoiceId" = $2`,
      [ids.studentUser, ids.invoice],
    );
    expect(canonicalRows.rows).toHaveLength(1);

    const scopeRows = await pool.query(
      `SELECT "courseKey" FROM aria_entitlement_scopes WHERE "entitlementId" = $1`,
      [canonicalRows.rows[0].id],
    );
    expect(scopeRows.rows).toHaveLength(1);
    expect(scopeRows.rows[0].courseKey).toBe('eds-maths-terminale');
  });
});
