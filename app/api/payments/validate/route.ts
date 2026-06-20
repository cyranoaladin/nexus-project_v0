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
import { activateEntitlements } from '@/lib/entitlement/engine';
import type { ProductCode } from '@/lib/entitlement/types';

type PaymentMetadata = {
  studentId: string;
  itemKey?: string;
  itemType?: string;
};

class AlreadyProcessedPaymentError extends Error {}

/**
 * Resolve a payment metadata itemKey to a canonical ProductCode.
 * This bridges the legacy subscription model to the entitlement registry.
 */
function resolveProductCode(itemKey?: string, itemType?: string): ProductCode | null {
  const key = itemKey?.toUpperCase();
  const type = itemType?.toUpperCase();

  // Subscription plans
  if (key === 'ESSENTIEL' || key === 'ACCES_PLATEFORME' || key === 'PLAN') {
    if (type === 'IMMERSION' || key?.includes('IMMERSION')) return 'ABONNEMENT_IMMERSION';
    if (type === 'HYBRIDE' || key?.includes('HYBRIDE')) return 'ABONNEMENT_HYBRIDE';
    return 'ABONNEMENT_ESSENTIEL';
  }
  if (key === 'HYBRIDE') return 'ABONNEMENT_HYBRIDE';
  if (key === 'IMMERSION') return 'ABONNEMENT_IMMERSION';
  if (key === 'ESSENTIEL') return 'ABONNEMENT_ESSENTIEL';

  // ARIA addons
  if (key?.startsWith('ARIA_') || type?.startsWith('ARIA_')) {
    if (key?.includes('MATHS') || type?.includes('MATHS')) return 'ARIA_ADDON_MATHS';
    if (key?.includes('NSI') || type?.includes('NSI')) return 'ARIA_ADDON_NSI';
  }

  // Stages (examples — extend as catalogue grows)
  if (key?.includes('STAGE_MATHS_P1')) return 'STAGE_MATHS_P1';
  if (key?.includes('STAGE_MATHS_P2')) return 'STAGE_MATHS_P2';
  if (key?.includes('STAGE_NSI_P1')) return 'STAGE_NSI_P1';
  if (key?.includes('STAGE_NSI_P2')) return 'STAGE_NSI_P2';

  // Credit packs
  if (key?.includes('CREDIT_PACK_5')) return 'CREDIT_PACK_5';
  if (key?.includes('CREDIT_PACK_10')) return 'CREDIT_PACK_10';
  if (key?.includes('CREDIT_PACK_20')) return 'CREDIT_PACK_20';

  return null;
}

function buildMinimalPdfBuffer(message: string): Buffer {
  const safe = message.replace(/[()\\]/g, '\\$&');
  const stream = `BT /F1 12 Tf 72 770 Td (${safe}) Tj ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

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
async function generateInvoicePDFAndDocument(
  invoiceId: string,
  paymentUserId: string,
  validatorUserId: string,
): Promise<{ invoiceId: string; documentId: string } | null> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
    if (!invoice) return null;

    // Build InvoiceData for PDF rendering
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

    // Render PDF (fallback to minimal PDF if PDFKit runtime assets are unavailable)
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderInvoicePDF(pdfData);
    } catch (pdfError) {
      console.error('[Validate] PDF render failed, using minimal fallback PDF:', pdfError);
      pdfBuffer = buildMinimalPdfBuffer(`Facture ${invoice.number}`);
    }

    // Store in invoice storage (data/invoices/)
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

    // Store in coffre-fort (storage/documents/) + create UserDocument
    await mkdir(DOCUMENTS_DIR, { recursive: true });
    const sanitizedNumber = invoice.number.replace(/[^a-zA-Z0-9-]/g, '_');
    const uniqueFileName = `facture-${sanitizedNumber}-${invoice.id}.pdf`;
    const documentPath = path.join(DOCUMENTS_DIR, uniqueFileName);
    await writeFile(documentPath, pdfBuffer);

    const userDocument = await prisma.userDocument.create({
      data: {
        title: `Facture ${invoice.number}`,
        originalName: `facture-${invoice.number}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: pdfBuffer.length,
        localPath: documentPath,
        userId: paymentUserId,
        uploadedById: validatorUserId,
      },
    });

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

    const metadata = parsePaymentMetadata(payment.metadata) as Partial<PaymentMetadata>;
    if (action === 'approve' && payment.type === 'SUBSCRIPTION') {
      const studentId = metadata.studentId;
      const parentChildren = payment.user?.parentProfile?.children ?? [];
      const isParentChild = !!studentId && parentChildren.some((child) => child.id === studentId);

      if (!isParentChild) {
        return NextResponse.json(
          { error: 'Paiement hors périmètre parent/élève' },
          { status: 404 }
        );
      }
    }

    if (action === 'approve') {
      // Resolve canonical product code before the transaction
      const productCode = resolveProductCode(metadata.itemKey, metadata.itemType);
      const beneficiaryUserId = metadata.studentId ?? payment.userId;

      // CRITICAL: Wrap payment validation in atomic transaction to ensure all-or-nothing behavior
      // Without this transaction, payment could be marked COMPLETED but credits never allocated
      // if crash occurs between operations (INV-PAY-2)
      let invoiceIdForEntitlements: string | null = null;
      await prisma.$transaction(async (tx) => {
        // Valider le paiement
        const merged = mergePaymentMetadata(payment.metadata, {
          validatedBy: session.user.id,
          validatedAt: new Date().toISOString(),
          validationNote: note,
          productCode: productCode ?? undefined,
          beneficiaryUserId: beneficiaryUserId ?? undefined,
        });
        const paymentUpdate = await tx.payment.updateMany({
          where: { id: paymentId, status: 'PENDING' },
          data: {
            status: 'COMPLETED',
            metadata: merged.value
          }
        });

        if (paymentUpdate.count !== 1) {
          throw new AlreadyProcessedPaymentError('Payment already processed');
        }

        // Create invoice WITHIN the transaction so activateEntitlements can run atomically
        const parentName = [payment.user?.firstName, payment.user?.lastName]
          .filter(Boolean).join(' ') || payment.user?.email || '';
        const amountMillimes = tndToMillimes(payment.amount);
        const invoiceNumber = await generateInvoiceNumber();

        const invoice = await tx.invoice.create({
          data: {
            number: invoiceNumber,
            status: 'PAID',
            issuedAt: new Date(),
            customerName: parentName,
            customerEmail: payment.user?.email || '',
            currency: 'TND',
            subtotal: amountMillimes,
            discountTotal: 0,
            taxTotal: 0,
            total: amountMillimes,
            taxRegime: 'TVA_NON_APPLICABLE',
            paymentMethod: payment.method === 'bank_transfer' ? 'BANK_TRANSFER' : 'CASH',
            paidAt: new Date(),
            paidAmount: amountMillimes,
            createdByUserId: session.user.id,
            beneficiaryUserId: beneficiaryUserId,
            events: JSON.parse(JSON.stringify([
              createInvoiceEvent('INVOICE_CREATED', session.user.id, `Facture auto-générée pour paiement ${payment.id}`),
              createInvoiceEvent('INVOICE_PAID', session.user.id, `Paiement validé — virement bancaire`),
            ])) as Prisma.InputJsonValue,
            items: {
              create: [{
                label: payment.description,
                productCode: productCode ?? undefined,
                qty: 1,
                unitPrice: amountMillimes,
                total: amountMillimes,
                sortOrder: 0,
              }],
            },
          },
          include: { items: true },
        });
        invoiceIdForEntitlements = invoice.id;

        // Activate entitlements atomically
        if (productCode && beneficiaryUserId) {
          const entitlementResult = await activateEntitlements(invoice.id, tx);
          if (entitlementResult.noBeneficiary || entitlementResult.skippedItems > 0) {
            // Do NOT throw here — the payment is valid, the invoice is created,
            // entitlements can be retried manually by staff if needed.
            // Log the failure for alerting.
          }
        }

        // Legacy subscription activation (kept as derived projection)
        if (payment.type === 'SUBSCRIPTION') {
          const subscriptionStudentId = metadata.studentId;
          if (!subscriptionStudentId) {
            throw new AlreadyProcessedPaymentError('Payment metadata missing studentId');
          }

          const student = await tx.student.findUnique({
            where: { id: subscriptionStudentId }
          });

          if (student) {
            // Désactiver l'ancien abonnement
            await tx.subscription.updateMany({
              where: {
                studentId: subscriptionStudentId,
                status: 'ACTIVE'
              },
              data: { status: 'CANCELLED' }
            });

            // Activer le nouvel abonnement
            await tx.subscription.updateMany({
              where: {
                studentId: subscriptionStudentId,
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
                studentId: subscriptionStudentId,
                status: 'ACTIVE'
              }
            });

            if (subscription && subscription.creditsPerMonth > 0) {
              const nextMonth = new Date();
              nextMonth.setMonth(nextMonth.getMonth() + 2);

              await tx.creditTransaction.create({
                data: {
                  studentId: subscriptionStudentId,
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
      const invoiceResult = invoiceIdForEntitlements
        ? await generateInvoicePDFAndDocument(
            invoiceIdForEntitlements,
            payment.userId ?? '',
            session.user.id,
          )
        : null;

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


      return NextResponse.json({
        success: true,
        message: 'Paiement rejeté avec succès'
      });
    }

  } catch (error) {
    if (error instanceof AlreadyProcessedPaymentError) {
      return NextResponse.json(
        { error: 'Paiement déjà traité' },
        { status: 409 }
      );
    }

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
