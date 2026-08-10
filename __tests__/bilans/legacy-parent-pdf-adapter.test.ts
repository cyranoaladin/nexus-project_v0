import { createHash } from 'node:crypto';
import {
  adaptLegacyParentBilanToHtml,
  renderLegacyParentBilanPdf,
  type LegacyParentBilanData,
} from '@/lib/bilans/render/legacy-parent-adapter';

const DATA: LegacyParentBilanData = {
  studentName: 'Élève Test',
  stageTitle: 'Stage Test',
  subjectLabel: 'Mathématiques',
  coachName: 'Coach Test',
  publishedAt: '2026-08-10T00:00:00.000Z',
  globalScore: null,
  parentsMarkdown: '## Synthèse\n\n**Progrès** constants.',
};

describe('legacy Parent PDF compatibility adapter', () => {
  const GOLDEN_HTML_SHA256 = 'c6837445ada01311833cfa889df68bc33e0bfd8a9169382b434a9030c3b00939';

  it('keeps the historical URL adapter output pinned to an independent golden', () => {
    const html = adaptLegacyParentBilanToHtml(DATA);

    expect(createHash('sha256').update(html).digest('hex')).toBe(GOLDEN_HTML_SHA256);
    expect(html).toContain('<h2>Synthèse</h2>');
    expect(html).toContain('<strong>Progrès</strong> constants.');
    expect(html).toContain('data-audience="PARENTS"');
    expect(html).toContain('Nexus Réussite · Document confidentiel destiné à la famille');
  });

  it('passes the pinned adapter HTML once through the canonical byte engine', async () => {
    const expectedHtml = adaptLegacyParentBilanToHtml(DATA);
    const sentinelPdf = Buffer.from('%PDF-canonical-engine-sentinel');
    const renderer = jest.fn(async (html: string) => {
      expect(createHash('sha256').update(html).digest('hex')).toBe(GOLDEN_HTML_SHA256);
      expect(html).toBe(expectedHtml);
      return sentinelPdf;
    });

    await expect(renderLegacyParentBilanPdf(DATA, { renderHtmlToPdf: renderer }))
      .resolves.toEqual(sentinelPdf);
    expect(renderer).toHaveBeenCalledTimes(1);
  });

  it('escapes identity fields and never treats them as report markup', () => {
    const html = adaptLegacyParentBilanToHtml({
      ...DATA,
      studentName: '<script>alert(1)</script>',
      coachName: 'Coach & Associé',
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Coach &amp; Associé');
  });
});
