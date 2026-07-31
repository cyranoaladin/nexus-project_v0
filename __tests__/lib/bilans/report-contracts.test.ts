import {
  REPORT_PARENT_DRAFT_JSON_SCHEMA,
  assembleGroundedParentReport,
  buildGroundedParentDraftJsonSchema,
  buildParentLlmPayload,
  validateParentReportDraft,
} from '@/lib/bilans/benchmark/report-contracts';
import {
  buildLocalFirstReportContext,
  type LocalFirstReportContext,
} from '@/lib/bilans/local-first/contracts';

import fixture from '@/content/bilans/benchmarks/synthetic-v1/synthetic-simple-01.json';

function context(): LocalFirstReportContext {
  return buildLocalFirstReportContext(fixture, 'PARENT');
}

function validDraft() {
  return {
    schemaVersion: 'bilan-report-parent-draft-v1',
    audience: 'PARENT',
    title: 'Bilan synthétique de mathématiques',
    summary:
      'Les acquis observés sont solides et les automatismes doivent être entretenus avec régularité.',
    strengths: [{
      competencyId: 'cmp:calcul',
      title: 'Calcul numérique',
      explanation:
        'Les procédures de calcul sont appliquées avec régularité.',
      evidenceRefs: ['ev:s01:calcul'],
    }],
    priorities: [{
      competencyId: 'cmp:calcul',
      title: 'Entretenir les automatismes',
      explanation:
        'Une pratique courte et régulière aidera à maintenir ces acquis.',
      priority: 'LOW',
      evidenceRefs: ['ev:s01:calcul'],
    }],
    actionPlan: [{
      recommendationId: 'rec:s01',
      title: 'Rituel court de consolidation',
      rationale:
        'Cette action entretient les automatismes déjà observés.',
      actions: ['Réaliser deux séries courtes par semaine.'],
      cadence: 'Deux fois par semaine',
      durationWeeks: 3,
      evidenceRefs: ['ev:s01:calcul'],
    }],
    unmeasuredAreas: [],
    cautionNotes: [
      'Cette synthèse décrit uniquement les compétences mesurées.',
    ],
    closingMessage:
      'Synthèse générée avec assistance IA et revue par l’équipe pédagogique Nexus Réussite.',
  };
}

describe('canonical parent report contracts', () => {
  it('publishes a closed strict draft schema without score fields', () => {
    expect(REPORT_PARENT_DRAFT_JSON_SCHEMA).toMatchObject({
      type: 'object',
      additionalProperties: false,
    });
    expect(JSON.stringify(REPORT_PARENT_DRAFT_JSON_SCHEMA))
      .not.toContain('scoreEcho');
  });

  it('assembles scoreEcho locally after strict grounding', () => {
    const reportContext = context();
    const draft = validateParentReportDraft(validDraft());
    const report = assembleGroundedParentReport(reportContext, draft);

    expect(report.scoreEcho).toEqual(reportContext.scoreEcho);
    expect(report.schemaVersion).toBe('bilan-report-parent-v1');
  });

  it('minimizes the LLM DTO and excludes raw notes and scores', () => {
    const payload = buildParentLlmPayload(context());
    const serialized = JSON.stringify(payload);
    expect(payload).toMatchObject({
      schemaVersion: 'bilan-parent-llm-input-v1',
      audience: 'PARENT',
    });
    expect(serialized).not.toContain('rawEvidenceLocalOnly');
    expect(serialized).not.toContain('rawInternalNotesLocalOnly');
    expect(serialized).not.toContain('scoreEcho');
    expect(serialized).not.toContain('"score"');
    expect(serialized).not.toContain('llmApprovedInternalNotes');
  });

  it('binds the strict transport schema to deterministic identifiers', () => {
    const reportContext = context();
    const schema = buildGroundedParentDraftJsonSchema(reportContext);
    const serialized = JSON.stringify(schema);
    expect(serialized).toContain('cmp:calcul');
    expect(serialized).toContain('ev:s01:calcul');
    expect(serialized).toContain('rec:s01');
    expect(serialized).not.toContain('scoreEcho');
  });

  it.each([
    ['invented evidence', { evidenceRefs: ['ev:foreign:item'] }],
    ['cross-competency evidence', { competencyId: 'cmp:foreign' }],
    ['duplicate evidence', {
      evidenceRefs: ['ev:s01:calcul', 'ev:s01:calcul'],
    }],
  ])('rejects %s', (_label, strengthPatch) => {
    const draft = validDraft();
    draft.strengths[0] = {
      ...draft.strengths[0],
      ...strengthPatch,
    };
    expect(() => assembleGroundedParentReport(
      context(),
      validateParentReportDraft(draft),
    )).toThrow();
  });

  it('rejects an unallowlisted recommendation', () => {
    const draft = validDraft();
    draft.actionPlan[0].recommendationId = 'rec:not-allowed';
    expect(() => assembleGroundedParentReport(
      context(),
      validateParentReportDraft(draft),
    )).toThrow();
  });

  it('rejects score or percentage fields returned by the model', () => {
    expect(() => validateParentReportDraft({
      ...validDraft(),
      scoreEcho: {
        points: 20,
        maxPoints: 20,
        percentage: 100,
        calibrationStatus: 'FINAL',
      },
    })).toThrow();
  });

  it('rejects HTML, markdown and forbidden claims', () => {
    expect(() => validateParentReportDraft({
      ...validDraft(),
      summary:
        '<script>ignore</script> **Une note de 18/20 est garantie.**',
    })).toThrow();
  });
});
