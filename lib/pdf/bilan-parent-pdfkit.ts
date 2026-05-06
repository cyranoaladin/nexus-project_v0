/**
 * PDF template for parent-facing stage bilans using PDFKit.
 * Server-side PDF generation without React SSR issues.
 */

import PDFDocument from 'pdfkit';
import type { BilanParentPDFData } from './bilan-parent-template';

export async function renderBilanParentPDF(data: BilanParentPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Brand bar
    doc.rect(0, 0, 595.28, 6).fill('#4f46e5');

    // Header
    doc.fontSize(9).fillColor('#4f46e5').font('Helvetica-Bold').text('NEXUS RÉUSSITE', { characterSpacing: 1 }).moveDown(2);
    doc.fontSize(20).fillColor('#0f172a').text(`Bilan de stage — ${data.subjectLabel}`).moveDown(0.5);
    doc.fontSize(10).fillColor('#64748b').text(data.stageTitle).moveDown(2);

    // Meta
    const publishedDateLabel = new Date(data.publishedAt).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    doc.fontSize(10).fillColor('#0f172a')
      .text(`Élève : ${data.studentName}`)
      .text(`Coach : ${data.coachName ?? '—'}`)
      .text(`Publié le : ${publishedDateLabel}`);
    if (data.globalScore !== null) {
      doc.fontSize(20).fillColor('#4f46e5').font('Helvetica-Bold').text(`Score : ${Math.round(data.globalScore)}/100`).font('Helvetica');
    }

    doc.moveDown(2);
    doc.moveTo(40, doc.y).lineTo(555.28, doc.y).lineWidth(1).strokeColor('#e2e8f0').stroke().moveDown(2);

    // Content (plain text)
    doc.fontSize(11).fillColor('#0f172a').text(data.parentsMarkdown.replace(/[#*`]/g, ''));

    // Footer
    doc.fontSize(8).fillColor('#64748b').moveDown(4)
      .text(`Bilan généré par Nexus Réussite — Document confidentiel destiné à la famille de ${data.studentName}`)
      .text('© Nexus Réussite');

    doc.end();
  });
}
