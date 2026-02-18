/**
 * Invoice PDF Generator — Server-side PDF rendering with PDFKit.
 *
 * Produces a single-page A4 invoice PDF from an InvoiceData object.
 * No hardcoded business data — everything comes from the data parameter.
 *
 * Design principles:
 * - Always 1 page (overflow → controlled error)
 * - No emoji (text-only labels)
 * - Clamped fields (address 2 lines, description 3 lines)
 * - Premium branding: clean, structured, professional
 */

import PDFDocument from 'pdfkit';
import { existsSync } from 'fs';
import type {
  InvoiceData,
  TaxRegime,
} from './types';
import {
  CLAMP_ADDRESS_LINES,
  CLAMP_DESCRIPTION_LINES,
  CLAMP_CHARS_PER_LINE,
  MAX_INVOICE_ITEMS,
  millimesToDisplay,
} from './types';

// ─── Design Tokens ──────────────────────────────────────────────────────────

const COLORS = {
  brand: '#6366F1',       // Indigo-500 (brand-primary)
  brandLight: '#818CF8',  // Indigo-400
  dark: '#1A1A2E',        // Surface dark
  text: '#111827',         // Near black
  textSecondary: '#6B7280', // Gray-500
  textMuted: '#9CA3AF',    // Gray-400
  border: '#E5E7EB',       // Gray-200
  borderLight: '#F3F4F6',  // Gray-100
  white: '#FFFFFF',
  success: '#10B981',      // Emerald-500
} as const;

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  oblique: 'Helvetica-Oblique',
} as const;

const PAGE = {
  width: 595.28,   // A4
  height: 841.89,  // A4
  marginTop: 40,
  marginBottom: 40,
  marginLeft: 50,
  marginRight: 50,
} as const;

const CONTENT_WIDTH = PAGE.width - PAGE.marginLeft - PAGE.marginRight;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Clamp text to a maximum number of lines.
 * Truncates with "…" if exceeded.
 */
function clampText(text: string | null | undefined, maxLines: number, charsPerLine: number = CLAMP_CHARS_PER_LINE): string {
  if (!text) return '';
  const maxChars = maxLines * charsPerLine;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1).trimEnd() + '…';
}

/**
 * Format a millimes amount as TND currency for PDF display.
 * All amounts in InvoiceData are in millimes (int). Conversion to TND
 * happens here at the rendering boundary — never in business logic.
 */
function formatCurrency(millimes: number, currency: string = 'TND'): string {
  return millimesToDisplay(millimes, currency);
}

/**
 * Format an ISO date string to French locale.
 */
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

/**
 * Get the tax regime label for display.
 */
function getTaxRegimeLabel(regime: TaxRegime): string {
  switch (regime) {
    case 'TVA_INCLUSE':
      return 'TVA incluse';
    case 'TVA_NON_APPLICABLE':
      return 'TVA non applicable (art. 293 B du CGI)';
    case 'EXONERATION':
      return 'Exonération de TVA';
    default:
      return '';
  }
}

/**
 * Get the payment method label for display.
 */
function getPaymentMethodLabel(method: string | null | undefined): string {
  if (!method) return 'Non spécifié';
  const labels: Record<string, string> = {
    CASH: 'Espèces',
    BANK_TRANSFER: 'Virement bancaire',
    KONNECT: 'Konnect',
    WISE: 'Wise',
    CHECK: 'Chèque',
    OTHER: 'Autre',
  };
  return labels[method] ?? method;
}

// ─── Overflow Guard ─────────────────────────────────────────────────────────

export class InvoiceOverflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceOverflowError';
  }
}

/**
 * Pre-validate that the invoice data will fit on 1 page.
 * Throws InvoiceOverflowError if it won't.
 */
function validateFitsOnePage(data: InvoiceData): void {
  if (data.items.length > MAX_INVOICE_ITEMS) {
    throw new InvoiceOverflowError(
      `Invoice has ${data.items.length} items (max ${MAX_INVOICE_ITEMS}). ` +
      `Reduce items or split into multiple invoices.`
    );
  }

  // Estimate total height needed
  const headerHeight = 120;
  const customerBlockHeight = 80;
  const tableHeaderHeight = 30;
  const itemRowHeight = data.items.reduce((acc, item) => {
    const descLines = item.description ? Math.min(
      Math.ceil(item.description.length / CLAMP_CHARS_PER_LINE),
      CLAMP_DESCRIPTION_LINES
    ) : 0;
    return acc + 20 + (descLines * 10);
  }, 0);
  const totalsHeight = 100;
  const paymentHeight = 60;
  const footerHeight = 80;

  const totalEstimate = headerHeight + customerBlockHeight + tableHeaderHeight +
    itemRowHeight + totalsHeight + paymentHeight + footerHeight +
    PAGE.marginTop + PAGE.marginBottom;

  if (totalEstimate > PAGE.height) {
    throw new InvoiceOverflowError(
      `Invoice content estimated at ${Math.round(totalEstimate)}pt exceeds A4 height (${PAGE.height}pt). ` +
      `Reduce item descriptions or number of items.`
    );
  }
}

// ─── PDF Renderer ───────────────────────────────────────────────────────────

/**
 * Render an invoice PDF from structured data.
 *
 * @param data - Complete invoice data (no hardcoded values)
 * @returns Buffer containing the PDF
 * @throws InvoiceOverflowError if content won't fit on 1 page
 */
export async function renderInvoicePDF(data: InvoiceData): Promise<Buffer> {
  // Pre-validate
  validateFitsOnePage(data);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: PAGE.marginTop,
          bottom: PAGE.marginBottom,
          left: PAGE.marginLeft,
          right: PAGE.marginRight,
        },
        info: {
          Title: `Facture ${data.number}`,
          Author: data.issuer.name,
          Subject: `Facture ${data.number} — ${data.customer.name}`,
          Creator: 'Nexus Réussite — Moteur Facturation',
        },
        autoFirstPage: true,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let y: number = PAGE.marginTop;

      // ─── Header: Brand bar + Issuer ─────────────────────────────────
      // Brand accent bar
      doc.rect(0, 0, PAGE.width, 6).fill(COLORS.brand);

      // Logo (optional — supports local path OR URL, safe fallback to text)
      y = 25;
      const logoSrc = data.issuer.logoPath;
      const isUrl = logoSrc && (logoSrc.startsWith('http://') || logoSrc.startsWith('https://'));
      const logoAvailable = logoSrc && (isUrl || existsSync(logoSrc));
      if (logoAvailable) {
        try {
          doc.image(logoSrc!, PAGE.marginLeft, y - 5, { height: 36 });
          y += 38;
        } catch {
          // Logo render failed (bad file, network error, etc.) — fallback to text
          doc.font(FONTS.bold).fontSize(16).fillColor(COLORS.brand)
            .text(data.issuer.name, PAGE.marginLeft, y);
          y += 22;
        }
      } else {
        // Text fallback (default)
        doc.font(FONTS.bold).fontSize(16).fillColor(COLORS.brand)
          .text(data.issuer.name, PAGE.marginLeft, y);
        y += 22;
      }

      // Issuer details
      doc.font(FONTS.regular).fontSize(8).fillColor(COLORS.textSecondary)
        .text(data.issuer.address, PAGE.marginLeft, y);
      y += 12;
      doc.text(`MF : ${data.issuer.mf}`, PAGE.marginLeft, y);
      if (data.issuer.rne) {
        y += 10;
        doc.text(`RNE : ${data.issuer.rne}`, PAGE.marginLeft, y);
      }

      // Invoice title + number (right-aligned)
      doc.font(FONTS.bold).fontSize(22).fillColor(COLORS.text)
        .text('FACTURE', PAGE.width - PAGE.marginRight - 200, 25, { width: 200, align: 'right' });
      doc.font(FONTS.regular).fontSize(10).fillColor(COLORS.textSecondary)
        .text(`N° ${data.number}`, PAGE.width - PAGE.marginRight - 200, 52, { width: 200, align: 'right' });

      // Dates
      doc.font(FONTS.regular).fontSize(8).fillColor(COLORS.textSecondary)
        .text(`Date : ${formatDate(data.issuedAt)}`, PAGE.width - PAGE.marginRight - 200, 68, { width: 200, align: 'right' });
      if (data.dueAt) {
        doc.text(`Échéance : ${formatDate(data.dueAt)}`, PAGE.width - PAGE.marginRight - 200, 80, { width: 200, align: 'right' });
      }

      // Separator
      y = 100;
      doc.moveTo(PAGE.marginLeft, y).lineTo(PAGE.width - PAGE.marginRight, y)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();

      // ─── Customer Block ─────────────────────────────────────────────
      y = 115;
      doc.font(FONTS.regular).fontSize(7).fillColor(COLORS.textMuted)
        .text('FACTURER À', PAGE.width - PAGE.marginRight - 220, y);
      y += 14;

      // Customer box
      const custBoxX = PAGE.width - PAGE.marginRight - 220;
      const custBoxW = 220;
      doc.roundedRect(custBoxX, y, custBoxW, 55, 4)
        .fillColor(COLORS.borderLight).fill();

      doc.font(FONTS.bold).fontSize(10).fillColor(COLORS.text)
        .text(data.customer.name, custBoxX + 10, y + 8, { width: custBoxW - 20 });

      let custY = y + 22;
      if (data.customer.email) {
        doc.font(FONTS.regular).fontSize(8).fillColor(COLORS.textSecondary)
          .text(data.customer.email, custBoxX + 10, custY, { width: custBoxW - 20 });
        custY += 11;
      }
      if (data.customer.address) {
        const clampedAddr = clampText(data.customer.address, CLAMP_ADDRESS_LINES);
        doc.font(FONTS.regular).fontSize(8).fillColor(COLORS.textSecondary)
          .text(clampedAddr, custBoxX + 10, custY, { width: custBoxW - 20 });
      }
      if (data.customer.customerId) {
        doc.font(FONTS.regular).fontSize(7).fillColor(COLORS.textMuted)
          .text(`ID : ${data.customer.customerId}`, custBoxX + 10, y + 44, { width: custBoxW - 20 });
      }

      // ─── Items Table ────────────────────────────────────────────────
      y = 190;

      // Table header
      const colX = {
        label: PAGE.marginLeft,
        qty: PAGE.marginLeft + CONTENT_WIDTH * 0.55,
        unit: PAGE.marginLeft + CONTENT_WIDTH * 0.68,
        total: PAGE.marginLeft + CONTENT_WIDTH * 0.85,
      };

      doc.rect(PAGE.marginLeft, y, CONTENT_WIDTH, 22)
        .fillColor(COLORS.brand).fill();

      doc.font(FONTS.bold).fontSize(8).fillColor(COLORS.white);
      doc.text('DÉSIGNATION', colX.label + 8, y + 7);
      doc.text('QTÉ', colX.qty, y + 7, { width: 40, align: 'center' });
      doc.text('P.U.', colX.unit, y + 7, { width: 50, align: 'right' });
      doc.text('TOTAL', colX.total, y + 7, { width: 60, align: 'right' });

      y += 22;

      // Table rows
      data.items.forEach((item, index) => {
        const isEven = index % 2 === 0;
        const rowMinHeight = 22;

        // Description height
        const clampedDesc = item.description
          ? clampText(item.description, CLAMP_DESCRIPTION_LINES)
          : null;
        const descLines = clampedDesc ? Math.ceil(clampedDesc.length / (CLAMP_CHARS_PER_LINE * 0.55)) : 0;
        const rowHeight = Math.max(rowMinHeight, 22 + descLines * 10);

        // Row background
        if (isEven) {
          doc.rect(PAGE.marginLeft, y, CONTENT_WIDTH, rowHeight)
            .fillColor(COLORS.borderLight).fill();
        }

        // Label
        doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.text)
          .text(item.label, colX.label + 8, y + 6, { width: CONTENT_WIDTH * 0.5 });

        // Description (if any)
        if (clampedDesc) {
          doc.font(FONTS.oblique).fontSize(7).fillColor(COLORS.textMuted)
            .text(clampedDesc, colX.label + 8, y + 17, { width: CONTENT_WIDTH * 0.5 });
        }

        // Qty
        doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.text)
          .text(String(item.qty), colX.qty, y + 6, { width: 40, align: 'center' });

        // Unit price
        doc.text(formatCurrency(item.unitPrice, data.currency), colX.unit, y + 6, { width: 50, align: 'right' });

        // Total
        doc.font(FONTS.bold).fontSize(9).fillColor(COLORS.text)
          .text(formatCurrency(item.total, data.currency), colX.total, y + 6, { width: 60, align: 'right' });

        y += rowHeight;
      });

      // Table bottom border
      doc.moveTo(PAGE.marginLeft, y).lineTo(PAGE.width - PAGE.marginRight, y)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();

      // ─── Totals Block ───────────────────────────────────────────────
      y += 12;
      const totalsX = PAGE.width - PAGE.marginRight - 180;
      const totalsW = 180;

      // Subtotal
      doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.textSecondary)
        .text('Sous-total', totalsX, y);
      doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.text)
        .text(formatCurrency(data.subtotal, data.currency), totalsX + 80, y, { width: 100, align: 'right' });
      y += 16;

      // Discount (if any)
      if (data.discountTotal > 0) {
        doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.textSecondary)
          .text('Remise', totalsX, y);
        doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.success)
          .text(`-${formatCurrency(data.discountTotal, data.currency)}`, totalsX + 80, y, { width: 100, align: 'right' });
        y += 16;
      }

      // Tax
      if (data.taxTotal > 0) {
        doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.textSecondary)
          .text('TVA', totalsX, y);
        doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.text)
          .text(formatCurrency(data.taxTotal, data.currency), totalsX + 80, y, { width: 100, align: 'right' });
        y += 16;
      }

      // Total separator
      doc.moveTo(totalsX, y).lineTo(totalsX + totalsW, y)
        .strokeColor(COLORS.brand).lineWidth(1).stroke();
      y += 8;

      // Grand total
      doc.roundedRect(totalsX, y, totalsW, 28, 4)
        .fillColor(COLORS.brand).fill();
      doc.font(FONTS.bold).fontSize(10).fillColor(COLORS.white)
        .text('TOTAL', totalsX + 10, y + 8);
      doc.font(FONTS.bold).fontSize(12).fillColor(COLORS.white)
        .text(formatCurrency(data.total, data.currency), totalsX + 60, y + 7, { width: 110, align: 'right' });
      y += 40;

      // ─── Payment & Conditions ───────────────────────────────────────
      doc.font(FONTS.bold).fontSize(8).fillColor(COLORS.text)
        .text('CONDITIONS DE RÈGLEMENT', PAGE.marginLeft, y);
      y += 14;

      doc.font(FONTS.regular).fontSize(8).fillColor(COLORS.textSecondary)
        .text(`Mode de paiement : ${getPaymentMethodLabel(data.paymentMethod)}`, PAGE.marginLeft, y);
      y += 12;

      if (data.dueAt) {
        doc.text(`Échéance : ${formatDate(data.dueAt)}`, PAGE.marginLeft, y);
      } else {
        doc.text('Facture payable à réception.', PAGE.marginLeft, y);
      }
      y += 12;

      // Tax regime mention
      doc.font(FONTS.oblique).fontSize(7).fillColor(COLORS.textMuted)
        .text(getTaxRegimeLabel(data.taxRegime), PAGE.marginLeft, y);
      y += 20;

      // Stamp/Cachet (optional — supports local path OR URL, skip if missing)
      const stampSrc = data.issuer.stampPath;
      const stampIsUrl = stampSrc && (stampSrc.startsWith('http://') || stampSrc.startsWith('https://'));
      const stampAvailable = stampSrc && (stampIsUrl || existsSync(stampSrc));
      if (stampAvailable) {
        try {
          doc.save().opacity(0.8);
          doc.image(data.issuer.stampPath!, PAGE.marginLeft, y, { height: 50 });
          doc.restore();
          y += 55;
        } catch {
          // Stamp render failed — silently skip
        }
      }

      // ─── Footer ─────────────────────────────────────────────────────
      // Separator
      const footerY = PAGE.height - PAGE.marginBottom - 40;
      doc.moveTo(PAGE.marginLeft, footerY).lineTo(PAGE.width - PAGE.marginRight, footerY)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();

      // Footer text
      doc.font(FONTS.regular).fontSize(7).fillColor(COLORS.textMuted)
        .text(
          `${data.issuer.name} — ${data.issuer.address}`,
          PAGE.marginLeft, footerY + 8,
          { width: CONTENT_WIDTH, align: 'center' }
        );
      doc.text(
        `MF : ${data.issuer.mf}${data.issuer.rne ? ` — RNE : ${data.issuer.rne}` : ''}`,
        PAGE.marginLeft, footerY + 20,
        { width: CONTENT_WIDTH, align: 'center' }
      );

      // Overflow guard: check we haven't exceeded footer
      if (y > footerY) {
        doc.end();
        reject(new InvoiceOverflowError(
          `Content overflowed into footer zone (content at ${Math.round(y)}pt, footer at ${Math.round(footerY)}pt). ` +
          `Reduce item count or descriptions.`
        ));
        return;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
