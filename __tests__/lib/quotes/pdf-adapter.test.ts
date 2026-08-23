import { buildQuotePdfData } from '@/lib/quotes/pdf-adapter';
import type { QuoteScenario, SituationInput } from '@/lib/quotes/schemas';

const situation: SituationInput = {
  level: 'terminale',
  examSession: 2027,
  specialites: ['MATHEMATIQUES', 'NSI'],
};

function scenario(overrides: Partial<QuoteScenario> = {}): QuoteScenario {
  return {
    tier: 'RECOMMANDE',
    lines: [
      {
        subject: 'eds1',
        label: 'Mathématiques',
        modality: 'GROUPE',
        hoursPerMonth: 8,
        unitPriceMonthly: 470,
        priorityScore: 100,
        priorityLabel: 'haute',
        reason: 'test',
      },
      {
        subject: 'pilotage',
        label: 'Pilotage Nexus',
        modality: 'PILOTAGE',
        hoursPerMonth: 0,
        unitPriceMonthly: 150,
        priorityScore: Number.MAX_SAFE_INTEGER,
        priorityLabel: 'haute',
        reason: 'toujours inclus',
      },
    ],
    notRecommended: [],
    monthlyTotal: 620,
    grandTotal: 6200,
    months: 10,
    matchedOfferId: null,
    ...overrides,
  };
}

describe('buildQuotePdfData', () => {
  test('maps subjects to their display labels, not raw enum values', () => {
    const data = buildQuotePdfData({
      situation,
      scenario: scenario(),
      quoteId: 'quote-1',
      validUntil: new Date('2027-03-01T00:00:00Z'),
      advisorName: 'Assistante Nexus',
      leadName: 'Jean Dupont',
      leadEmail: 'jean@example.com',
      leadPhone: '+21699000000',
    });
    expect(data.specialites).toEqual(['Mathématiques', 'NSI']);
    expect(data.level).toBe('Terminale');
  });

  test('builds one installment row per month, all equal, no deposit language', () => {
    const data = buildQuotePdfData({
      situation,
      scenario: scenario({ months: 10, monthlyTotal: 620 }),
      quoteId: 'quote-1',
      validUntil: new Date('2027-03-01T00:00:00Z'),
      advisorName: 'Assistante Nexus',
      leadName: 'Jean Dupont',
      leadEmail: 'jean@example.com',
      leadPhone: '+21699000000',
    });
    expect(data.offer.ech).toHaveLength(10);
    expect(data.offer.ech.every((row) => row.amount === 620)).toBe(true);
    expect(data.mode.toLowerCase()).toContain('sans acompte');
  });

  test('includes every scenario line, with hours/month appended when present', () => {
    const data = buildQuotePdfData({
      situation,
      scenario: scenario(),
      quoteId: 'quote-1',
      validUntil: new Date('2027-03-01T00:00:00Z'),
      advisorName: 'Assistante Nexus',
      leadName: 'Jean Dupont',
      leadEmail: 'jean@example.com',
      leadPhone: '+21699000000',
    });
    expect(data.offer.inc).toEqual(['Mathématiques — 8 h/mois', 'Pilotage Nexus']);
  });

  test('never contains a teacher-cost/margin key', () => {
    const data = buildQuotePdfData({
      situation,
      scenario: scenario(),
      quoteId: 'quote-1',
      validUntil: new Date('2027-03-01T00:00:00Z'),
      advisorName: 'Assistante Nexus',
      leadName: 'Jean Dupont',
      leadEmail: 'jean@example.com',
      leadPhone: '+21699000000',
    });
    const json = JSON.stringify(data).toLowerCase();
    for (const forbidden of ['teachercost', 'costprice', 'grossmargin', 'marginpct', 'internalfloor']) {
      expect(json).not.toContain(forbidden);
    }
  });

  test('falls back to "Non renseigné" when no student label is known', () => {
    const data = buildQuotePdfData({
      situation,
      scenario: scenario(),
      quoteId: 'quote-1',
      validUntil: new Date('2027-03-01T00:00:00Z'),
      advisorName: 'Assistante Nexus',
      leadName: 'Jean Dupont',
      leadEmail: 'jean@example.com',
      leadPhone: '+21699000000',
    });
    expect(data.studentName).toBe('Non renseigné');
  });
});
