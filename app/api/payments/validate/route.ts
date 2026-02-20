export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { mergePaymentMetadata, parsePaymentMetadata } from '@/lib/utils';
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

type PaymentMetadata = {
  studentId: string;
  itemKey?: string;
  itemType?: string;
};

/** Base directory for secure document storage (coffre-fort) */
const DOCUMENTS_DIR = path.join(process.cwd(), 'storage', 'documents');

const validatePaymentSchema = z.object({
  paymentId: z.string(),
  action: z.enum(['approve', 'reject']),
  note: z.string().optional()
});

/**
 * Generate an Invoice, render the PDF, store it in the coffre-fort,
 * and create a UserDocument entry so the parent sees it in "Mes Ressources".
 *
 * Runs OUTSIDE the serializable transaction (PDF I/O is slow and non-transactional).
 * If this fails, the payment is still COMPLETED — the invoice can be regenerated.
 */
async function generateInvoiceAndDocument(
  payment: {
    id: string;
    userId: string | null;
    amount: number;
    description: string;
    method: string | null;
    user: { firstName: string | null; lastName: string | null; email: string } | null;
  },
  validatorUserId: string,
): Promise<{ invoiceId: string; documentId: string } | null> {
  try {
    if (!payment.userId || !payment.user) return null;

    const parentName = [payment.user.firstName, payment.user.lastName]
      .filter(Boolean).join(' ') || payment.user.email;

    // 1. Generate atomic invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // 2. Create Invoice in DB
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
          createInvoiceEvent('INVOICE_CREATED', validatorUserId, `Facture auto-générée pour paiement ${payment.id}`),
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

    // 3. Build InvoiceData for PDF rendering
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

    // 4. Render PDF
    const pdfBuffer = await renderInvoicePDF(pdfData);

    // 5. Store in invoice storage (data/invoices/)
    const invoicePdfPath = await storeInvoicePDF(invoice.number, pdfBuffer);
    const pdfUrl = getInvoiceUrl(invoice.id);

    // Update invoice with PDF path + audit
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

    // 6. Store in coffre-fort (storage/documents/) + create UserDocument
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

    console.log(`[Validate] Facture ${invoiceNumber} générée → UserDocument ${userDocument.id} pour parent ${payment.userId}`);
    return { invoiceId: invoice.id, documentId: userDocument.id };
  } catch (err) {
    // Non-blocking: log error but don't fail the payment validation
    console.error('[Validate] Erreur génération facture/document:', err);
    return null;
  }
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
    const { paymentId, action, note } = validatePaymentSchema.parse(body);

    // Récupérer le paiement
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: {
          include: {
            parentProfile: {
              include: {
                children: true
              }
            }
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

    if (payment.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Ce paiement est déjà traité (statut: ${payment.status})` },
        { status: 409 }
      );
    }

    if (action === 'approve') {
      // CRITICAL: Wrap payment validation in atomic transaction to ensure all-or-nothing behavior
      // Without this transaction, payment could be marked COMPLETED but credits never allocated
      // if crash occurs between operations (INV-PAY-2)
      await prisma.$transaction(async (tx) => {
        // Valider le paiement
        const merged = mergePaymentMetadata(payment.metadata, {
          validatedBy: session.user.id,
          validatedAt: new Date().toISOString(),
          validationNote: note
        });
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: 'COMPLETED',
            metadata: merged.value
          }
        });

        // Activer le service selon le type
        const metadata = parsePaymentMetadata(payment.metadata) as PaymentMetadata;

        if (payment.type === 'SUBSCRIPTION') {
          // Activer l'abonnement
          const student = await tx.student.findUnique({
            where: { id: metadata.studentId }
          });

          if (student) {
            // Désactiver l'ancien abonnement
            await tx.subscription.updateMany({
              where: {
                studentId: metadata.studentId,
                status: 'ACTIVE'
              },
              data: { status: 'CANCELLED' }
            });

            // Activer le nouvel abonnement
            await tx.subscription.updateMany({
              where: {
                studentId: metadata.studentId,
                planName: metadata.itemKey,
                status: 'INACTIVE'
              },
              data: {
                status: 'ACTIVE',
                startDate: new Date()
              }
            });

            // Allouer les crédits mensuels
            const subscription = await tx.subscription.findFirst({
              where: {
                studentId: metadata.studentId,
                status: 'ACTIVE'
              }
            });

            if (subscription && subscription.creditsPerMonth > 0) {
              const nextMonth = new Date();
              nextMonth.setMonth(nextMonth.getMonth() + 2);

              await tx.creditTransaction.create({
                data: {
                  studentId: metadata.studentId,
                  type: 'MONTHLY_ALLOCATION',
                  amount: subscription.creditsPerMonth,
                  description: `Allocation mensuelle de ${subscription.creditsPerMonth} crédits`,
                  expiresAt: nextMonth
                }
              });
            }
          }
        }
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000  // 10 seconds timeout
      });

      // Post-transaction: Generate Invoice PDF + store in coffre-fort (non-blocking)
      const invoiceResult = await generateInvoiceAndDocument(
        {
          id: payment.id,
          userId: payment.userId,
          amount: payment.amount,
          description: payment.description,
          method: payment.method,
          user: payment.user ? {
            firstName: payment.user.firstName,
            lastName: payment.user.lastName,
            email: payment.user.email,
          } : null,
        },
        session.user.id,
      );

      return NextResponse.json({
        success: true,
        message: 'Paiement validé avec succès',
        invoiceId: invoiceResult?.invoiceId ?? null,
        documentId: invoiceResult?.documentId ?? null,
      });

    } else {
      // Rejeter le paiement
      const mergedReject = mergePaymentMetadata(payment.metadata, {
        rejectedBy: session.user.id,
        rejectedAt: new Date().toISOString(),
        rejectionReason: note
      });
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          metadata: mergedReject.value
        }
      });

      // TODO: Envoyer email d'information au client

      return NextResponse.json({
        success: true,
        message: 'Paiement rejeté avec succès'
      });
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }

    // Handle Prisma transaction errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: Record<string, unknown> };

      // P2034: Transaction failed due to serialization conflict
      if (prismaError.code === 'P2034') {
        return NextResponse.json(
          { error: 'Conflit de validation concurrent détecté. Veuillez réessayer.' },
          { status: 409 }
        );
      }

      // P2025: Record not found
      if (prismaError.code === 'P2025') {
        return NextResponse.json(
          { error: 'Ressource non trouvée lors de la validation' },
          { status: 404 }
        );
      }
    }

    console.error('Erreur validation paiement:', error);

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
