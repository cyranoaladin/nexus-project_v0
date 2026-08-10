import fs from 'node:fs';
import path from 'node:path';

describe('A90.2.3 parent PDF engine boundary', () => {
  it('keeps one canonical Parent HTML-to-PDF engine and no legacy renderer module', () => {
    const files = [
      'lib/bilans/render/pdf.ts',
      'lib/bilans/render/legacy-parent-adapter.ts',
      'lib/bilans/api/legacy-parent-pdf.ts',
      'scripts/test-pdf-gen.ts',
      'scripts/test-db-bilan.ts',
    ];
    const source = files
      .map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8'))
      .join('\n');

    expect(fs.existsSync(path.join(process.cwd(), 'lib/pdf/bilan-parent-pdfkit.ts'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'lib/pdf/bilan-parent-template.tsx'))).toBe(false);
    expect(source).toContain('renderParentHtmlToPdf');
    expect(source.match(/export async function renderParentHtmlToPdf/g)).toHaveLength(1);
    expect(source).not.toContain("from 'pdfkit'");
    expect(source).not.toContain("from '@react-pdf/renderer'");
    expect(source).not.toContain('BilanParentPDFDocument');
  });
});
