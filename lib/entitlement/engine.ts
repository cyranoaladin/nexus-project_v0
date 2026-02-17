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
import {
  isValidProductCode,
  getProductDefinition,
  computeEndsAt,
} from './types';
import type { ProductCode } from './types';

/** Prisma transaction client type. */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

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
