#!/usr/bin/env node
/*
  Generate deterministic stub PDFs for E2E runs using pdf-lib.
  - public/files/bilan-parent-stub.pdf: >= 180 KB, >= 3 pages
  - public/files/bilan-eleve-stub.pdf: >= 110 KB, >= 2 pages
  We pad the resulting PDF with harmless trailing spaces if needed to reach target sizes.
*/

import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function makePdf(pages, title) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = pdfDoc.addPage([612, 792]); // US Letter
    const { width, height } = page.getSize();
    page.drawText(`${title} — Page ${i}`, {
      x: 72,
      y: height - 72,
      size: 18,
      font,
      color: rgb(0, 0, 0),
    });
    // Draw some content to ensure page exists
    for (let j = 0; j < 50; j++) {
      page.drawText(`Line ${j + 1} — ${'•'.repeat(20)}`, { x: 72, y: height - 100 - j * 12, size: 10, font });
    }
  }
  return await pdfDoc.save();
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
}

async function writeOut(filePath, bytes) {
  const buf = Buffer.from(bytes);
  await fs.promises.writeFile(filePath, buf);
  return buf.length;
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'files');
  await ensureDir(outDir);

  // Parent: >= 180KB, >= 3 pages
  let parentPages = 6;
  let parentBytes = await makePdf(parentPages, 'Bilan Parent Stub');
  while (parentBytes.length < 180 * 1024 && parentPages < 200) {
    parentPages += 6;
    parentBytes = await makePdf(parentPages, 'Bilan Parent Stub');
  }
  const parentPath = path.join(outDir, 'bilan-parent-stub.pdf');
  const parentSize = await writeOut(parentPath, parentBytes);

  // Eleve: >= 110KB, >= 2 pages
  let elevePages = 4;
  let eleveBytes = await makePdf(elevePages, 'Bilan Élève Stub');
  while (eleveBytes.length < 110 * 1024 && elevePages < 200) {
    elevePages += 4;
    eleveBytes = await makePdf(elevePages, 'Bilan Élève Stub');
  }
  const elevePath = path.join(outDir, 'bilan-eleve-stub.pdf');
  const eleveSize = await writeOut(elevePath, eleveBytes);

  console.log(`[stub-pdfs] Wrote ${parentPath} (${parentSize} bytes), ${elevePath} (${eleveSize} bytes)`);
}
main().catch((e) => {
  console.error('[stub-pdfs] Failed:', e);
  process.exit(1);
});

