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
    monthlyTotal: 465,
    grandTotal: 6200,
    months: 10,
    matchedOfferId: null,
    deposit: 1550,
    lastInstallmentAmount: 465,
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

  test('builds one acompte row + one row per remaining mensualité (D4: 25% acompte + 10 mensualités, last absorbs rounding)', () => {
    const data = buildQuotePdfData({
      situation,
      scenario: scenario({ months: 10, monthlyTotal: 465, deposit: 1550, lastInstallmentAmount: 465 }),
      quoteId: 'quote-1',
      validUntil: new Date('2027-03-01T00:00:00Z'),
      advisorName: 'Assistante Nexus',
      leadName: 'Jean Dupont',
      leadEmail: 'jean@example.com',
      leadPhone: '+21699000000',
    });
    // 1 acompte row + 9 regular mensualités + 1 last mensualité = 11 rows.
    expect(data.offer.ech).toHaveLength(11);
    expect(data.offer.ech[0].amount).toBe(1550);
    expect(data.offer.ech[0].label.toLowerCase()).toContain('acompte');
    expect(data.offer.ech.slice(1, 10).every((row) => row.amount === 465)).toBe(true);
    expect(data.offer.ech[10].amount).toBe(465);
    const total = data.offer.ech.reduce((sum, row) => sum + row.amount, 0);
    expect(total).toBe(6200);
    expect(data.mode.toLowerCase()).toContain('acompte');
    expect(data.mode).not.toContain('sans acompte');
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
