import { assertNoRetiredCreditProducts, LegacyCreditPurchaseError } from '@/lib/entitlement/credit-retirement';
import { serializeError } from '@/lib/utils/serialize-error';
/**
 * PATCH /api/admin/invoices/:id — Invoice status actions.
 *
 * Actions: MARK_SENT, MARK_PAID, CANCEL
 * Access: ADMIN, ASSISTANTE only.
 *
 * Security:
 * - findFirst scoped (single DB hit, no info leak)
 * - 404 for not found / out of scope
 * - 409 for invalid transition
 * - 422 for validation errors (millimes, missing payment, etc.)
 * - Audit trail: append-only events on every action
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  validateTransition,
  canPerformStatusAction,
  createInvoiceEvent,
  appendInvoiceEvent,
} from '@/lib/invoice';
import type {
  InvoiceAction,
  MarkPaidMeta,
  CancelMeta,
  InvoiceStatusType,
  InvoiceEvent,
} from '@/lib/invoice';
import { activateEntitlements, suspendEntitlements, isCanonicalAriaAccessUniquenessConflict } from '@/lib/entitlement';

/** Frozen 404 payload — identical for not-found and out-of-scope. */
const NOT_FOUND = Object.freeze({ error: 'Facture introuvable' });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ─── Auth ──────────────────────────────────────────────────────────
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    if (!canPerformStatusAction(userRole)) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    const { id } = await params;
    const userId = session.user.id;

    // ─── Parse body ────────────────────────────────────────────────────
    const body = await request.json();
    const action = body.action as InvoiceAction | undefined;

    if (!action || !['MARK_SENT', 'MARK_PAID', 'CANCEL'].includes(action)) {
      return NextResponse.json(
        { error: 'Action invalide. Actions autorisées : MARK_SENT, MARK_PAID, CANCEL.' },
        { status: 400 }
      );
    }

    // ─── Fetch invoice (single DB hit) ─────────────────────────────────
    const invoice = await prisma.invoice.findFirst({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        events: true,
        items: { select: { productCode: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    // ─── Validate transition ───────────────────────────────────────────
    const currentStatus = invoice.status as InvoiceStatusType;
    const transitionResult = validateTransition(
      currentStatus,
      action,
      body.meta,
      invoice.total
    );

    if (!transitionResult.valid) {
      return NextResponse.json(
        { error: transitionResult.error },
        { status: transitionResult.httpStatus ?? 409 }
      );
    }

    // Idempotence: already in target status → 200 no-op, no event, no DB write
    if (transitionResult.noop) {
      return NextResponse.json({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        noop: true,
      }, { status: 200 });
    }

    if (action === 'MARK_PAID') assertNoRetiredCreditProducts(invoice.items ?? []);

    const targetStatus = transitionResult.targetStatus!;

    // ─── Build update data ─────────────────────────────────────────────
    const updateData: Record<string, unknown> = {
      status: targetStatus,
    };

    // Build audit events
    const meta = body.meta ?? {};
    let events: InvoiceEvent[] = appendInvoiceEvent(
      invoice.events,
      createInvoiceEvent(
        'STATUS_CHANGED',
        userId,
        `${currentStatus} → ${targetStatus}${meta.note ? ` — ${meta.note}` : ''}`
      )
    );

    // Action-specific data + events
    if (action === 'MARK_SENT') {
      events = appendInvoiceEvent(
        events,
        createInvoiceEvent('INVOICE_SENT', userId, meta.note ?? null)
      );
    }

    if (action === 'MARK_PAID') {
      const _paidMeta = meta as MarkPaidMeta['payment'] extends infer P ? { payment: P } : never;
      const payment = (body.meta as MarkPaidMeta).payment;

      updateData.paidAt = payment.paidAt ? new Date(payment.paidAt) : new Date();
      updateData.paidAmount = payment.amountPaid;
      updateData.paymentReference = payment.reference ?? null;
      updateData.paymentMethod = payment.method;

      events = appendInvoiceEvent(
        events,
        createInvoiceEvent(
          'INVOICE_PAID',
          userId,
          `${payment.method}${payment.reference ? ` ref:${payment.reference}` : ''} — ${payment.amountPaid} millimes`
        )
      );
    }

    if (action === 'CANCEL') {
      const cancelMeta = body.meta as CancelMeta | undefined;
      updateData.cancelReason = cancelMeta?.reason ?? cancelMeta?.note ?? null;
      updateData.cancelledAt = new Date();

      events = appendInvoiceEvent(
        events,
        createInvoiceEvent(
          'INVOICE_CANCELLED',
          userId,
          cancelMeta?.reason ?? cancelMeta?.note ?? null
        )
      );
    }

    // ─── Atomic update (transaction for terminal transitions) ─────────
    const isTerminal = action === 'MARK_PAID' || action === 'CANCEL';

    if (isTerminal) {
      // Terminal transitions: update + revoke tokens + entitlements — all atomic
      const updated = await prisma.$transaction(async (tx) => {
        // 1. Update invoice status + fields
        updateData.events = JSON.parse(JSON.stringify(events)) as Prisma.InputJsonValue;
        const inv = await tx.invoice.update({
          where: { id: invoice.id },
          data: updateData,
          select: {
            id: true, number: true, status: true, updatedAt: true,
            paidAt: true, paidAmount: true, paymentReference: true,
            cancelReason: true, cancelledAt: true,
          },
        });

        // 2. Revoke all active tokens
        const revokeResult = await tx.invoiceAccessToken.updateMany({
          where: { invoiceId: invoice.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        let txEvents = events;

        // 3. Append TOKENS_REVOKED event if any were revoked
        if (revokeResult.count > 0) {
          txEvents = appendInvoiceEvent(
            txEvents,
            createInvoiceEvent('TOKENS_REVOKED', userId, { count: revokeResult.count })
          );
        }

        // 4. Entitlement engine — activate on PAID, suspend on CANCEL
        if (action === 'MARK_PAID') {
          const activation = await activateEntitlements(invoice.id, tx);
          if (activation.created > 0 || activation.extended > 0 || activation.creditsGranted > 0) {
            txEvents = appendInvoiceEvent(
              txEvents,
              createInvoiceEvent('ENTITLEMENTS_ACTIVATED', userId, {
                created: activation.created,
                extended: activation.extended,
                credits: activation.creditsGranted,
                codes: activation.activatedCodes.join(','),
              })
            );
          } else if (activation.noBeneficiary) {
            txEvents = appendInvoiceEvent(
              txEvents,
              createInvoiceEvent('ENTITLEMENTS_SKIPPED', userId, {
                reason: 'no_beneficiary',
                skippedItems: activation.skippedItems,
              })
            );
          } else if (activation.skippedItems > 0 && activation.activatedCodes.length === 0) {
            txEvents = appendInvoiceEvent(
              txEvents,
              createInvoiceEvent('ENTITLEMENTS_SKIPPED', userId, {
                reason: 'no_product_code',
                skippedItems: activation.skippedItems,
              })
            );
          }
        }

        if (action === 'CANCEL') {
          const suspension = await suspendEntitlements(invoice.id, 'Invoice cancelled', tx);
          if (suspension.suspended > 0) {
            txEvents = appendInvoiceEvent(
              txEvents,
              createInvoiceEvent('ENTITLEMENTS_SUSPENDED', userId, {
                suspended: suspension.suspended,
                codes: suspension.suspendedCodes.join(','),
              })
            );
          }
        }

        // 5. Final events update (single write with all accumulated events)
        if (txEvents !== events) {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { events: JSON.parse(JSON.stringify(txEvents)) as Prisma.InputJsonValue },
          });
        }

        return inv;
      });

      return NextResponse.json(updated, { status: 200 });
    }

    // Non-terminal transitions: simple update (no revocation needed)
    updateData.events = JSON.parse(JSON.stringify(events)) as Prisma.InputJsonValue;
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: updateData,
      select: {
        id: true, number: true, status: true, updatedAt: true,
        paidAt: true, paidAmount: true, paymentReference: true,
        cancelReason: true, cancelledAt: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });

  } catch (error) {
    if (error instanceof LegacyCreditPurchaseError) {
      return NextResponse.json({ code: error.code, error: error.message }, { status: 409 });
    }
    // Cubic P2: MARK_PAID also calls activateEntitlements() inside its own
    // transaction, so it can race the SAME canonical ARIA_ACCESS partial
    // unique index (entitlements_aria_access_invoice_key on
    // userId+sourceInvoiceId) as payments/validate/route.ts — narrowly
    // scoped to THAT constraint specifically, matching the identical
    // handling there (never every P2002: an unrelated unique-constraint
    // failure is a real integrity bug, not a race to retry away).
    if (error && typeof error === 'object' && 'code' in error
      && (error as { code: string }).code === 'P2002'
      && isCanonicalAriaAccessUniquenessConflict(error)) {
      return NextResponse.json(
        { error: 'Conflit de validation concurrent détecté. Veuillez réessayer.' },
        { status: 409 }
      );
    }
    console.error('[PATCH /api/admin/invoices/:id]', serializeError(error));
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
