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

import { activateEntitlements, resolveAriaAddonCourseGrant, suspendEntitlements } from '@/lib/entitlement/engine';
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
      findMany: jest.fn().mockImplementation(async ({ where }: any) => {
        return entitlements.filter((e: any) =>
          (where.sourceInvoiceId === undefined || e.sourceInvoiceId === where.sourceInvoiceId)
          && (where.status === undefined || e.status === where.status));
      }),
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
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const matching = entitlements.filter((e: any) =>
          (where.sourceInvoiceId === undefined || e.sourceInvoiceId === where.sourceInvoiceId)
          && (where.status === undefined || e.status === where.status));
        for (const row of matching) Object.assign(row, data);
        return { count: matching.length };
      }),
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

  // ── Cubic P1-C: invoice-scoped canonical grant model ──────────────────────
  //
  // Each invoice's own convergence to ARIA_ACCESS is now its OWN Entitlement
  // row (sourceInvoiceId = that invoice, never shared/extended in place by
  // another invoice — see activateCanonicalAriaGrant() in engine.ts). The
  // runtime canonical resolver (buildCanonicalAriaEntitlementContext) already
  // UNIONS every currently-active ARIA_ACCESS row's scopes, so "renewal" /
  // continued access across several invoices falls out of having several
  // simultaneously-active invoice-scoped rows — no shared mutable state, no
  // endsAt owned by more than one invoice, and suspendEntitlements(invoiceId)
  // (already filters by sourceInvoiceId) therefore precisely and only ever
  // affects that ONE invoice's own contribution.

  function ariaAddonInvoiceFor(invoiceId: string, productCode: string, itemId: string) {
    return {
      id: invoiceId,
      beneficiaryUserId: 'user-1',
      items: [{ id: itemId, label: `ARIA — ${productCode}`, productCode, qty: 1 }],
    };
  }

  it('CODEX_CUBIC_P1C_RED: two successive ARIA_ADDON_MATHS purchases (two invoices) each get their OWN canonical entitlement row — never a shared row extended in place', async () => {
    const tx = createMockTx();
    tx.student.findUnique.mockResolvedValue({
      ...TERMINALE_EDS_STUDENT,
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' }],
    });

    tx.invoice.findUnique.mockResolvedValue(ariaAddonInvoiceFor('inv-1', 'ARIA_ADDON_MATHS', 'item-1'));
    const first = await activateEntitlements('inv-1', tx as any);
    expect(first.ariaAccessGranted).toBe(1);

    tx.invoice.findUnique.mockResolvedValue(ariaAddonInvoiceFor('inv-2', 'ARIA_ADDON_MATHS', 'item-2'));
    const second = await activateEntitlements('inv-2', tx as any);
    expect(second.ariaAccessGranted).toBe(1);

    // Two SEPARATE canonical entitlement rows — one per invoice — each with
    // its own scope. No shared row, no cross-invoice mutation.
    const canonicalRows = (tx as any).__rows.entitlements.filter((e: any) => e.productCode === 'ARIA_ACCESS');
    expect(canonicalRows).toHaveLength(2);
    expect(canonicalRows.map((e: any) => e.sourceInvoiceId).sort()).toEqual(['inv-1', 'inv-2']);
    expect((tx as any).__rows.scopes).toHaveLength(2);
    for (const scope of (tx as any).__rows.scopes) {
      expect(scope).toMatchObject({ kind: 'COURSE', courseKey: 'eds-maths-terminale' });
    }

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

  it('CODEX_CUBIC_P1C_RED: purchase A then B (different scopes), cancel B — A survives fully untouched', async () => {
    const tx = createMockTx();
    tx.student.findUnique.mockResolvedValue({
      ...TERMINALE_EDS_STUDENT,
      academicEnrollments: [
        { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
        { courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
      ],
    });

    tx.invoice.findUnique.mockResolvedValue(ariaAddonInvoiceFor('inv-A', 'ARIA_ADDON_MATHS', 'item-A'));
    await activateEntitlements('inv-A', tx as any);
    tx.invoice.findUnique.mockResolvedValue(ariaAddonInvoiceFor('inv-B', 'ARIA_ADDON_NSI', 'item-B'));
    await activateEntitlements('inv-B', tx as any);

    const rowA = (tx as any).__rows.entitlements.find((e: any) => e.productCode === 'ARIA_ACCESS' && e.sourceInvoiceId === 'inv-A');
    const rowBBefore = { ...(tx as any).__rows.entitlements.find((e: any) => e.productCode === 'ARIA_ACCESS' && e.sourceInvoiceId === 'inv-B') };

    await suspendEntitlements('inv-B', 'test cancellation', tx as any);

    // A: completely untouched — same status, same endsAt, its scope intact.
    expect(rowA.status).toBe('ACTIVE');
    const rowAAfter = (tx as any).__rows.entitlements.find((e: any) => e.id === rowA.id);
    expect(rowAAfter).toMatchObject({ status: 'ACTIVE', sourceInvoiceId: 'inv-A' });

    // B: suspended, and ONLY B.
    const rowBAfter = (tx as any).__rows.entitlements.find((e: any) => e.id === rowBBefore.id);
    expect(rowBAfter.status).toBe('SUSPENDED');

    const records = (tx as any).__rows.entitlements
      .filter((e: any) => e.productCode === 'ARIA_ACCESS')
      .map((e: any) => ({
        id: e.id, productCode: e.productCode, status: e.status, startsAt: e.startsAt, endsAt: e.endsAt ?? null,
        ariaScopes: (tx as any).__rows.scopes.filter((s: any) => s.entitlementId === e.id)
          .map((s: any) => ({ kind: s.kind, courseKey: s.courseKey ?? null })),
      }));
    const context = buildCanonicalAriaEntitlementContext(records, new Date());
    expect(context.courseKeys).toEqual(['eds-maths-terminale']); // NSI gone, Maths intact
  });

  it('CODEX_CUBIC_P1C_RED: purchase A then B (different scopes), cancel A — B survives fully untouched (the actual reported bug)', async () => {
    const tx = createMockTx();
    tx.student.findUnique.mockResolvedValue({
      ...TERMINALE_EDS_STUDENT,
      academicEnrollments: [
        { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
        { courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
      ],
    });

    tx.invoice.findUnique.mockResolvedValue(ariaAddonInvoiceFor('inv-A', 'ARIA_ADDON_MATHS', 'item-A'));
    await activateEntitlements('inv-A', tx as any);
    tx.invoice.findUnique.mockResolvedValue(ariaAddonInvoiceFor('inv-B', 'ARIA_ADDON_NSI', 'item-B'));
    await activateEntitlements('inv-B', tx as any);

    await suspendEntitlements('inv-A', 'test cancellation', tx as any);

    const rowA = (tx as any).__rows.entitlements.find((e: any) => e.productCode === 'ARIA_ACCESS' && e.sourceInvoiceId === 'inv-A');
    const rowB = (tx as any).__rows.entitlements.find((e: any) => e.productCode === 'ARIA_ACCESS' && e.sourceInvoiceId === 'inv-B');
    expect(rowA.status).toBe('SUSPENDED');
    // Under the OLD shared-row model, B's contribution (extension + scope)
    // lived entirely on A's row, so suspending A would have wrongly taken
    // NSI access down too. It must not.
    expect(rowB.status).toBe('ACTIVE');

    const records = (tx as any).__rows.entitlements
      .filter((e: any) => e.productCode === 'ARIA_ACCESS')
      .map((e: any) => ({
        id: e.id, productCode: e.productCode, status: e.status, startsAt: e.startsAt, endsAt: e.endsAt ?? null,
        ariaScopes: (tx as any).__rows.scopes.filter((s: any) => s.entitlementId === e.id)
          .map((s: any) => ({ kind: s.kind, courseKey: s.courseKey ?? null })),
      }));
    const context = buildCanonicalAriaEntitlementContext(records, new Date());
    expect(context.hasGenericAccess).toBe(true);
    expect(context.courseKeys).toEqual(['eds-nsi-terminale']); // Maths gone, NSI intact
  });

  it('two invoices granting the SAME scope (renewal): cancelling one leaves the other fully active with the scope intact', async () => {
    const tx = createMockTx();
    tx.student.findUnique.mockResolvedValue({
      ...TERMINALE_EDS_STUDENT,
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' }],
    });

    tx.invoice.findUnique.mockResolvedValue(ariaAddonInvoiceFor('inv-1', 'ARIA_ADDON_MATHS', 'item-1'));
    await activateEntitlements('inv-1', tx as any);
    tx.invoice.findUnique.mockResolvedValue(ariaAddonInvoiceFor('inv-2', 'ARIA_ADDON_MATHS', 'item-2'));
    await activateEntitlements('inv-2', tx as any);

    await suspendEntitlements('inv-1', 'test cancellation', tx as any);

    const records = (tx as any).__rows.entitlements
      .filter((e: any) => e.productCode === 'ARIA_ACCESS')
      .map((e: any) => ({
        id: e.id, productCode: e.productCode, status: e.status, startsAt: e.startsAt, endsAt: e.endsAt ?? null,
        ariaScopes: (tx as any).__rows.scopes.filter((s: any) => s.entitlementId === e.id)
          .map((s: any) => ({ kind: s.kind, courseKey: s.courseKey ?? null })),
      }));
    const context = buildCanonicalAriaEntitlementContext(records, new Date());
    // inv-2's row is still ACTIVE and still carries the Maths scope —
    // renewal access survives the cancellation of the original purchase.
    expect(context.hasGenericAccess).toBe(true);
    expect(context.courseKeys).toEqual(['eds-maths-terminale']);
  });

  it('replay/idempotence: re-running activateEntitlements for the SAME invoice never creates a second canonical row or a duplicate scope', async () => {
    const tx = createMockTx();
    tx.student.findUnique.mockResolvedValue({
      ...TERMINALE_EDS_STUDENT,
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' }],
    });
    tx.invoice.findUnique.mockResolvedValue(ariaAddonInvoiceFor('inv-1', 'ARIA_ADDON_MATHS', 'item-1'));

    await activateEntitlements('inv-1', tx as any);
    await activateEntitlements('inv-1', tx as any); // replay (e.g. retried webhook / retried route)

    expect((tx as any).__rows.entitlements.filter((e: any) => e.productCode === 'ARIA_ACCESS')).toHaveLength(1);
    expect((tx as any).__rows.scopes).toHaveLength(1);
  });

  it('expiration: an entitlement past its own endsAt stops counting toward canonical access without any suspension action', () => {
    const records = [{
      id: 'ent-expired',
      productCode: 'ARIA_ACCESS',
      status: 'ACTIVE' as const,
      startsAt: new Date('2026-01-01'),
      endsAt: new Date('2026-02-01'),
      ariaScopes: [{ kind: 'COURSE' as const, courseKey: 'eds-maths-terminale' }],
    }];
    const context = buildCanonicalAriaEntitlementContext(records, new Date('2026-03-01'));
    expect(context.hasGenericAccess).toBe(false);
    expect(context.courseKeys).toEqual([]);
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
