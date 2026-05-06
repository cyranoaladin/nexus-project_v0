/**
 * PDF template for assessments using PDFKit.
 * Server-side PDF generation without React SSR issues.
 */

import PDFDocument from 'pdfkit';
import type { AssessmentPDFData } from './assessment-template';

export async function renderAssessmentPDF(data: AssessmentPDFData): Promise<Buffer> {
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
    doc.fontSize(20).fillColor('#0f172a').text(`Bilan d'évaluation — ${data.subject}`).moveDown(0.5);
    doc.fontSize(10).fillColor('#64748b').text(`${data.grade} — ${data.studentName}`).moveDown(2);

    // Meta
    const formattedDate = new Date(data.createdAt).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    doc.fontSize(10).fillColor('#0f172a')
      .text(`Date : ${formattedDate}`)
      .text(`Email : ${data.studentEmail}`);
    
    if (data.globalScore !== null) {
      doc.fontSize(20).fillColor('#4f46e5').font('Helvetica-Bold').text(`Score : ${Math.round(data.globalScore)}/100`).font('Helvetica');
    }

    doc.moveDown(2);
    doc.moveTo(40, doc.y).lineTo(555.28, doc.y).lineWidth(1).strokeColor('#e2e8f0').stroke().moveDown(2);

    // Diagnostic
    if (data.diagnosticText) {
      doc.fontSize(12).fillColor('#4f46e5').font('Helvetica-Bold').text('Diagnostic').moveDown(1);
      doc.fontSize(11).fillColor('#0f172a').font('Helvetica').text(data.diagnosticText).moveDown(2);
    }

    // Strengths
    if (data.strengths.length > 0) {
      doc.fontSize(12).fillColor('#4f46e5').font('Helvetica-Bold').text('Points forts').moveDown(1);
      data.strengths.forEach(s => doc.fontSize(11).fillColor('#0f172a').font('Helvetica').text(`• ${s}`));
      doc.moveDown(2);
    }

    // Weaknesses
    if (data.weaknesses.length > 0) {
      doc.fontSize(12).fillColor('#4f46e5').font('Helvetica-Bold').text('Axes d\'amélioration').moveDown(1);
      data.weaknesses.forEach(w => doc.fontSize(11).fillColor('#0f172a').font('Helvetica').text(`• ${w}`));
      doc.moveDown(2);
    }

    // Recommendations
    if (data.recommendations.length > 0) {
      doc.fontSize(12).fillColor('#4f46e5').font('Helvetica-Bold').text('Recommandations').moveDown(1);
      data.recommendations.forEach(r => doc.fontSize(11).fillColor('#0f172a').font('Helvetica').text(`• ${r}`));
      doc.moveDown(2);
    }

    // Footer
    doc.fontSize(8).fillColor('#64748b').moveDown(4)
      .text(`Bilan généré par Nexus Réussite — Document confidentiel destiné à ${data.studentName}`)
      .text('© Nexus Réussite');

    doc.end();
  });
}
