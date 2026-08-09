import { ENTRY_RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

import {
  PAPER_ENTRY_DURATION_MEASUREMENT,
  prepareReportPassationPresentation,
} from '@/lib/bilans/render/passation-presentation';
import { buildDeterministicReports } from '@/lib/bilans/render/report';
import { validateDeterministicReports } from '@/lib/bilans/worker/structural-validation';

const rawExpressFactSheet = Object.freeze({
  ...ENTRY_RECIPE_FACT_SHEETS[0],
  flags: Object.freeze([
    ...ENTRY_RECIPE_FACT_SHEETS[0].flags.filter((flag) => flag !== 'PASSATION_EXPRESS'),
    'PASSATION_EXPRESS' as const,
  ]),
});

describe('Présentation de la durée de passation dans le rapport', () => {
  test('une saisie papier ne porte jamais PASSATION_EXPRESS dans sa vue de rapport', () => {
    const presentation = prepareReportPassationPresentation(rawExpressFactSheet, 'SAISIE_PAPIER');

    expect(rawExpressFactSheet.flags).toContain('PASSATION_EXPRESS');
    expect(presentation.factSheet.flags).not.toContain('PASSATION_EXPRESS');
    expect(presentation.durationMeasurement).toBe(PAPER_ENTRY_DURATION_MEASUREMENT);
  });

  test('une passation en ligne réellement express conserve son drapeau', () => {
    const presentation = prepareReportPassationPresentation(rawExpressFactSheet, 'EN_LIGNE');

    expect(presentation.factSheet.flags).toContain('PASSATION_EXPRESS');
    expect(presentation.durationMeasurement).toBeUndefined();
  });

  test('la projection de rapport ne modifie jamais le snapshot brut', () => {
    const before = JSON.stringify(rawExpressFactSheet);

    prepareReportPassationPresentation(rawExpressFactSheet, 'SAISIE_PAPIER');

    expect(JSON.stringify(rawExpressFactSheet)).toBe(before);
  });

  test('la validation structurelle accepte le marqueur contrôlé', () => {
    const presentation = prepareReportPassationPresentation(rawExpressFactSheet, 'SAISIE_PAPIER');
    const reports = buildDeterministicReports(presentation.factSheet, {
      displayName: rawExpressFactSheet.student.alias,
      level: rawExpressFactSheet.student.level,
      subject: 'MATHS',
      date: '2026-08-08',
      stageLabel: 'Stage de pré-rentrée — Mathématiques',
      durationMeasurement: presentation.durationMeasurement,
    });

    expect(() => validateDeterministicReports(presentation.factSheet, reports)).not.toThrow();
  });
});
