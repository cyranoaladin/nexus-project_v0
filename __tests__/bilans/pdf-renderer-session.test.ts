import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import { createBilanPdfRendererSession } from '@/lib/bilans/render/pdf';
import { PREMIERE_ENTRY_RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

describe('A93 shared Chromium renderer session', () => {
  jest.setTimeout(30_000);

  it('renders several PDFs through one explicitly closed browser session', async () => {
    const session = await createBilanPdfRendererSession();
    try {
      const html = renderDeterministicBilanHtml(
        PREMIERE_ENTRY_RECIPE_FACT_SHEETS[0],
        'ELEVE',
        {
          displayName: 'ELEVE_AFIXTURE',
          level: 'PREMIERE',
          subject: 'MATHS',
          date: '2026-08-03',
          stageLabel: 'Stage test A93',
        },
      );
      const first = await session.renderHtmlToPdf(html);
      const second = await session.renderHtmlToPdf(html);
      expect(first.subarray(0, 4).toString()).toBe('%PDF');
      expect(second.subarray(0, 4).toString()).toBe('%PDF');
    } finally {
      await session.close();
    }
  });
});
