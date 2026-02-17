/**
 * POST /api/admin/invoices — Create invoice + atomic number + PDF + store.
 * GET  /api/admin/invoices — List invoices (paginated).
 *
 * Access: ADMIN, ASSISTANTE only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { InvoiceItem, Prisma } from '@prisma/client';
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
import type { CreateInvoiceRequest, InvoiceData, TaxRegime, InvoiceEvent } from '@/lib/invoice';

// ─── Default issuer (can be overridden per request) ─────────────────────────

const DEFAULT_ISSUER = {
  name: 'M&M Academy (Nexus Réussite)',
  address: 'Résidence Narjess 2, Bloc D, Appt 12, Raoued 2056, Ariana, Tunisie',
  mf: '1XXXXXX/X/A/M/000',
  rne: null as string | null,
};

// ─── POST: Create Invoice ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    if (userRole !== 'ADMIN' && userRole !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Parse body
    const body: CreateInvoiceRequest = await request.json();

    // Validate required fields
    if (!body.customer?.name) {
      return NextResponse.json({ error: 'customer.name est requis' }, { status: 400 });
    }
    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Au moins un item est requis' }, { status: 400 });
    }

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
    const taxTotal = 0; // TVA non applicable by default
    const total = subtotal - discountTotal + taxTotal; // pure int arithmetic

    const taxRegime: TaxRegime = body.taxRegime ?? 'TVA_NON_APPLICABLE';

    // Generate atomic invoice number
    const invoiceNumber = await generateInvoiceNumber();

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
        issuedAt: new Date(),
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
      paymentDetails: null,
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

    console.error('[POST /api/admin/invoices] Error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

// ─── GET: List Invoices ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    if (userRole !== 'ADMIN' && userRole !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const status = searchParams.get('status');
    const search = searchParams.get('search');

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
        include: { items: { orderBy: { sortOrder: 'asc' } } },
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
    console.error('[GET /api/admin/invoices] Error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
