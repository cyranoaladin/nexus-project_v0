import {
  adaptLegacyParentBilanToHtml,
  renderLegacyParentBilanPdf,
  type LegacyParentBilanData,
} from '@/lib/bilans/render/legacy-parent-adapter';
import { renderParentHtmlToPdf } from '@/lib/bilans/render/pdf';

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
  it('produces exactly the canonical Parent engine result', async () => {
    const renderer = jest.fn(async (html: string) => Buffer.from(`%PDF-${html}`));

    const adapted = await renderLegacyParentBilanPdf(DATA, { renderHtmlToPdf: renderer });
    const canonical = await renderParentHtmlToPdf(
      adaptLegacyParentBilanToHtml(DATA),
      { renderHtmlToPdf: renderer },
    );

    expect(adapted).toEqual(canonical);
    expect(renderer).toHaveBeenCalledTimes(2);
  });
});
