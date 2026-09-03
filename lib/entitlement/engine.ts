/**
 * Entitlement Engine — Core operations.
 *
 * Activates entitlements when an invoice is paid, suspends them on cancellation.
 * All DB operations accept an optional Prisma transaction client for atomicity.
 *
 * Design:
 * - Only invoice items with a valid productCode generate entitlements
 * - Entitlements are user-scoped (beneficiaryUserId on Invoice)
 * - Mode-aware activation:
 *     SINGLE → noop if already active (premium, stages)
 *     EXTEND → prolong endsAt if already active (abonnements, addons)
 *     STACK  → always create new entitlement + accumulate credits (packs)
 * - Credit packs also add credits to the Student record
 *
 * Canonical rules:
 * - customerEmail = payeur (parent / entreprise)
 * - beneficiaryUserId = bénéficiaire (student who receives entitlements)
 * - No beneficiaryUserId → 0 entitlements (safe fallback, no error)
 */

import { prisma } from '@/lib/prisma';
import { getCourseCapabilities } from '@/lib/aria/curriculum';
import { partitionEnrollmentsByCurrentMap, resolveStudentCourses } from '@/lib/curriculum/enrollment';
import {
  isValidProductCode,
  getProductDefinition,
  computeEndsAt,
} from './types';
import type { ProductCode } from './types';

/** Prisma transaction client type. */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** The single canonical ARIA product code the runtime resolver reads. */
const ARIA_CANONICAL_PRODUCT_CODE: ProductCode = 'ARIA_ACCESS';

// ─── Activation (on MARK_PAID) ──────────────────────────────────────────────

export interface ActivationResult {
  /** Number of entitlements created */
  created: number;
  /** Number of entitlements extended (EXTEND mode) */
  extended: number;
  /** Number of credits granted (sum across all credit packs) */
  creditsGranted: number;
  /** Product codes that were activated or extended */
  activatedCodes: string[];
  /** Items skipped (no productCode or unknown code) */
  skippedItems: number;
  /** True if no beneficiaryUserId was set on the invoice */
  noBeneficiary: boolean;
  /**
   * Number of legacy-product invoice items that successfully converged to a
   * canonical `ARIA_ACCESS` grant + `AriaEntitlementScope` (P0-ARIA-02).
   */
  ariaAccessGranted: number;
  /**
   * Number of `ariaGrant`-declaring items that could NOT converge (the
   * beneficiary's Academic Map did not resolve to exactly one ARIA-capable
   * course for that legacy subject). Non-blocking: the item's own
   * commercial entitlement is still created/extended normally; only the
   * canonical convergence is skipped, for manual staff follow-up.
   */
  ariaAccessSkipped: number;
}

/**
 * Activate entitlements for a paid invoice.
 *
 * Scans invoice items for valid productCodes and applies mode-aware logic:
 * - SINGLE: noop if user already has an active entitlement for this product
 * - EXTEND: prolong endsAt of existing active entitlement (or create if none)
 * - STACK:  always create a new entitlement + accumulate credits
 *
 * Credits are granted exactly once per invoice (idempotent via sourceInvoiceId check).
 *
 * @param invoiceId - The paid invoice ID
 * @param tx - Prisma transaction client (for atomicity with MARK_PAID)
 * @returns Activation result summary
 */
/**
 * Is this Prisma error the canonical ARIA_ACCESS grant's own DB-enforced
 * uniqueness conflict (`entitlements_aria_access_invoice_key` on
 * `userId`+`sourceInvoiceId` — see `activateCanonicalAriaGrant()` below)?
 *
 * Every caller of `activateEntitlements()` that lets its P2002s propagate
 * (`payments/validate/route.ts`, `admin/invoices/[id]/route.ts`) must use
 * this SAME check to decide whether a P2002 is a safe-to-retry concurrent
 * activation race, or a genuine, unrelated data-integrity failure that
 * must NOT be silently retried away (Cubic P2: treating every P2002 as
 * retryable can mask a real bug behind an endless "just retry" response).
 */
export function isCanonicalAriaAccessUniquenessConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  const prismaError = error as { code: unknown; meta?: { target?: unknown } };
  if (prismaError.code !== 'P2002') return false;
  const target = prismaError.meta?.target;
  return Array.isArray(target) && target.includes('userId') && target.includes('sourceInvoiceId');
}

export async function activateEntitlements(
  invoiceId: string,
  tx: TxClient
): Promise<ActivationResult> {
  const result: ActivationResult = {
    created: 0,
    extended: 0,
    creditsGranted: 0,
    activatedCodes: [],
    skippedItems: 0,
    noBeneficiary: false,
    ariaAccessGranted: 0,
    ariaAccessSkipped: 0,
  };

  // Fetch invoice with items and beneficiary
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      beneficiaryUserId: true,
      items: {
        select: {
          id: true,
          label: true,
          productCode: true,
          qty: true,
        },
      },
    },
  });

  if (!invoice) {
    return result;
  }

  if (!invoice.beneficiaryUserId) {
    result.noBeneficiary = true;
    result.skippedItems = invoice.items.length;
    return result;
  }

  const userId = invoice.beneficiaryUserId;
  const now = new Date();

  // Lazily loaded once per invoice: the beneficiary's Academic Map, needed
  // only by `ariaGrant`-declaring items (P0-ARIA-02 convergence).
  let beneficiaryAcademicMap:
    | Awaited<ReturnType<typeof loadBeneficiaryAcademicMap>>
    | undefined;

  for (const item of invoice.items) {
    if (!item.productCode || !isValidProductCode(item.productCode)) {
      result.skippedItems++;
      continue;
    }

    const code = item.productCode as ProductCode;
    const product = getProductDefinition(code)!;

    // ── Idempotence guard: check if this exact invoice already activated this product
    const alreadyFromThisInvoice = await tx.entitlement.findFirst({
      where: {
        userId,
        productCode: code,
        sourceInvoiceId: invoiceId,
      },
      select: { id: true },
    });

    if (alreadyFromThisInvoice) {
      // Already processed for this invoice — skip (idempotent)
      result.activatedCodes.push(code);
      continue;
    }

    // ── Mode-aware activation ────────────────────────────────────────

    if (product.mode === 'SINGLE') {
      // SINGLE: noop if user already has ANY active entitlement for this product
      const existingActive = await tx.entitlement.findFirst({
        where: {
          userId,
          productCode: code,
          status: 'ACTIVE',
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        select: { id: true },
      });

      if (existingActive) {
        // Already active from another invoice — skip
        result.activatedCodes.push(code);
        continue;
      }

      // Create new entitlement
      const endsAt = computeEndsAt(product, now);
      await tx.entitlement.create({
        data: {
          userId,
          productCode: code,
          label: item.label,
          status: 'ACTIVE',
          startsAt: now,
          endsAt,
          sourceInvoiceId: invoiceId,
          metadata: { qty: item.qty },
        },
      });
      result.created++;

    } else if (product.mode === 'EXTEND') {
      // EXTEND: prolong endsAt if active entitlement exists, else create
      const existingActive = await tx.entitlement.findFirst({
        where: {
          userId,
          productCode: code,
          status: 'ACTIVE',
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        select: { id: true, endsAt: true },
        orderBy: { endsAt: 'desc' },
      });

      if (existingActive && existingActive.endsAt && product.defaultDurationDays) {
        // Extend from current endsAt (not from now — no gap, no overlap)
        const extensionMs = product.defaultDurationDays * 24 * 60 * 60 * 1000;
        const newEndsAt = new Date(existingActive.endsAt.getTime() + extensionMs);
        await tx.entitlement.update({
          where: { id: existingActive.id },
          data: { endsAt: newEndsAt },
        });
        // Also record the source invoice on a new trace entitlement (for audit)
        await tx.entitlement.create({
          data: {
            userId,
            productCode: code,
            label: `${item.label} (extension)`,
            status: 'ACTIVE',
            startsAt: existingActive.endsAt,
            endsAt: newEndsAt,
            sourceInvoiceId: invoiceId,
            metadata: { qty: item.qty, extendedFrom: existingActive.id },
          },
        });
        result.extended++;
      } else {
        // No active entitlement — create fresh
        const endsAt = computeEndsAt(product, now);
        await tx.entitlement.create({
          data: {
            userId,
            productCode: code,
            label: item.label,
            status: 'ACTIVE',
            startsAt: now,
            endsAt,
            sourceInvoiceId: invoiceId,
            metadata: { qty: item.qty },
          },
        });
        result.created++;
      }

      // Grant credits if applicable (EXTEND products like abonnements can have credits)
      if (product.grantsCredits) {
        const totalCredits = product.grantsCredits * item.qty;
        result.creditsGranted += totalCredits;
      }

    } else {
      // STACK: always create new entitlement + accumulate credits
      await tx.entitlement.create({
        data: {
          userId,
          productCode: code,
          label: item.label,
          status: 'ACTIVE',
          startsAt: now,
          endsAt: computeEndsAt(product, now),
          sourceInvoiceId: invoiceId,
          metadata: {
            qty: item.qty,
            credits: product.grantsCredits ? product.grantsCredits * item.qty : 0,
          },
        },
      });
      result.created++;

      if (product.grantsCredits) {
        const totalCredits = product.grantsCredits * item.qty;
        result.creditsGranted += totalCredits;
      }
    }

    // ── P0-ARIA-02: converge to the canonical ARIA_ACCESS grant ─────────
    if (product.ariaGrant) {
      beneficiaryAcademicMap ??= await loadBeneficiaryAcademicMap(userId, tx);
      const grant = beneficiaryAcademicMap
        ? resolveAriaAddonCourseGrant(beneficiaryAcademicMap, product.ariaGrant.legacySubject)
        : { status: 'AMBIGUOUS' as const, candidateCount: 0 };
      if (grant.status === 'RESOLVED') {
        await activateCanonicalAriaGrant({
          tx,
          userId,
          invoiceId,
          courseKey: grant.courseKey,
          now,
        });
        result.ariaAccessGranted++;
      } else {
        // Non-blocking: the commercial entitlement above still stands. Logged
        // for staff follow-up, mirroring the existing noBeneficiary/skippedItems
        // pattern — never silently pretend convergence succeeded.
        console.error(
          '[ARIA] canonical grant convergence skipped: Academic Map did not resolve ' +
          `exactly one ARIA-capable course for subject=${product.ariaGrant.legacySubject} ` +
          `(userId=${userId}, invoiceId=${invoiceId}, productCode=${code})`,
        );
        result.ariaAccessSkipped++;
      }
    }

    result.activatedCodes.push(code);
  }

  // Apply credits to student record if any were granted (exactly once per invoice)
  if (result.creditsGranted > 0) {
    const student = await tx.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (student) {
      await tx.student.update({
        where: { id: student.id },
        data: { credits: { increment: result.creditsGranted } },
      });
    }
  }

  return result;
}

// ─── P0-ARIA-02: canonical ARIA grant convergence ───────────────────────────

interface BeneficiaryAcademicMap {
  readonly gradeLevel: string | null;
  readonly academicTrack: string | null;
  readonly stmgPathway: string | null;
  readonly academicEnrollments: readonly {
    readonly courseKey: string;
    readonly kind: 'SPECIALTY' | 'OPTION';
    readonly source: 'ADMIN' | 'ASSISTANTE' | 'SEED' | 'BACKFILL_LEGACY_SPECIALTIES';
  }[];
}

async function loadBeneficiaryAcademicMap(
  userId: string,
  tx: TxClient,
): Promise<BeneficiaryAcademicMap | null> {
  const student = await tx.student.findUnique({
    where: { userId },
    select: {
      gradeLevel: true,
      academicTrack: true,
      stmgPathway: true,
      academicEnrollments: { select: { courseKey: true, kind: true, source: true } },
    },
  });
  return student as BeneficiaryAcademicMap | null;
}

export type AriaAddonCourseGrantResolution =
  | { readonly status: 'RESOLVED'; readonly courseKey: string }
  | { readonly status: 'AMBIGUOUS'; readonly candidateCount: number };

/**
 * Resolves the ONE real courseKey a legacy ARIA addon (identified by its
 * curriculum `legacySubject`, e.g. `'MATHEMATIQUES'`/`'NSI'`) grants for a
 * given beneficiary — from their own real, currently-followed Academic Map,
 * never a static per-product courseKey list (mission §2.4).
 *
 * Same algorithm as the M1 backfill script's `resolveScopes()`
 * (`scripts/aria/backfill-entitlements.ts`) for the single-subject case:
 * exactly one ARIA-capable followed course matching the subject resolves;
 * zero or several candidates fail closed as `AMBIGUOUS` (never guessed).
 *
 * Shares its "which enrollments actually belong to the CURRENT Academic Map"
 * guarantee with `lib/aria/access.ts`'s `resolveValidatedStudentCourses()`
 * via `partitionEnrollmentsByCurrentMap()` (`lib/curriculum/enrollment.ts`)
 * — never a second implementation of that rule. A commercial grant can never
 * resolve a courseKey the ARIA runtime access resolver would itself reject
 * as belonging to a stale (pre-grade/track-change) enrollment.
 */
export function resolveAriaAddonCourseGrant(
  student: BeneficiaryAcademicMap,
  legacySubject: string,
): AriaAddonCourseGrantResolution {
  if (!student.gradeLevel || !student.academicTrack) {
    return { status: 'AMBIGUOUS', candidateCount: 0 };
  }
  const identity = {
    gradeLevel: student.gradeLevel,
    academicTrack: student.academicTrack,
    stmgPathway: student.stmgPathway,
  };
  const { withinCurrentMap } = partitionEnrollmentsByCurrentMap(identity, student.academicEnrollments);
  const followed = resolveStudentCourses(identity, withinCurrentMap)
    .filter(({ academicStatus }) => academicStatus !== 'NOT_ENROLLED');

  const candidates = followed.filter(({ course }) => {
    if (course.legacySubject !== legacySubject) return false;
    const capabilities = getCourseCapabilities(course.courseKey);
    return capabilities.hasChat || capabilities.hasSkillGraph
      || capabilities.hasResources || capabilities.hasRagCorpus;
  });

  if (candidates.length !== 1) {
    return { status: 'AMBIGUOUS', candidateCount: candidates.length };
  }
  return { status: 'RESOLVED', courseKey: candidates[0].course.courseKey };
}

/**
 * Invoice-scoped canonical ARIA grant (Cubic P1-C).
 *
 * EACH invoice's own convergence to ARIA_ACCESS is its OWN `Entitlement`
 * row, keyed by `sourceInvoiceId` — never a row SHARED across invoices and
 * mutated in place by a later one. The previous model found the single
 * currently-active ARIA_ACCESS entitlement (if any) and extended IT
 * in-place for every subsequent invoice; that mutilated per-invoice
 * lineage: `suspendEntitlements(invoiceId)` only ever suspends rows whose
 * `sourceInvoiceId` matches, so once two invoices' contributions were
 * folded onto one shared row, cancelling either invoice produced the wrong
 * outcome for the other (cancelling the invoice that ORIGINALLY created the
 * shared row suspended a later invoice's still-valid scope/extension too;
 * cancelling a later invoice left its extension/scope stranded on the
 * original row, surviving its own cancellation).
 *
 * This model has no such shared mutable state: every invoice gets its own
 * row and its own scope(s), full stop. Nothing here needs to reconstruct
 * "the" canonical grant, because there never was supposed to be exactly
 * one — `buildCanonicalAriaEntitlementContext` (`lib/aria/kernel/entitlements.ts`)
 * already treats canonical ARIA access as the UNION of every currently
 * ACTIVE, date-valid ARIA_ACCESS row's scopes, which is precisely what
 * makes several simultaneously-active invoice-scoped rows work correctly
 * as the reconstructible, per-invoice-auditable canonical projection:
 *   - "extension"/renewal: a second invoice for the same course simply
 *     creates its OWN row+window; access is continuous for as long as at
 *     least one row's window is current — no shared endsAt to mutate, no
 *     gap/overlap arithmetic, never a naive `endsAt -= N days`.
 *   - a cancelled invoice's row is suspended alone (`suspendEntitlements`
 *     already filters by `sourceInvoiceId`); every other invoice's row is
 *     untouched by construction, not by a lucky query shape.
 *   - two ARIA subjects on ONE invoice (e.g. Maths + NSI bought together)
 *     share that ONE invoice's row (found by `(userId, invoiceId)`, reused
 *     across the invoice's items) and simply accumulate two scopes on it —
 *     still exactly one row per invoice, never a double "extension".
 *   - idempotent replay: re-processing the same invoice finds its own row
 *     by `(userId, invoiceId)` and reuses it; no duplicate row, no
 *     duplicate scope.
 *   - concurrency: two racing activations for the SAME invoice both
 *     attempting the create race on a DB-enforced partial unique index
 *     (`entitlements_aria_access_invoice_key`, migration
 *     20260903120000_aria_canonical_grant_invoice_uniqueness) on
 *     (userId, sourceInvoiceId) WHERE productCode='ARIA_ACCESS'. The loser's
 *     create raises a unique-constraint violation (Prisma P2002); Postgres
 *     aborts that whole surrounding transaction on the violation, so it
 *     cannot recover in-place — the error propagates and fails that one
 *     `activateEntitlements()` transaction, exactly like the pre-existing
 *     P2034 serialization-conflict handling in
 *     `payments/validate/route.ts`. The WINNER's transaction still commits
 *     with exactly one row: the guarantee holds at the DB boundary, not
 *     merely via this function's own findFirst-then-create ordering.
 */
async function activateCanonicalAriaGrant(input: {
  readonly tx: TxClient;
  readonly userId: string;
  readonly invoiceId: string;
  readonly courseKey: string;
  readonly now: Date;
}): Promise<void> {
  const { tx, userId, invoiceId, courseKey, now } = input;
  const product = getProductDefinition(ARIA_CANONICAL_PRODUCT_CODE)!;

  const existingForThisInvoice = await tx.entitlement.findFirst({
    where: { userId, productCode: ARIA_CANONICAL_PRODUCT_CODE, sourceInvoiceId: invoiceId },
    select: { id: true },
  });

  let entitlementId: string;
  if (existingForThisInvoice) {
    entitlementId = existingForThisInvoice.id;
  } else {
    // A concurrent activation of this SAME invoice can still race past the
    // findFirst above and also attempt this create. Postgres aborts the
    // whole surrounding transaction on the partial unique index's
    // violation (25P02 — no further query is possible on this same
    // transaction without a SAVEPOINT), so the loser cannot recover
    // in-place: the violation is left to propagate and fail this entire
    // `activateEntitlements()` transaction. The WINNER's transaction still
    // commits with exactly one row, so the guarantee holds at the DB
    // boundary; the loser's caller sees a normal Prisma unique-constraint
    // error (code P2002) and can retry, exactly like the existing P2034
    // (serialization conflict) handling in payments/validate/route.ts.
    const created = await tx.entitlement.create({
      data: {
        userId,
        productCode: ARIA_CANONICAL_PRODUCT_CODE,
        label: product.label,
        status: 'ACTIVE',
        startsAt: now,
        endsAt: computeEndsAt(product, now),
        sourceInvoiceId: invoiceId,
        metadata: { courseKey },
      },
      select: { id: true },
    });
    entitlementId = created.id;
  }

  const existingScope = await tx.ariaEntitlementScope.findFirst({
    where: { entitlementId, kind: 'COURSE', courseKey },
    select: { id: true },
  });
  if (!existingScope) {
    await tx.ariaEntitlementScope.create({
      data: { entitlementId, kind: 'COURSE', courseKey },
    });
  }
}

// ─── Suspension (on CANCEL) ─────────────────────────────────────────────────

export interface SuspensionResult {
  /** Number of entitlements suspended */
  suspended: number;
  /** Product codes that were suspended */
  suspendedCodes: string[];
}

/**
 * Suspend all active entitlements linked to a cancelled invoice.
 *
 * @param invoiceId - The cancelled invoice ID
 * @param reason - Reason for suspension
 * @param tx - Prisma transaction client (for atomicity with CANCEL)
 * @returns Suspension result summary
 */
export async function suspendEntitlements(
  invoiceId: string,
  reason: string,
  tx: TxClient
): Promise<SuspensionResult> {
  // Find all active entitlements for this invoice
  const active = await tx.entitlement.findMany({
    where: {
      sourceInvoiceId: invoiceId,
      status: 'ACTIVE',
    },
    select: { id: true, productCode: true },
  });

  if (active.length === 0) {
    return { suspended: 0, suspendedCodes: [] };
  }

  const now = new Date();

  // Suspend all
  await tx.entitlement.updateMany({
    where: {
      sourceInvoiceId: invoiceId,
      status: 'ACTIVE',
    },
    data: {
      status: 'SUSPENDED',
      suspendedAt: now,
      suspendReason: reason,
    },
  });

  return {
    suspended: active.length,
    suspendedCodes: active.map((e) => e.productCode),
  };
}

// ─── Query helpers ──────────────────────────────────────────────────────────

/**
 * Check if a user has an active entitlement for a specific product code.
 */
export async function hasEntitlement(
  userId: string,
  productCode: string
): Promise<boolean> {
  const now = new Date();
  const entitlement = await prisma.entitlement.findFirst({
    where: {
      userId,
      productCode,
      status: 'ACTIVE',
      startsAt: { lte: now },
      OR: [
        { endsAt: null },
        { endsAt: { gt: now } },
      ],
    },
    select: { id: true },
  });
  return entitlement !== null;
}

/**
 * Check if a user has an active entitlement granting a specific feature.
 */
export async function hasFeature(
  userId: string,
  feature: string
): Promise<boolean> {
  const now = new Date();
  const entitlements = await prisma.entitlement.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      startsAt: { lte: now },
      OR: [
        { endsAt: null },
        { endsAt: { gt: now } },
      ],
    },
    select: { productCode: true },
  });

  for (const ent of entitlements) {
    const product = getProductDefinition(ent.productCode);
    if (product && product.features.includes(feature)) {
      return true;
    }
  }
  return false;
}

/**
 * Get all active entitlements for a user.
 */
export async function getUserEntitlements(userId: string): Promise<Array<{
  id: string;
  productCode: string;
  label: string;
  status: string;
  startsAt: Date;
  endsAt: Date | null;
  features: string[];
}>> {
  const now = new Date();
  const entitlements = await prisma.entitlement.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      startsAt: { lte: now },
      OR: [
        { endsAt: null },
        { endsAt: { gt: now } },
      ],
    },
    select: {
      id: true,
      productCode: true,
      label: true,
      status: true,
      startsAt: true,
      endsAt: true,
    },
    orderBy: { startsAt: 'desc' },
  });

  return entitlements.map((e) => {
    const product = getProductDefinition(e.productCode);
    return {
      ...e,
      features: product?.features ?? [],
    };
  });
}

/**
 * Get all entitlements linked to an invoice (any status).
 */
export async function getInvoiceEntitlements(invoiceId: string): Promise<Array<{
  id: string;
  productCode: string;
  label: string;
  status: string;
  userId: string;
}>> {
  return prisma.entitlement.findMany({
    where: { sourceInvoiceId: invoiceId },
    select: {
      id: true,
      productCode: true,
      label: true,
      status: true,
      userId: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}
