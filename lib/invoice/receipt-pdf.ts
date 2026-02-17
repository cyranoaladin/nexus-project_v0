/**
 * Receipt PDF Generator — Server-side PDF rendering with PDFKit.
 *
 * Produces a single-page A4 payment receipt from invoice + payment data.
 * Same design tokens and branding as the invoice PDF.
 *
 * Precondition: invoice.status === 'PAID' with paidAt + paidAmount present.
 */

import PDFDocument from 'pdfkit';
import { existsSync } from 'fs';
import { millimesToDisplay } from './types';
import { PAYMENT_METHOD_LABELS } from './types';
import type { InvoicePaymentMethodType } from './types';

// ─── Design Tokens (shared with invoice PDF) ────────────────────────────────

const COLORS = {
  brand: '#6366F1',
  brandLight: '#818CF8',
  dark: '#1A1A2E',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  white: '#FFFFFF',
  success: '#10B981',
} as const;

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  oblique: 'Helvetica-Oblique',
} as const;

const PAGE = {
  width: 595.28,
  height: 841.89,
  marginTop: 40,
  marginBottom: 40,
  marginLeft: 50,
  marginRight: 50,
} as const;

const CONTENT_WIDTH = PAGE.width - PAGE.marginLeft - PAGE.marginRight;

// ─── Receipt Data ────────────────────────────────────────────────────────────

export interface ReceiptData {
  /** Invoice number */
  invoiceNumber: string;
  /** Invoice issue date (ISO) */
  invoiceIssuedAt: string;
  /** Payment date (ISO) */
  paidAt: string;
  /** Amount paid in millimes */
  paidAmount: number;
  /** Currency code */
  currency: string;
  /** Payment method */
  paymentMethod: string | null;
  /** Payment reference (bank ref, cheque number) */
  paymentReference: string | null;
  /** Customer info */
  customerName: string;
  customerEmail: string | null;
  customerAddress: string | null;
  /** Issuer info */
  issuerName: string;
  issuerAddress: string;
  issuerMF: string;
  /** Optional logo path or URL */
  logoPath?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function getPaymentMethodLabel(method: string | null): string {
  if (!method) return 'Non spécifié';
  return PAYMENT_METHOD_LABELS[method as InvoicePaymentMethodType] ?? method;
}

function isUrl(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://');
}

// ─── Renderer ────────────────────────────────────────────────────────────────

/**
 * Render a payment receipt PDF. Returns a Buffer.
 */
export async function renderReceiptPDF(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];

    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: PAGE.marginTop,
        bottom: PAGE.marginBottom,
        left: PAGE.marginLeft,
        right: PAGE.marginRight,
      },
      info: {
        Title: `Reçu de paiement — ${data.invoiceNumber}`,
        Author: data.issuerName,
        Subject: 'Reçu de paiement',
      },
    });

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let y: number = PAGE.marginTop;

    // ─── Header band ──────────────────────────────────────────────────
    doc
      .rect(0, 0, PAGE.width, 80)
      .fill(COLORS.dark);

    // Logo or issuer name
    let logoRendered = false;
    if (data.logoPath) {
      const canRender = isUrl(data.logoPath) || existsSync(data.logoPath);
      if (canRender) {
        try {
          doc.image(data.logoPath, PAGE.marginLeft, 20, { height: 40 });
          logoRendered = true;
        } catch {
          // fallback to text
        }
      }
    }
    if (!logoRendered) {
      doc
        .font(FONTS.bold)
        .fontSize(18)
        .fillColor(COLORS.white)
        .text(data.issuerName, PAGE.marginLeft, 28, { width: 200 });
    }

    // "REÇU DE PAIEMENT" title
    doc
      .font(FONTS.bold)
      .fontSize(14)
      .fillColor(COLORS.white)
      .text('REÇU DE PAIEMENT', PAGE.width - PAGE.marginRight - 200, 30, {
        width: 200,
        align: 'right',
      });

    y = 100;

    // ─── Receipt metadata ─────────────────────────────────────────────
    doc
      .font(FONTS.bold)
      .fontSize(10)
      .fillColor(COLORS.text)
      .text('Référence facture :', PAGE.marginLeft, y);
    doc
      .font(FONTS.regular)
      .text(data.invoiceNumber, PAGE.marginLeft + 130, y);

    y += 18;
    doc
      .font(FONTS.bold)
      .text('Date de la facture :', PAGE.marginLeft, y);
    doc
      .font(FONTS.regular)
      .text(formatDate(data.invoiceIssuedAt), PAGE.marginLeft + 130, y);

    y += 18;
    doc
      .font(FONTS.bold)
      .text('Date de paiement :', PAGE.marginLeft, y);
    doc
      .font(FONTS.regular)
      .text(formatDate(data.paidAt), PAGE.marginLeft + 130, y);

    y += 18;
    doc
      .font(FONTS.bold)
      .text('Mode de paiement :', PAGE.marginLeft, y);
    doc
      .font(FONTS.regular)
      .text(getPaymentMethodLabel(data.paymentMethod), PAGE.marginLeft + 130, y);

    if (data.paymentReference) {
      y += 18;
      doc
        .font(FONTS.bold)
        .text('Référence :', PAGE.marginLeft, y);
      doc
        .font(FONTS.regular)
        .text(data.paymentReference, PAGE.marginLeft + 130, y);
    }

    y += 35;

    // ─── Separator ────────────────────────────────────────────────────
    doc
      .moveTo(PAGE.marginLeft, y)
      .lineTo(PAGE.width - PAGE.marginRight, y)
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .stroke();

    y += 20;

    // ─── Customer info ────────────────────────────────────────────────
    doc
      .font(FONTS.bold)
      .fontSize(10)
      .fillColor(COLORS.textSecondary)
      .text('PAYÉ PAR', PAGE.marginLeft, y);

    y += 16;
    doc
      .font(FONTS.bold)
      .fontSize(11)
      .fillColor(COLORS.text)
      .text(data.customerName, PAGE.marginLeft, y);

    if (data.customerEmail) {
      y += 16;
      doc
        .font(FONTS.regular)
        .fontSize(9)
        .fillColor(COLORS.textSecondary)
        .text(data.customerEmail, PAGE.marginLeft, y);
    }

    if (data.customerAddress) {
      y += 14;
      doc
        .font(FONTS.regular)
        .fontSize(9)
        .fillColor(COLORS.textSecondary)
        .text(data.customerAddress, PAGE.marginLeft, y, { width: CONTENT_WIDTH });
    }

    y += 35;

    // ─── Amount box ───────────────────────────────────────────────────
    const boxHeight = 70;
    doc
      .roundedRect(PAGE.marginLeft, y, CONTENT_WIDTH, boxHeight, 8)
      .fill('#F0FDF4'); // emerald-50

    doc
      .font(FONTS.bold)
      .fontSize(10)
      .fillColor(COLORS.success)
      .text('MONTANT PAYÉ', PAGE.marginLeft, y + 15, {
        width: CONTENT_WIDTH,
        align: 'center',
      });

    doc
      .font(FONTS.bold)
      .fontSize(24)
      .fillColor(COLORS.text)
      .text(
        millimesToDisplay(data.paidAmount, data.currency),
        PAGE.marginLeft,
        y + 32,
        { width: CONTENT_WIDTH, align: 'center' }
      );

    y += boxHeight + 30;

    // ─── Legal mention ────────────────────────────────────────────────
    doc
      .font(FONTS.oblique)
      .fontSize(8)
      .fillColor(COLORS.textMuted)
      .text(
        'Ce reçu atteste du paiement intégral de la facture référencée ci-dessus.',
        PAGE.marginLeft,
        y,
        { width: CONTENT_WIDTH, align: 'center' }
      );

    y += 30;

    // ─── Issuer footer ────────────────────────────────────────────────
    doc
      .moveTo(PAGE.marginLeft, y)
      .lineTo(PAGE.width - PAGE.marginRight, y)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    y += 12;
    doc
      .font(FONTS.regular)
      .fontSize(8)
      .fillColor(COLORS.textMuted)
      .text(data.issuerName, PAGE.marginLeft, y, { width: CONTENT_WIDTH, align: 'center' });

    y += 12;
    doc.text(data.issuerAddress, PAGE.marginLeft, y, { width: CONTENT_WIDTH, align: 'center' });

    y += 12;
    doc.text(`MF : ${data.issuerMF}`, PAGE.marginLeft, y, { width: CONTENT_WIDTH, align: 'center' });

    // ─── Finalize ─────────────────────────────────────────────────────
    doc.end();
  });
}
