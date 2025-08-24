// lib/aria/pdf-fallback.ts
import fs from 'fs';
import path from 'path';

export interface LocalPdfParams {
  content: string;
  fileBaseName: string; // without extension
  studentName?: string;
  subject?: string;
}

export async function generatePdfLocally(params: LocalPdfParams): Promise<{ url: string }> {
  const { content, fileBaseName, studentName, subject } = params;

  // Charger pdfkit dynamiquement pour éviter toute inclusion côté client
  const { default: PDFDocument } = await import('pdfkit');

  const publicDir = path.join(process.cwd(), 'public');
  const outDir = path.join(publicDir, 'generated');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}

  const safeBase = fileBaseName.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const fileName = `${safeBase}.pdf`;
  const filePath = path.join(outDir, fileName);

  await new Promise<void>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(18).text('Nexus Réussite — ARIA', { align: 'center' });
      doc.moveDown(0.5);
      const subtitle: string[] = [];
      if (studentName) subtitle.push(`Élève: ${studentName}`);
      if (subject) subtitle.push(`Matière: ${subject}`);
      const sub = subtitle.join('  •  ');
      if (sub) {
        doc.fontSize(11).fillColor('#555555').text(sub, { align: 'center' });
      }
      doc.fillColor('#000000');
      doc.moveDown(1);

      // Body title
      doc.fontSize(14).text('Fiche méthodologique', { underline: true });
      doc.moveDown(0.5);

      // Content
      const normalized = (content || 'Contenu indisponible.')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)')
        .replace(/^\s*#\s*(.*)$/gm, '$1\n')
        .replace(/^\s*##\s*(.*)$/gm, '$1\n')
        .replace(/^\s*###\s*(.*)$/gm, '$1\n');

      doc.fontSize(12).text(normalized, {
        align: 'left',
        width: 500,
      });

      // Footer
      doc.moveDown();
      const dateStr = new Date().toLocaleString('fr-FR');
      doc.fontSize(10).fillColor('#444444').text(`Généré le ${dateStr} — ARIA`, { align: 'right' });

      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });

  return { url: `/generated/${fileName}` };
}


