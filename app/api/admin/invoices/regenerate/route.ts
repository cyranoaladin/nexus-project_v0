export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import {
  renderInvoicePDF,
  generateInvoiceNumber,
  storeInvoicePDF,
  getInvoiceUrl,
  createInvoiceEvent,
  appendInvoiceEvent,
  tndToMillimes,
} from '@/lib/invoice';
import type { InvoiceData, TaxRegime } from '@/lib/invoice';
import { Prisma } from '@prisma/client';

const DOCUMENTS_DIR = path.join(process.cwd(), 'storage', 'documents');

const regenerateSchema = z.object({
  paymentId: z.string().cuid(),
});

async function generateInvoiceForPayment(
  payment: {
    id: string;
    userId: string;
    amount: number;
    description: string;
    method: string | null;
    user: { firstName: string | null; lastName: string | null; email: string };
  },
  validatorUserId: string,
): Promise<{ invoiceId: string; documentId: string }> {
  const parentName = [payment.user.firstName, payment.user.lastName]
    .filter(Boolean).join(' ') || payment.user.email;

  const invoiceNumber = await generateInvoiceNumber();

  const amountMillimes = tndToMillimes(payment.amount);
  const invoice = await prisma.invoice.create({
    data: {
      number: invoiceNumber,
      status: 'PAID',
      issuedAt: new Date(),
      customerName: parentName,
      customerEmail: payment.user.email,
      currency: 'TND',
      subtotal: amountMillimes,
      discountTotal: 0,
      taxTotal: 0,
      total: amountMillimes,
      taxRegime: 'TVA_NON_APPLICABLE',
      paymentMethod: payment.method === 'bank_transfer' ? 'BANK_TRANSFER' : 'CASH',
      paidAt: new Date(),
      paidAmount: amountMillimes,
      createdByUserId: validatorUserId,
      beneficiaryUserId: payment.userId,
      events: JSON.parse(JSON.stringify([
        createInvoiceEvent('INVOICE_CREATED', validatorUserId, `Facture régénérée pour paiement ${payment.id}`),
        createInvoiceEvent('INVOICE_PAID', validatorUserId, `Paiement validé — virement bancaire`),
      ])) as Prisma.InputJsonValue,
      items: {
        create: [{
          label: payment.description,
          qty: 1,
          unitPrice: amountMillimes,
          total: amountMillimes,
          sortOrder: 0,
        }],
      },
    },
    include: { items: true },
  });

  const pdfData: InvoiceData = {
    number: invoice.number,
    status: 'PAID',
    issuedAt: invoice.issuedAt.toISOString(),
    dueAt: null,
    issuer: {
      name: invoice.issuerName,
      address: invoice.issuerAddress,
      mf: invoice.issuerMF,
      rne: invoice.issuerRNE,
    },
    customer: {
      name: invoice.customerName,
      email: invoice.customerEmail,
    },
    items: invoice.items.map((item) => ({
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
    paymentMethod: 'BANK_TRANSFER',
  };

  const pdfBuffer = await renderInvoicePDF(pdfData);

  const invoicePdfPath = await storeInvoicePDF(invoice.number, pdfBuffer);
  const pdfUrl = getInvoiceUrl(invoice.id);

  const updatedEvents = JSON.parse(JSON.stringify(
    appendInvoiceEvent(
      invoice.events,
      createInvoiceEvent('PDF_RENDERED', validatorUserId, `PDF stocké: ${invoicePdfPath}`)
    )
  )) as Prisma.InputJsonValue;

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { pdfPath: invoicePdfPath, pdfUrl, events: updatedEvents },
  });

  await mkdir(DOCUMENTS_DIR, { recursive: true });
  const sanitizedNumber = invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  const uniqueFileName = `facture-${sanitizedNumber}-${invoice.id}.pdf`;
  const documentPath = path.join(DOCUMENTS_DIR, uniqueFileName);
  await writeFile(documentPath, pdfBuffer);

  const userDocument = await prisma.userDocument.create({
    data: {
      title: `Facture ${invoiceNumber}`,
      originalName: `facture-${invoiceNumber}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: pdfBuffer.length,
      localPath: documentPath,
      userId: payment.userId,
      uploadedById: validatorUserId,
    },
  });

  console.log(`[Regenerate] Facture ${invoiceNumber} régénérée → UserDocument ${userDocument.id} pour parent ${payment.userId}`);
  return { invoiceId: invoice.id, documentId: userDocument.id };
}

export async function POST(request: NextRequest) {
  try {
    let session: any = null;
    try {
      session = await auth();
    } catch {
      // auth() can throw UntrustedHost in standalone mode — treat as unauthenticated
    }

    if (!session?.user || !['ASSISTANTE', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { paymentId } = regenerateSchema.parse(body);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Paiement non trouvé' },
        { status: 404 }
      );
    }

    if (payment.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: `Le paiement doit être au statut COMPLETED (statut actuel: ${payment.status})` },
        { status: 400 }
      );
    }

    if (!payment.userId || !payment.user) {
      return NextResponse.json(
        { error: 'Paiement sans utilisateur associé' },
        { status: 400 }
      );
    }

    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        beneficiaryUserId: payment.userId,
        createdAt: {
          gte: new Date(payment.createdAt.getTime() - 60000),
          lte: new Date(payment.createdAt.getTime() + 3600000),
        },
      }
    });

    if (existingInvoice) {
      return NextResponse.json(
        { 
          error: 'Une facture existe déjà pour ce paiement',
          invoiceId: existingInvoice.id,
          invoiceNumber: existingInvoice.number,
        },
        { status: 409 }
      );
    }

    const result = await generateInvoiceForPayment(
      {
        id: payment.id,
        userId: payment.userId,
        amount: payment.amount,
        description: payment.description,
        method: payment.method,
        user: payment.user,
      },
      session.user.id,
    );

    return NextResponse.json({
      success: true,
      message: 'Facture régénérée avec succès',
      invoiceId: result.invoiceId,
      documentId: result.documentId,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Regenerate Invoice] Erreur:', error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
