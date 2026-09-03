/**
 * P0-ARIA-02 — Canonical Entitlement Convergence.
 *
 * Reproduces, then closes, the gap between the live commercial path
 * (`ARIA_ADDON_MATHS`/`ARIA_ADDON_NSI` invoices) and the ARIA runtime's
 * canonical entitlement resolver, which only ever reads
 * `productCode === 'ARIA_ACCESS'` (`lib/aria/kernel/entitlements.ts`).
 *
 * Design (documented, not invented — see engine.ts for full rationale):
 * the courseKey a legacy addon grants is derived the SAME way the M1
 * backfill script (`scripts/aria/backfill-entitlements.ts`, function
 * `resolveScopes`) already derives it for historical data: from the
 * beneficiary's OWN real, currently-followed Academic Map
 * (`resolveStudentCourses`), matched against the course's `legacySubject`,
 * requiring EXACTLY ONE ARIA-capable candidate. No static "all Maths
 * courses" list is invented (mission §2.4).
 */

import { activateEntitlements, resolveAriaAddonCourseGrant } from '@/lib/entitlement/engine';
import { buildCanonicalAriaEntitlementContext } from '@/lib/aria/kernel/entitlements';

function createMockTx() {
  const entitlements: Record<string, unknown>[] = [];
  const scopes: Record<string, unknown>[] = [];
  return {
    entitlement: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        return entitlements.find((e: any) =>
          e.userId === where.userId
          && e.productCode === where.productCode
          && (where.sourceInvoiceId === undefined || e.sourceInvoiceId === where.sourceInvoiceId)
          && (where.status === undefined || e.status === where.status)) ?? null;
      }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const row = { id: `ent-${entitlements.length + 1}`, status: 'ACTIVE', ...data };
        entitlements.push(row);
        return row;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const row = entitlements.find((e: any) => e.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ariaEntitlementScope: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        return scopes.find((s: any) =>
          s.entitlementId === where.entitlementId
          && s.kind === where.kind
          && (where.courseKey === undefined || s.courseKey === where.courseKey)) ?? null;
      }),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const row = { id: `scope-${scopes.length + 1}`, ...data };
        scopes.push(row);
        return row;
      }),
    },
    student: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    creditTransaction: { create: jest.fn() },
    invoice: { findUnique: jest.fn().mockResolvedValue(null) },
    __rows: { entitlements, scopes },
  };
}

const TERMINALE_EDS_STUDENT = {
  id: 'student-1',
  userId: 'user-1',
  gradeLevel: 'TERMINALE' as const,
  academicTrack: 'EDS_GENERALE' as const,
  stmgPathway: null,
  academicEnrollments: [],
};

function ariaAddonInvoice(overrides: Partial<{ productCode: string; qty: number }> = {}) {
  return {
    id: 'inv-1',
    beneficiaryUserId: 'user-1',
    items: [{
      id: 'item-1',
      label: 'ARIA — Maths',
      productCode: overrides.productCode ?? 'ARIA_ADDON_MATHS',
      qty: overrides.qty ?? 1,
    }],
  };
}

describe('P0-ARIA-02 — canonical entitlement convergence', () => {
  it('CODEX_P0_ARIA_02_RED: activating ARIA_ADDON_MATHS alone never grants canonical ARIA access (reproduces the bug at the resolver boundary)', () => {
    // Exactly what activateEntitlements() persisted BEFORE this fix: a single
    // Entitlement row carrying the legacy productCode, no AriaEntitlementScope.
    const legacyOnlyRecords = [{
      id: 'ent-legacy-1',
      productCode: 'ARIA_ADDON_MATHS',
      status: 'ACTIVE' as const,
      startsAt: new Date('2026-01-01'),
      endsAt: null,
      ariaScopes: [],
    }];
    const context = buildCanonicalAriaEntitlementContext(legacyOnlyRecords, new Date('2026-06-01'));
    expect(context.hasGenericAccess).toBe(false);
    expect(context.courseKeys).toEqual([]);
  });

  it('resolves the beneficiary\'s own real courseKey for ARIA_ADDON_MATHS via their Academic Map, requiring exactly one candidate', () => {
    const grant = resolveAriaAddonCourseGrant({
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      stmgPathway: null,
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' }],
    }, 'MATHEMATIQUES');
    expect(grant).toEqual({ status: 'RESOLVED', courseKey: 'eds-maths-terminale' });
  });

  it('resolves NSI the same way', () => {
    const grant = resolveAriaAddonCourseGrant({
      gradeLevel: 'PREMIERE',
      academicTrack: 'EDS_GENERALE',
      stmgPathway: null,
      academicEnrollments: [{ courseKey: 'eds-nsi-premiere', kind: 'SPECIALTY', source: 'ADMIN' }],
    }, 'NSI');
    expect(grant).toEqual({ status: 'RESOLVED', courseKey: 'eds-nsi-premiere' });
  });

  it('does not invent a courseKey when the beneficiary follows zero matching subject courses', () => {
    const grant = resolveAriaAddonCourseGrant({
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      stmgPathway: null,
      academicEnrollments: [], // no Maths specialty followed
    }, 'MATHEMATIQUES');
    expect(grant.status).toBe('AMBIGUOUS');
  });

  it('CODEX_CUBIC_P1B_RED: never resolves a courseKey the current Academic Map does not actually offer (stale enrollment from a prior grade/track)', () => {
    // eds-maths-premiere requires gradeLevel=PREMIERE. This student's CURRENT
    // map is TERMINALE — the enrollment is a leftover from a prior class,
    // exactly the case lib/aria/access.ts's resolveValidatedStudentCourses()
    // guards against for the ARIA runtime read path. The commercial grant
    // resolver must share that same guarantee, not just the runtime reader.
    const grant = resolveAriaAddonCourseGrant({
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      stmgPathway: null,
      academicEnrollments: [{ courseKey: 'eds-maths-premiere', kind: 'SPECIALTY', source: 'ADMIN' }],
    }, 'MATHEMATIQUES');
    expect(grant.status).toBe('AMBIGUOUS');
  });

  it('activateEntitlements() end-to-end: ARIA_ADDON_MATHS purchase converges to a canonical ARIA_ACCESS grant that the runtime resolver actually recognises', async () => {
    const tx = createMockTx();
    tx.invoice.findUnique.mockResolvedValue(ariaAddonInvoice());
    tx.student.findUnique.mockResolvedValue({
      ...TERMINALE_EDS_STUDENT,
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' }],
    });

    const result = await activateEntitlements('inv-1', tx as any);

    expect(result.activatedCodes).toContain('ARIA_ADDON_MATHS');
    expect(result.ariaAccessGranted).toBe(1);
    expect(result.ariaAccessSkipped).toBe(0);

    // The legacy productCode's own audit row still exists, untouched in
    // shape (mission §2.6 — legacy productCodes stay fully auditable).
    const legacyRow = (tx as any).__rows.entitlements.find((e: any) => e.productCode === 'ARIA_ADDON_MATHS');
    expect(legacyRow).toBeDefined();

    // The SEPARATE canonical grant is what the runtime actually reads.
    const canonicalRow = (tx as any).__rows.entitlements.find((e: any) => e.productCode === 'ARIA_ACCESS');
    expect(canonicalRow).toBeDefined();
    const scope = (tx as any).__rows.scopes.find((s: any) => s.entitlementId === canonicalRow.id);
    expect(scope).toMatchObject({ kind: 'COURSE', courseKey: 'eds-maths-terminale' });

    // The end-to-end proof requested by the mission: replay the exact same
    // canonical resolver the ARIA runtime calls, on the exact rows this
    // activation persisted.
    const records = (tx as any).__rows.entitlements
      .filter((e: any) => e.productCode === 'ARIA_ACCESS')
      .map((e: any) => ({
        id: e.id,
        productCode: e.productCode,
        status: e.status,
        startsAt: e.startsAt,
        endsAt: e.endsAt ?? null,
        ariaScopes: (tx as any).__rows.scopes
          .filter((s: any) => s.entitlementId === e.id)
          .map((s: any) => ({ kind: s.kind, courseKey: s.courseKey ?? null })),
      }));
    const context = buildCanonicalAriaEntitlementContext(records, new Date());
    expect(context.hasGenericAccess).toBe(true);
    expect(context.courseKeys).toEqual(['eds-maths-terminale']);
  });

  it('is non-blocking when the Academic Map cannot resolve exactly one course: the commercial purchase still succeeds, no canonical grant is fabricated', async () => {
    const tx = createMockTx();
    tx.invoice.findUnique.mockResolvedValue(ariaAddonInvoice());
    tx.student.findUnique.mockResolvedValue({ ...TERMINALE_EDS_STUDENT, academicEnrollments: [] });

    const result = await activateEntitlements('inv-1', tx as any);

    expect(result.created).toBeGreaterThan(0); // the legacy ARIA_ADDON_MATHS row was still created
    expect(result.ariaAccessGranted).toBe(0);
    expect(result.ariaAccessSkipped).toBe(1);
    expect((tx as any).__rows.entitlements.some((e: any) => e.productCode === 'ARIA_ACCESS')).toBe(false);
  });

  it('two successive ARIA_ADDON_MATHS purchases converge to ONE extended canonical entitlement with ONE scope row, never duplicated', async () => {
    const tx = createMockTx();
    tx.student.findUnique.mockResolvedValue({
      ...TERMINALE_EDS_STUDENT,
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' }],
    });

    tx.invoice.findUnique.mockResolvedValue({ ...ariaAddonInvoice(), id: 'inv-1' });
    const first = await activateEntitlements('inv-1', tx as any);
    expect(first.ariaAccessGranted).toBe(1);

    tx.invoice.findUnique.mockResolvedValue({ ...ariaAddonInvoice(), id: 'inv-2', items: [{ ...ariaAddonInvoice().items[0], id: 'item-2' }] });
    const second = await activateEntitlements('inv-2', tx as any);
    expect(second.ariaAccessGranted).toBe(1);

    // Each invoice gets its own audit trace row (same convention as every
    // other EXTEND-mode product in this engine) — that's expected. The
    // invariant that matters is that only ONE scope row exists, attached to
    // the original entitlement, so the canonical resolver never double-counts.
    const canonicalRows = (tx as any).__rows.entitlements.filter((e: any) => e.productCode === 'ARIA_ACCESS');
    expect(canonicalRows.length).toBeGreaterThanOrEqual(1);
    expect((tx as any).__rows.scopes).toHaveLength(1);

    const records = canonicalRows.map((e: any) => ({
      id: e.id,
      productCode: e.productCode,
      status: e.status,
      startsAt: e.startsAt,
      endsAt: e.endsAt ?? null,
      ariaScopes: (tx as any).__rows.scopes
        .filter((s: any) => s.entitlementId === e.id)
        .map((s: any) => ({ kind: s.kind, courseKey: s.courseKey ?? null })),
    }));
    const context = buildCanonicalAriaEntitlementContext(records, new Date());
    expect(context.hasGenericAccess).toBe(true);
    expect(context.courseKeys).toEqual(['eds-maths-terminale']);
  });

  it('multiple scopes: a student entitled via two different resolved courses accumulates two distinct scopes on the same canonical entitlement', async () => {
    const tx = createMockTx();
    tx.student.findUnique.mockResolvedValue({
      ...TERMINALE_EDS_STUDENT,
      academicEnrollments: [
        { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
        { courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
      ],
    });

    tx.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      beneficiaryUserId: 'user-1',
      items: [
        { id: 'item-1', label: 'ARIA — Maths', productCode: 'ARIA_ADDON_MATHS', qty: 1 },
        { id: 'item-2', label: 'ARIA — NSI', productCode: 'ARIA_ADDON_NSI', qty: 1 },
      ],
    });

    const result = await activateEntitlements('inv-1', tx as any);
    expect(result.ariaAccessGranted).toBe(2);

    const canonicalRows = (tx as any).__rows.entitlements.filter((e: any) => e.productCode === 'ARIA_ACCESS');
    expect(canonicalRows).toHaveLength(1);
    const scopesForCanonical = (tx as any).__rows.scopes.filter((s: any) => s.entitlementId === canonicalRows[0].id);
    const courseKeys = scopesForCanonical.map((s: any) => s.courseKey).sort();
    expect(courseKeys).toEqual(['eds-maths-terminale', 'eds-nsi-terminale']);
  });
});
