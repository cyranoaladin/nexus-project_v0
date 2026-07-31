/** @jest-environment node */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  SyntheticBenchmarkFixtureSchema,
  buildLocalFirstReportContext,
  validateLocalFirstReportContext,
} from '@/lib/bilans/local-first/contracts';
import { validateGrounding } from '@/lib/bilans/local-first/grounding';

const FIXTURE = JSON.parse(readFileSync(join(
  process.cwd(),
  'content/bilans/benchmarks/synthetic-v1/synthetic-complex-04.json',
), 'utf8'));

describe('local-first semantic grounding', () => {
  it.each([
    ['competency id', (value: any) => {
      value.competencies.push({ ...value.competencies[0] });
    }],
    ['evidence ref', (value: any) => {
      value.approvedEvidenceForLlm.push({
        ...value.approvedEvidenceForLlm[0],
      });
    }],
    ['recommendation id', (value: any) => {
      value.allowedRecommendations.push({
        ...value.allowedRecommendations[0],
      });
    }],
  ])('rejects a duplicate %s', (_label, mutate) => {
    const value = structuredClone(FIXTURE);
    mutate(value);
    expect(() => SyntheticBenchmarkFixtureSchema.parse(value)).toThrow();
  });

  it('rejects priority evidence owned by another competency', () => {
    const value = structuredClone(FIXTURE);
    const foreign = value.approvedEvidenceForLlm.find(
      ({ competencyId }: { competencyId: string }) =>
        competencyId !== value.priorities[0].competencyId,
    );
    expect(foreign).toBeDefined();
    value.priorities[0].evidenceRefs = [foreign.evidenceRef];

    expect(() => SyntheticBenchmarkFixtureSchema.parse(value)).toThrow();
  });

  it('rejects recommendation evidence owned by another competency', () => {
    const value = structuredClone(FIXTURE);
    const recommendation = value.allowedRecommendations[0];
    const foreign = value.approvedEvidenceForLlm.find(
      ({ competencyId }: { competencyId: string }) =>
        competencyId !== recommendation.competencyId,
    );
    expect(foreign).toBeDefined();
    recommendation.evidenceRefs = [foreign.evidenceRef];
    delete recommendation.transversalEvidencePolicy;

    expect(() => SyntheticBenchmarkFixtureSchema.parse(value)).toThrow(
      /recommendation evidence belongs to another competency/i,
    );
  });

  it('rejects a transversal recommendation for an absent competency', () => {
    const recommendation = FIXTURE.allowedRecommendations[0];
    const foreign = FIXTURE.approvedEvidenceForLlm.find(
      ({ competencyId }: { competencyId: string }) =>
        competencyId !== recommendation.competencyId,
    );
    expect(foreign).toBeDefined();

    const issues = validateGrounding({
      score: FIXTURE.score,
      competencies: FIXTURE.competencies.filter(
        ({ competencyId }: { competencyId: string }) =>
          competencyId !== recommendation.competencyId,
      ),
      evidence: [{ ...foreign, evidenceScopeVersion: 'TRANSVERSAL_V1' }],
      priorities: [],
      recommendations: [{
        ...recommendation,
        evidenceRefs: [foreign.evidenceRef],
        transversalEvidencePolicy: 'ALLOW_TRANSVERSAL_V1',
      }],
      unmeasuredCompetencyIds: FIXTURE.unmeasuredCompetencyIds.filter(
        (competencyId: string) => competencyId !== recommendation.competencyId,
      ),
    });

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: 'Recommendation references an unknown competency.',
      }),
    ]));
  });

  it('rejects a mismatch between UNMEASURED status and its exact list', () => {
    const context = buildLocalFirstReportContext(FIXTURE, 'PARENT');
    expect(() => validateLocalFirstReportContext({
      ...context,
      unmeasuredCompetencyIds: [],
    })).toThrow();
    const measured = context.competencies.find(
      ({ status }) => status !== 'UNMEASURED',
    );
    expect(measured).toBeDefined();
    expect(() => validateLocalFirstReportContext({
      ...context,
      unmeasuredCompetencyIds: [
        ...context.unmeasuredCompetencyIds,
        measured?.competencyId,
      ],
    })).toThrow();
  });

  it('rejects UNMEASURED priorities', () => {
    const value = structuredClone(FIXTURE);
    const unmeasured = value.competencies.find(
      ({ status }: { status: string }) => status === 'UNMEASURED',
    );
    expect(unmeasured).toBeDefined();
    value.priorities[0].competencyId = unmeasured.competencyId;
    expect(() => SyntheticBenchmarkFixtureSchema.parse(value)).toThrow();
  });

  it('rejects a recommendation absent from the local versioned catalog', () => {
    const value = structuredClone(FIXTURE);
    value.allowedRecommendations[0].recommendationId =
      'rec:not-in-catalog';

    expect(() => SyntheticBenchmarkFixtureSchema.parse(value)).toThrow();
  });

  it('requires a HIGH priority to cite at least one same-competency proof', () => {
    const value = structuredClone(FIXTURE);
    value.priorities[0].priority = 'HIGH';
    value.priorities[0].evidenceRefs = [];

    expect(() => SyntheticBenchmarkFixtureSchema.parse(value)).toThrow();
  });
});
