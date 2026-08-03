import fs from 'node:fs';
import path from 'node:path';

describe('A90.2.3 parent PDF engine boundary', () => {
  it('keeps one HTML-to-PDF engine and no parent-specific PDFKit or React-PDF renderer', () => {
    const files = [
      'lib/pdf/bilan-parent-pdfkit.ts',
      'lib/pdf/bilan-parent-template.tsx',
      'scripts/test-pdf-gen.ts',
      'scripts/test-db-bilan.ts',
    ];
    const source = files
      .map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8'))
      .join('\n');

    expect(source).toContain('renderHtmlToPdf');
    expect(source).not.toContain("from 'pdfkit'");
    expect(source).not.toContain("from '@react-pdf/renderer'");
    expect(source).not.toContain('BilanParentPDFDocument');
  });
});
