/**
 * POST /api/admin/invoices/[id]/send
 *
 * Generate a signed access token, send invoice email to customer.
 * RBAC: ADMIN / ASSISTANTE only.
 * Precondition: invoice status must be SENT.
 * Throttle: max 3 emails per 24h per invoice (429 if exceeded).
 *
 * No-leak: admin-only endpoint, so 401/404 are acceptable (not public).
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  canPerformStatusAction,
  createAccessToken,
  TOKEN_EXPIRY_HOURS,
  createInvoiceEvent,
  appendInvoiceEvent,
  millimesToDisplay,
} from '@/lib/invoice';
import { sendInvoiceEmail } from '@/lib/invoice/send-email';
import type { InvoiceEvent } from '@/lib/invoice';

/** Max emails per invoice per 24h window. */
const MAX_EMAILS_PER_24H = 3;

/** Frozen 404 payload (no-leak for admin endpoints). */
const NOT_FOUND = Object.freeze({ error: 'Facture introuvable' });

/**
 * Count INVOICE_SENT_EMAIL events in the last 24h from the events array.
 */
function countRecentSendEvents(events: unknown): number {
  if (!Array.isArray(events)) return 0;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return (events as Array<{ type?: string; at?: string }>).filter(
    (e) => e.type === 'INVOICE_SENT_EMAIL' && typeof e.at === 'string' && e.at >= cutoff
  ).length;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ─── Auth ─────────────────────────────────────────────────────────
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    const role = session.user.role;
    if (!canPerformStatusAction(role)) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    const { id } = await params;

    // ─── Fetch invoice (single DB hit) ────────────────────────────────
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        customerName: true,
        customerEmail: true,
        events: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    // ─── Precondition: must be SENT ───────────────────────────────────
    if (invoice.status !== 'SENT') {
      return NextResponse.json(
        { error: `La facture doit être au statut "SENT" pour être envoyée par email. Statut actuel : "${invoice.status}".` },
        { status: 409 }
      );
    }

    // ─── Validate customer email ──────────────────────────────────────
    if (!invoice.customerEmail) {
      return NextResponse.json(
        { error: 'Aucune adresse email client renseignée sur cette facture.' },
        { status: 422 }
      );
    }

    // ─── Throttle: max 3 emails / 24h / invoice ──────────────────────
    const recentCount = countRecentSendEvents(invoice.events);
    if (recentCount >= MAX_EMAILS_PER_24H) {
      return NextResponse.json(
        { error: `Limite atteinte : ${MAX_EMAILS_PER_24H} envois maximum par 24h pour cette facture. Réessayez plus tard.` },
        { status: 429 }
      );
    }

    // ─── Generate access token ────────────────────────────────────────
    const { rawToken, tokenId, expiresAt } = await createAccessToken(
      invoice.id,
      session.user.id,
      TOKEN_EXPIRY_HOURS
    );

    // ─── Build PDF URL with token ─────────────────────────────────────
    const baseUrl = process.env.NEXTAUTH_URL || 'https://nexusreussite.academy';
    const pdfUrl = `${baseUrl}/api/invoices/${invoice.id}/pdf?token=${rawToken}`;

    // ─── Send email ───────────────────────────────────────────────────
    await sendInvoiceEmail(invoice.customerEmail, {
      invoiceNumber: invoice.number,
      customerName: invoice.customerName,
      formattedTotal: millimesToDisplay(invoice.total),
      pdfUrl,
      expiryHours: TOKEN_EXPIRY_HOURS,
    });

    // ─── Append audit events (structured details) ─────────────────────
    let events: InvoiceEvent[] = appendInvoiceEvent(
      invoice.events,
      createInvoiceEvent('INVOICE_SENT_EMAIL', session.user.id, {
        to: invoice.customerEmail,
        tokenExpiresAt: expiresAt.toISOString(),
      })
    );
    events = appendInvoiceEvent(
      events,
      createInvoiceEvent('TOKEN_CREATED', session.user.id, {
        tokenId,
        expiresAt: expiresAt.toISOString(),
        delivery: 'email',
      })
    );

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { events: JSON.parse(JSON.stringify(events)) },
    });

    // ─── Response ─────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      sentTo: invoice.customerEmail,
      expiresAt: expiresAt.toISOString(),
      expiryHours: TOKEN_EXPIRY_HOURS,
    }, { status: 200 });

  } catch (error) {
    console.error('[POST /api/admin/invoices/[id]/send]', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur.' },
      { status: 500 }
    );
  }
}
