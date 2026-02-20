/**
 * GET /api/invoices/:id/receipt/pdf — Stream payment receipt PDF.
 *
 * RBAC: same as invoice PDF (ADMIN/ASSISTANTE see all, PARENT scoped).
 * Precondition: invoice.status === 'PAID' with paidAt + paidAmount.
 * Appends RECEIPT_RENDERED audit event on success only.
 *
 * No-leak design:
 * - ALL deny cases return canonical 404 (same as invoice PDF route).
 * - Precondition failures (not PAID) return 409.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  renderReceiptPDF,
  createInvoiceEvent,
  appendInvoiceEvent,
} from '@/lib/invoice';
import { notFoundResponse, buildInvoiceScopeWhere } from '@/lib/invoice/not-found';
import type { InvoiceEvent, ReceiptData } from '@/lib/invoice';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return notFoundResponse();
    }

    const { id } = await params;
    const userRole = (session.user as { role?: string }).role;
    const userEmail = session.user.email;

    const scopeWhere = buildInvoiceScopeWhere(id, userRole, userEmail);
    if (!scopeWhere) {
      return notFoundResponse();
    }

    // Single DB hit with scope
    const invoice = await prisma.invoice.findFirst({
      where: scopeWhere,
      select: {
        id: true,
        number: true,
        status: true,
        issuedAt: true,
        total: true,
        currency: true,
        customerName: true,
        customerEmail: true,
        customerAddress: true,
        issuerName: true,
        issuerAddress: true,
        issuerMF: true,
        paidAt: true,
        paidAmount: true,
        paymentMethod: true,
        paymentReference: true,
        events: true,
      },
    });

    if (!invoice) {
      return notFoundResponse();
    }

    // Precondition: must be PAID with payment data
    if (invoice.status !== 'PAID' || !invoice.paidAt || invoice.paidAmount == null) {
      return NextResponse.json(
        { error: 'Le reçu n\'est disponible que pour les factures payées.' },
        { status: 409 }
      );
    }

    // Build receipt data
    const receiptData: ReceiptData = {
      invoiceNumber: invoice.number,
      invoiceIssuedAt: invoice.issuedAt.toISOString(),
      paidAt: invoice.paidAt.toISOString(),
      paidAmount: invoice.paidAmount,
      currency: invoice.currency,
      paymentMethod: invoice.paymentMethod,
      paymentReference: invoice.paymentReference,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerAddress: invoice.customerAddress,
      issuerName: invoice.issuerName,
      issuerAddress: invoice.issuerAddress,
      issuerMF: invoice.issuerMF,
    };

    // Render PDF
    const pdfBuffer = await renderReceiptPDF(receiptData);

    // Append RECEIPT_RENDERED event (fire-and-forget, don't block response)
    const events: InvoiceEvent[] = appendInvoiceEvent(
      invoice.events,
      createInvoiceEvent('RECEIPT_RENDERED', session.user.id, { by: 'session' })
    );
    prisma.invoice.update({
      where: { id: invoice.id },
      data: { events: JSON.parse(JSON.stringify(events)) },
    }).catch((err: unknown) => {
      console.error('[Receipt] Failed to append RECEIPT_RENDERED event:', err);
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="recu_${invoice.number}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'private, max-age=3600',
      },
    });

  } catch (error) {
    console.error('[GET /api/invoices/:id/receipt/pdf]', error);
    return notFoundResponse();
  }
}
