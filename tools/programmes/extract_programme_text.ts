/**
 * extract_programme_text.ts — PDF text extraction (CdC V2 §4.1, COMMIT 1)
 *
 * Extracts raw text from official programme PDFs.
 * Uses `pdf-parse` for Node.js-based extraction.
 *
 * Usage:
 *   npx tsx tools/programmes/extract_programme_text.ts --pdf=programmes/pdfs/maths_premiere.pdf
 *
 * Output: programmes/extracted/{key}.extracted.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Extracted programme text structure */
export interface ExtractedProgramme {
  sourcePdf: string;
  extractedAt: string;
  pages: Array<{ page: number; text: string }>;
  fullText: string;
}

/**
 * Extract text from a PDF file.
 * Requires `pdf-parse` package: npm install pdf-parse
 */
export async function extractProgrammeText(pdfPath: string): Promise<ExtractedProgramme> {
  // Dynamic import for pdf-parse (optional dependency)
  let pdfParse: (buffer: Buffer) => Promise<{ numpages: number; text: string }>;
  try {
    const mod = await import('pdf-parse');
    pdfParse = mod.default || mod;
  } catch {
    throw new Error(
      'pdf-parse is not installed. Run: npm install pdf-parse\n' +
      'This is an optional dependency used only for PDF extraction.'
    );
  }

  const absolutePath = path.resolve(pdfPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`PDF not found: ${absolutePath}`);
  }

  const buffer = fs.readFileSync(absolutePath);
  const data = await pdfParse(buffer);

  // pdf-parse returns full text; we split by form feeds for page approximation
  const pageTexts = data.text.split('\f').filter((t) => t.trim().length > 0);

  return {
    sourcePdf: path.basename(pdfPath),
    extractedAt: new Date().toISOString(),
    pages: pageTexts.map((text, i) => ({ page: i + 1, text: text.trim() })),
    fullText: data.text,
  };
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const pdfArg = args.find((a) => a.startsWith('--pdf='));

  if (!pdfArg) {
    console.error('Usage: npx tsx tools/programmes/extract_programme_text.ts --pdf=<path>');
    process.exit(1);
  }

  const pdfPath = pdfArg.split('=')[1];
  const key = path.basename(pdfPath, path.extname(pdfPath));

  console.log(`[extract] Extracting text from: ${pdfPath}`);
  const extracted = await extractProgrammeText(pdfPath);

  const outDir = path.resolve(__dirname, '../../programmes/extracted');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, `${key}.extracted.json`);
  fs.writeFileSync(outPath, JSON.stringify(extracted, null, 2), 'utf-8');
  console.log(`[extract] ✅ Written: ${outPath} (${extracted.pages.length} pages, ${extracted.fullText.length} chars)`);
}

main().catch((err) => {
  console.error('[extract] ❌ Error:', err.message);
  process.exit(1);
});
