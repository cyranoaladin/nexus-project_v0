/**
 * E2E Test Script — Bank Transfer Payment Flow
 *
 * Validates the complete lifecycle:
 *   A. Find a Parent user
 *   B. Create a PENDING Payment (bank_transfer) + Notification for staff
 *   C. Find an Admin/Assistante and approve the payment
 *   D. Verify: Invoice created, PDF file exists in storage/documents/, UserDocument in DB
 *
 * Usage: npx tsx scripts/test-bank-transfer-flow.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { serializeError } from '@/lib/utils/serialize-error';

const prisma = new PrismaClient();
const DOCUMENTS_DIR = path.join(process.cwd(), 'storage', 'documents');

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

async function run() {
  log('🚀', 'Démarrage du test E2E — Flux Virement Bancaire');
  log('─', '─'.repeat(60));

  let paymentId: string | null = null;

  try {
    // ─── ÉTAPE A : Trouver un Parent ──────────────────────────────────
    log('📋', 'ÉTAPE A : Recherche d\'un utilisateur PARENT...');
    const parent = await prisma.user.findFirst({
      where: { role: 'PARENT' },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!parent) {
      throw new Error('Aucun utilisateur PARENT trouvé en base. Lancez le seed d\'abord.');
    }
    log('✅', `Parent trouvé : ${parent.firstName} ${parent.lastName} (${parent.email})`);

    // ─── ÉTAPE B : Créer un Payment PENDING + Notification ────────────
    log('📋', 'ÉTAPE B : Création du Payment PENDING (bank_transfer) + Notifications...');

    const payment = await prisma.payment.create({
      data: {
        userId: parent.id,
        type: 'SUBSCRIPTION',
        amount: 450,
        currency: 'TND',
        description: 'Abonnement HYBRIDE — Test E2E Virement',
        status: 'PENDING',
        method: 'bank_transfer',
        metadata: {
          itemKey: 'hybride',
          itemType: 'subscription',
          studentId: null,
          declaredAt: new Date().toISOString(),
          declaredBy: parent.id,
        },
      },
    });
    paymentId = payment.id;
    log('✅', `Payment créé : ${payment.id} (${payment.amount} TND, status: ${payment.status})`);

    // Create notifications for staff
    const staffUsers = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'ASSISTANTE'] } },
      select: { id: true, role: true },
    });

    if (staffUsers.length > 0) {
      const parentName = [parent.firstName, parent.lastName].filter(Boolean).join(' ') || parent.email;
      await prisma.notification.createMany({
        data: staffUsers.map((staff) => ({
          userId: staff.id,
          userRole: staff.role,
          type: 'BANK_TRANSFER_DECLARED',
          title: 'Nouveau virement déclaré (TEST E2E)',
          message: `${parentName} a déclaré un virement de 450 TND. En attente de validation.`,
          data: { paymentId: payment.id, parentId: parent.id, amount: 450 },
        })),
      });
      log('✅', `${staffUsers.length} notification(s) créée(s) pour ADMIN/ASSISTANTE`);
    } else {
      log('⚠️', 'Aucun ADMIN/ASSISTANTE trouvé — notifications ignorées');
    }

    // ─── ÉTAPE C : Trouver un Admin et valider le paiement ────────────
    log('📋', 'ÉTAPE C : Validation du paiement par un ADMIN...');

    const admin = await prisma.user.findFirst({
      where: { role: { in: ['ADMIN', 'ASSISTANTE'] } },
      select: { id: true, firstName: true, lastName: true, role: true },
    });

    if (!admin) {
      throw new Error('Aucun ADMIN/ASSISTANTE trouvé en base.');
    }
    log('✅', `Validateur : ${admin.firstName} ${admin.lastName} (${admin.role})`);

    // C.1 — Mark payment as COMPLETED (simulates the transaction in validate/route.ts)
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        metadata: {
          ...(payment.metadata as Record<string, unknown>),
          validatedBy: admin.id,
          validatedAt: new Date().toISOString(),
          validationNote: 'Test E2E — validation automatique',
        },
      },
    });
    log('✅', 'Payment mis à jour → COMPLETED');

    // C.2 — Generate Invoice
    const { generateInvoiceNumber } = await import('../lib/invoice/sequence');
    const { renderInvoicePDF } = await import('../lib/invoice/pdf');
    const { storeInvoicePDF, getInvoiceUrl } = await import('../lib/invoice/storage');
    const { tndToMillimes } = await import('../lib/invoice/types');
    const { createInvoiceEvent, appendInvoiceEvent } = await import('../lib/invoice/types');

    const invoiceNumber = await generateInvoiceNumber();
    const amountMillimes = tndToMillimes(payment.amount);
    const parentName = [parent.firstName, parent.lastName].filter(Boolean).join(' ') || parent.email;

    const invoice = await prisma.invoice.create({
      data: {
        number: invoiceNumber,
        status: 'PAID',
        issuedAt: new Date(),
        customerName: parentName,
        customerEmail: parent.email,
        currency: 'TND',
        subtotal: amountMillimes,
        discountTotal: 0,
        taxTotal: 0,
        total: amountMillimes,
        taxRegime: 'TVA_NON_APPLICABLE',
        paymentMethod: 'BANK_TRANSFER',
        paidAt: new Date(),
        paidAmount: amountMillimes,
        createdByUserId: admin.id,
        beneficiaryUserId: parent.id,
        events: JSON.parse(JSON.stringify([
          createInvoiceEvent('INVOICE_CREATED', admin.id, `Facture auto-générée (test E2E)`),
          createInvoiceEvent('INVOICE_PAID', admin.id, `Paiement validé — virement bancaire`),
        ])),
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
    log('✅', `Invoice créée : ${invoice.number} (${invoice.id})`);

    // C.3 — Render PDF
    const pdfData = {
      number: invoice.number,
      status: 'PAID' as const,
      issuedAt: invoice.issuedAt.toISOString(),
      dueAt: null,
      issuer: {
        name: invoice.issuerName,
        address: invoice.issuerAddress,
        mf: invoice.issuerMF,
        rne: invoice.issuerRNE,
      },
      customer: { name: invoice.customerName, email: invoice.customerEmail },
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
      taxRegime: invoice.taxRegime as 'TVA_NON_APPLICABLE',
      paymentMethod: 'BANK_TRANSFER' as const,
    };

    const pdfBuffer = await renderInvoicePDF(pdfData);
    log('✅', `PDF rendu : ${pdfBuffer.length} octets`);

    // C.4 — Store in invoice storage
    const invoicePdfPath = await storeInvoicePDF(invoice.number, pdfBuffer);
    const pdfUrl = getInvoiceUrl(invoice.id);

    const updatedEvents = JSON.parse(JSON.stringify(
      appendInvoiceEvent(
        invoice.events,
        createInvoiceEvent('PDF_RENDERED', admin.id, `PDF stocké: ${invoicePdfPath}`)
      )
    ));
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfPath: invoicePdfPath, pdfUrl, events: updatedEvents },
    });
    log('✅', `PDF stocké dans data/invoices/ : ${invoicePdfPath}`);

    // C.5 — Store in coffre-fort + create UserDocument
    if (!fs.existsSync(DOCUMENTS_DIR)) {
      fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
    }
    const sanitizedNumber = invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_');
    const uniqueFileName = `facture-${sanitizedNumber}-${invoice.id}.pdf`;
    const documentPath = path.join(DOCUMENTS_DIR, uniqueFileName);
    fs.writeFileSync(documentPath, pdfBuffer);

    const userDocument = await prisma.userDocument.create({
      data: {
        title: `Facture ${invoiceNumber}`,
        originalName: `facture-${invoiceNumber}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: pdfBuffer.length,
        localPath: documentPath,
        userId: parent.id,
        uploadedById: admin.id,
      },
    });
    log('✅', `UserDocument créé : ${userDocument.id} (${userDocument.title})`);

    // ─── ÉTAPE D : Vérifications finales ──────────────────────────────
    log('📋', 'ÉTAPE D : Vérifications finales...');

    // D.1 — Vérifier le fichier PDF dans storage/documents/
    if (fs.existsSync(documentPath)) {
      const stats = fs.statSync(documentPath);
      log('✅', `Fichier PDF confirmé sur disque : ${documentPath} (${stats.size} octets)`);
    } else {
      throw new Error(`ÉCHEC : Fichier PDF introuvable à ${documentPath}`);
    }

    // D.2 — Vérifier le UserDocument en base
    const docInDb = await prisma.userDocument.findUnique({
      where: { id: userDocument.id },
      include: { user: { select: { email: true } }, uploadedBy: { select: { email: true } } },
    });
    if (docInDb) {
      log('✅', `UserDocument en DB : title="${docInDb.title}", user=${docInDb.user.email}, uploadedBy=${docInDb.uploadedBy?.email}`);
    } else {
      throw new Error('ÉCHEC : UserDocument introuvable en base');
    }

    // D.3 — Vérifier le Payment COMPLETED
    const finalPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
    if (finalPayment?.status === 'COMPLETED') {
      log('✅', `Payment final : status=${finalPayment.status}`);
    } else {
      throw new Error(`ÉCHEC : Payment status inattendu : ${finalPayment?.status}`);
    }

    // D.4 — Vérifier l'Invoice PAID
    const finalInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    if (finalInvoice?.status === 'PAID' && finalInvoice.pdfPath) {
      log('✅', `Invoice finale : status=${finalInvoice.status}, pdfPath=${finalInvoice.pdfPath}`);
    } else {
      throw new Error(`ÉCHEC : Invoice status inattendu : ${finalInvoice?.status}`);
    }

    // D.5 — Vérifier les notifications
    const notifCount = await prisma.notification.count({
      where: { type: 'BANK_TRANSFER_DECLARED', data: { path: ['paymentId'], equals: payment.id } },
    });
    log('✅', `${notifCount} notification(s) BANK_TRANSFER_DECLARED en base`);

    // ─── RÉSULTAT ─────────────────────────────────────────────────────
    log('─', '─'.repeat(60));
    log('🏆', 'TEST E2E RÉUSSI — Flux Virement Bancaire complet :');
    log('  ', `  Payment ${payment.id} → COMPLETED`);
    log('  ', `  Invoice ${invoice.number} → PAID + PDF`);
    log('  ', `  UserDocument ${userDocument.id} → Coffre-fort`);
    log('  ', `  ${notifCount} notification(s) staff`);
    log('─', '─'.repeat(60));

  } catch (error) {
    log('❌', `TEST ÉCHOUÉ : ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error) {
      console.error(serializeError(error));
    }
    process.exit(1);
  } finally {
    // Cleanup: remove test data
    if (paymentId) {
      try {
        // Delete notifications created by this test
        await prisma.notification.deleteMany({
          where: { type: 'BANK_TRANSFER_DECLARED', data: { path: ['paymentId'], equals: paymentId } },
        });
        // Delete UserDocuments linked to this payment's invoice
        // Delete invoice items, invoice, and payment
        const testInvoices = await prisma.invoice.findMany({
          where: { events: { path: ['0', 'details'], string_contains: 'test E2E' } },
          select: { id: true },
        });
        for (const inv of testInvoices) {
          await prisma.invoiceItem.deleteMany({ where: { invoiceId: inv.id } });
        }
        if (testInvoices.length > 0) {
          await prisma.invoice.deleteMany({
            where: { id: { in: testInvoices.map((i) => i.id) } },
          });
        }
        await prisma.payment.delete({ where: { id: paymentId } }).catch(() => {});
        log('🧹', 'Données de test nettoyées');
      } catch {
        log('⚠️', 'Nettoyage partiel — certaines données de test peuvent rester');
      }
    }
    await prisma.$disconnect();
  }
}

run();
