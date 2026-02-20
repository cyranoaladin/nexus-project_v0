/**
 * GET /api/invoices/:id/pdf — Stream invoice PDF with RBAC + token access.
 *
 * Two access paths:
 * 1. Session-based (RBAC): ADMIN/ASSISTANTE see all, PARENT scoped by email
 * 2. Token-based (?token=...): signed link from email, 72h expiry
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
import { notFoundResponse, buildInvoiceScopeWhere } from '@/lib/invoice/not-found';

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
      'Cache-Control': 'private, max-age=3600',
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

    // ─── Path 1: Token-based access (external link from email) ────────
    if (token) {
      const verification = await verifyAccessToken(token);

      if (!verification.valid || verification.invoiceId !== id) {
        return notFoundResponse();
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id },
        select: { id: true, number: true, pdfPath: true },
      });

      if (!invoice || !invoice.pdfPath) {
        return notFoundResponse();
      }

      const pdfBuffer = await readInvoicePDF(invoice.pdfPath);
      return streamPdf(pdfBuffer, invoice.number);
    }

    // ─── Path 2: Session-based RBAC access ────────────────────────────
    const session = await auth();
    if (!session?.user?.id) {
      return notFoundResponse();
    }

    const userRole = (session.user as { role?: string }).role;
    const userEmail = session.user.email;

    const scopeWhere = buildInvoiceScopeWhere(id, userRole, userEmail);
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
      },
    });

    if (!invoice || !invoice.pdfPath) {
      return notFoundResponse();
    }

    const pdfBuffer = await readInvoicePDF(invoice.pdfPath);
    return streamPdf(pdfBuffer, invoice.number);

  } catch (error) {
    console.error('[GET /api/invoices/:id/pdf]', error);
    return notFoundResponse();
  }
}
