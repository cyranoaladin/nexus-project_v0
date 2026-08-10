import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

describe('A90.2.3 parent PDF engine boundary', () => {
  it('keeps one canonical Parent HTML-to-PDF engine and no legacy renderer module', () => {
    const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
      .split('\0')
      .filter(Boolean)
      .filter((file) => /^(?:app|lib|scripts)\/.+\.[cm]?[jt]sx?$/.test(file))
      .filter((file) => fs.existsSync(path.join(process.cwd(), file)));
    const source = files
      .map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8'))
      .join('\n');

    expect(fs.existsSync(path.join(process.cwd(), 'lib/pdf/bilan-parent-pdfkit.ts'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'lib/pdf/bilan-parent-template.tsx'))).toBe(false);
    expect(source.match(/export async function renderParentHtmlToPdf/g)).toHaveLength(1);
    expect(source).not.toContain('BilanParentPDFDocument');
    expect(source).not.toContain('bilan-parent-pdfkit');
    expect(source).not.toContain('bilan-parent-template');
  });
});
