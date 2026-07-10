/**
 * POST /api/admin/invoices — Create invoice + atomic number + PDF + store.
 * GET  /api/admin/invoices — List invoices (paginated).
 *
 * Access: ADMIN, ASSISTANTE only.
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { UserRole, type InvoiceItem, type Prisma } from '@prisma/client';
import { z } from 'zod';
import { civilDateSchema } from '@/lib/validation/common';
import {
  generateInvoiceNumber,
  renderInvoicePDF,
  storeInvoicePDF,
  getInvoiceUrl,
  InvoiceOverflowError,
  createInvoiceEvent,
  appendInvoiceEvent,
  assertMillimes,
  MillimesValidationError,
} from '@/lib/invoice';
import type { CreateInvoiceRequest, InvoiceData, TaxRegime } from '@/lib/invoice';

// ─── Default issuer (can be overridden per request) ─────────────────────────

import { LEGAL } from '@/lib/legal';

const DEFAULT_ISSUER = {
  name: LEGAL.entity.name,
  address: LEGAL.addresses.siege.full,
  mf: LEGAL.entity.taxId,
  rne: LEGAL.entity.rne,
  phone: LEGAL.contact.phone,
  email: LEGAL.contact.email,
  web: LEGAL.web.domain,
  slogan: 'Viser. Atteindre. Dépasser.',
  logoPath: path.join(process.cwd(), 'public', 'images', 'logo_slogan_nexus.png'),
};

const STAFF_ROLES = new Set<string>([UserRole.ADMIN, UserRole.ASSISTANTE]);

const invoiceItemInputSchema = z.object({
  label: z.string().trim().min(1).max(180),
  description: z.string().trim().max(600).nullable().optional(),
  qty: z.number().int().positive().max(100),
  unitPrice: z.number().int().nonnegative(),
  total: z.number().optional(), // client-sent, stripped — recalculated server-side
}).strict().transform(({ total: _total, ...rest }) => rest);

const invoiceIssuerInputSchema = z.object({
  name: z.string().trim().min(1).max(180).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  mf: z.string().trim().min(1).max(80).optional(),
  rne: z.string().trim().max(80).nullable().optional(),
  phone: z.string().trim().max(80).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  web: z.string().trim().max(180).nullable().optional(),
  slogan: z.string().trim().max(180).nullable().optional(),
  logoPath: z.string().trim().max(500).nullable().optional(),
  stampPath: z.string().trim().max(500).nullable().optional(),
}).strict();

const createInvoiceBodySchema = z.object({
  number: z.string().trim().min(1).max(80).optional(),
  issuedAt: civilDateSchema.optional(),
  dueAt: civilDateSchema.nullable().optional(),
  customer: z.object({
    name: z.string().trim().min(1).max(180),
    email: z.string().trim().email().nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
    customerId: z.string().trim().max(120).nullable().optional(),
  }).strict(),
  items: z.array(invoiceItemInputSchema).min(1).max(50),
  discountTotal: z.number().int().nonnegative().optional(),
  taxRegime: z.enum(['TVA_INCLUSE', 'TVA_NON_APPLICABLE', 'EXONERATION']).optional(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'CLICTOPAY']).nullable().optional(),
  paymentDetails: z.record(z.unknown()).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  issuer: invoiceIssuerInputSchema.optional(),
}).strict();

const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'CANCELLED']).optional(),
  search: z.string().trim().min(1).max(120).optional(),
}).strict();

function hasStaffAccess(role?: string | null) {
  return !!role && STAFF_ROLES.has(role);
}

function validationFailed() {
  return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
}

function safeErrorSummary(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: 'UnknownError', message: 'Unknown error' };
}

// ─── POST: Create Invoice ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    if (!hasStaffAccess(userRole)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Parse body
    const parsedBody = createInvoiceBodySchema.safeParse(await request.json());
    if (!parsedBody.success) return validationFailed();
    const body = parsedBody.data as CreateInvoiceRequest;

    // ─── Millimes integer validation (422 if non-int) ────────────────
    for (let i = 0; i < body.items.length; i++) {
      assertMillimes(body.items[i].unitPrice, `items[${i}].unitPrice`);
      assertMillimes(body.items[i].qty, `items[${i}].qty`);
    }
    if (body.discountTotal !== undefined && body.discountTotal !== null) {
      assertMillimes(body.discountTotal, 'discountTotal');
    }

    // Compute line totals and subtotal
    // All amounts in millimes (int) — zero float arithmetic
    const computedItems = body.items.map((item, index) => ({
      label: item.label,
      description: item.description ?? null,
      qty: item.qty,
      unitPrice: item.unitPrice,
      total: item.qty * item.unitPrice, // pure int multiplication
      sortOrder: index,
    }));

    const subtotal = computedItems.reduce((sum, item) => sum + item.total, 0);
    const discountTotal = body.discountTotal ?? 0;
    const taxRegime: TaxRegime = body.taxRegime ?? 'TVA_NON_APPLICABLE';
    const totalBeforeTaxDisplay = subtotal - discountTotal;
    const taxTotal = taxRegime === 'TVA_INCLUSE'
      ? totalBeforeTaxDisplay - Math.round(totalBeforeTaxDisplay / 1.06)
      : 0;
    const total = totalBeforeTaxDisplay; // TVA incluse: final TTC is already included in line prices.

    // Generate atomic invoice number
    const requestedNumber = body.number?.trim();
    if (requestedNumber) {
      const existing = await prisma.invoice.findUnique({ where: { number: requestedNumber } });
      if (existing) {
        return NextResponse.json({ error: 'Numéro de facture déjà utilisé' }, { status: 409 });
      }
    }
    const invoiceNumber = requestedNumber || await generateInvoiceNumber();

    // Merge issuer
    const issuer = {
      ...DEFAULT_ISSUER,
      ...body.issuer,
    };

    // Create invoice in DB
    const invoice = await prisma.invoice.create({
      data: {
        number: invoiceNumber,
        status: 'DRAFT',
        issuedAt: body.issuedAt ? new Date(body.issuedAt) : new Date(),
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        customerName: body.customer.name,
        customerEmail: body.customer.email ?? null,
        customerAddress: body.customer.address ?? null,
        customerId: body.customer.customerId ?? null,
        issuerName: issuer.name,
        issuerAddress: issuer.address,
        issuerMF: issuer.mf,
        issuerRNE: issuer.rne ?? null,
        currency: 'TND',
        subtotal,
        discountTotal,
        taxTotal,
        total,
        taxRegime,
        paymentMethod: body.paymentMethod ?? null,
        createdByUserId: session.user.id,
        notes: body.notes ?? null,
        events: JSON.parse(JSON.stringify([createInvoiceEvent('INVOICE_CREATED', session.user.id, `Facture ${invoiceNumber} créée`)])) as Prisma.InputJsonValue,
        items: {
          create: computedItems,
        },
      },
      include: { items: true },
    });

    // Build InvoiceData for PDF rendering
    const pdfData: InvoiceData = {
      number: invoice.number,
      status: 'DRAFT',
      issuedAt: invoice.issuedAt.toISOString(),
      dueAt: invoice.dueAt?.toISOString() ?? null,
      issuer: {
        name: invoice.issuerName,
        address: invoice.issuerAddress,
        mf: invoice.issuerMF,
        rne: invoice.issuerRNE,
        phone: issuer.phone,
        email: issuer.email,
        web: issuer.web,
        slogan: issuer.slogan,
        logoPath: issuer.logoPath,
      },
      customer: {
        name: invoice.customerName,
        email: invoice.customerEmail,
        address: invoice.customerAddress,
        customerId: invoice.customerId,
      },
      items: ((invoice as Record<string, unknown>).items as InvoiceItem[]).map((item: InvoiceItem) => ({
        label: item.label,
        description: item.description,
        qty: item.qty,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      discountTotal: invoice.discountTotal,
      taxTotal: invoice.taxTotal,
      total: invoice.total,
      taxRegime: invoice.taxRegime as TaxRegime,
      paymentMethod: body.paymentMethod ?? null,
      paymentDetails: body.paymentDetails ?? (invoice.notes ? { notes: invoice.notes } : null),
    };

    // Generate PDF
    const pdfBuffer = await renderInvoicePDF(pdfData);

    // Store PDF
    const pdfPath = await storeInvoicePDF(invoice.number, pdfBuffer);
    const pdfUrl = getInvoiceUrl(invoice.id);

    // Update invoice with PDF path + audit event (append-only, sorted ASC)
    const updatedEvents = JSON.parse(JSON.stringify(
      appendInvoiceEvent(
        invoice.events,
        createInvoiceEvent('PDF_RENDERED', session.user.id, `PDF stocké: ${pdfPath}`)
      )
    )) as Prisma.InputJsonValue;
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        pdfPath,
        pdfUrl,
        events: updatedEvents,
      },
    });

    return NextResponse.json({
      invoiceId: invoice.id,
      number: invoice.number,
      pdfUrl,
    }, { status: 201 });

  } catch (error) {
    if (error instanceof MillimesValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof InvoiceOverflowError) {
      return NextResponse.json({
        error: 'Dépassement de page',
        details: error.message,
      }, { status: 422 });
    }

    console.error('[POST /api/admin/invoices] Error:', safeErrorSummary(error));
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

// ─── GET: List Invoices ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    if (!hasStaffAccess(userRole)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = listInvoicesQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsedQuery.success) return validationFailed();
    const { page, limit, status, search } = parsedQuery.data;

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { number: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: {
          id: true,
          number: true,
          status: true,
          issuedAt: true,
          dueAt: true,
          customerName: true,
          customerEmail: true,
          currency: true,
          subtotal: true,
          discountTotal: true,
          taxTotal: true,
          total: true,
          taxRegime: true,
          paymentMethod: true,
          paidAt: true,
          paidAmount: true,
          pdfUrl: true,
          createdAt: true,
          updatedAt: true,
          items: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              label: true,
              description: true,
              qty: true,
              unitPrice: true,
              total: true,
              productCode: true,
              sortOrder: true,
            },
          },
        },
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('[GET /api/admin/invoices] Error:', safeErrorSummary(error));
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
