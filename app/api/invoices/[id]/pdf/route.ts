/**
 * GET /api/invoices/:id/pdf — Stream invoice PDF with RBAC + token access.
 *
 * Every read requires session-based financial authority.
 * A signed email link adds expiry/revocation checks; it never grants authority by itself.
 *
 * No-leak design:
 * - ALL deny cases (absent, out-of-scope, token invalid/expired/revoked, forbidden role)
 *   return the EXACT SAME 404 response (payload, status, headers).
 * - No 401/403 on this endpoint — only 404 or 200.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { readInvoicePDF, verifyAccessToken } from '@/lib/invoice';
import { notFoundResponse, buildInvoiceAccessWhere } from '@/lib/invoice/not-found';
import { recordInvoiceDownload } from '@/lib/invoice/download-audit';
import { isPublishedInvoice } from '@/lib/invoice/publication';

/**
 * Stream a PDF response from a buffer.
 */
function streamPdf(pdfBuffer: Buffer, invoiceNumber: string): NextResponse {
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="facture_${invoiceNumber}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.nextUrl.searchParams.get('token');

    // Optional signed-link constraint, never a replacement for session authority.
    if (token) {
      const verification = await verifyAccessToken(token);

      if (!verification.valid || verification.invoiceId !== id) {
        return notFoundResponse();
      }


    }

    // Every successful read uses the same scoped session query and audit.
    const session = await auth();
    if (!session?.user?.id) {
      return notFoundResponse();
    }

    const scopeWhere = await buildInvoiceAccessWhere(id, {
      id: session.user.id,
      role: (session.user as { role?: string }).role,
      email: session.user.email,
    });
    if (!scopeWhere) {
      return notFoundResponse();
    }

    // Single DB hit: findFirst with scope baked in
    const invoice = await prisma.invoice.findFirst({
      where: scopeWhere,
      select: {
        id: true,
        number: true,
        pdfPath: true,
        status: true,
        events: true,
      },
    });

    if (!invoice || !invoice.pdfPath
      || (session.user.role === 'PARENT' && !isPublishedInvoice(invoice))) {
      return notFoundResponse();
    }

    const pdfBuffer = await readInvoicePDF(invoice.pdfPath);
    await recordInvoiceDownload({ invoiceId: invoice.id, actorUserId: session.user.id, action: 'PDF_READ' });
    return streamPdf(pdfBuffer, invoice.number);

  } catch {
    console.error('INVOICE_PDF_READ_FAILED');
    return notFoundResponse();
  }
}
