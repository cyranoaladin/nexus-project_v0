import { projectPaperEntryItems } from '@/lib/bilans/saisie-papier/projection';

describe('projection de saisie papier', () => {
  test('présente les options dans l’ordre A/B/C/D même si le pack les stocke autrement', () => {
    const enabled = {
      pack: {
        questionnaire: {
          items: [{
            id: 'ETL-MCO-TEST-01',
            questionText: 'Question de test',
            options: [
              { id: 'B', text: 'réponse B' },
              { id: 'D', text: 'réponse D' },
              { id: 'A', text: 'réponse A' },
              { id: 'C', text: 'réponse C' },
            ],
          }],
        },
      },
    } as never;

    const [item] = projectPaperEntryItems(enabled);
    expect(item.options.map(({ id }) => id)).toEqual(['A', 'B', 'C', 'D']);
    expect(item.options.map(({ label }) => label)).toEqual([
      'réponse A', 'réponse B', 'réponse C', 'réponse D',
    ]);
  });
});
