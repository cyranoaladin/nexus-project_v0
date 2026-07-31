import 'server-only';

import recommendationCatalog from '@/content/bilans/recommendations/catalog-v1.json';

type GroundingIssue = Readonly<{
  path: readonly (string | number)[];
  message: string;
}>;

type GroundingInput = Readonly<{
  score: Readonly<{ points: number; maxPoints: number }>;
  competencies: readonly Readonly<{
    competencyId: string;
    status: 'MASTERED' | 'DEVELOPING' | 'PRIORITY' | 'UNMEASURED';
  }>[];
  evidence: readonly Readonly<{
    evidenceRef: string;
    competencyId: string;
    evidenceScopeVersion?: 'TRANSVERSAL_V1';
  }>[];
  priorities: readonly Readonly<{
    competencyId: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    evidenceRefs: readonly string[];
  }>[];
  recommendations: readonly Readonly<{
    recommendationId: string;
    competencyId: string;
    evidenceRefs: readonly string[];
    title?: string;
    rationale?: string;
    transversalEvidencePolicy?: 'ALLOW_TRANSVERSAL_V1';
  }>[];
  unmeasuredCompetencyIds: readonly string[];
}>;

const CATALOG = new Map(
  recommendationCatalog.recommendations.map((entry) => [
    entry.recommendationId,
    Object.freeze(entry),
  ]),
);

function duplicateIndexes(values: readonly string[]): number[] {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  values.forEach((value, index) => {
    if (seen.has(value)) duplicates.push(index);
    seen.add(value);
  });
  return duplicates;
}

function addDuplicateIssues(
  issues: GroundingIssue[],
  values: readonly string[],
  path: string,
  label: string,
): void {
  for (const index of duplicateIndexes(values)) {
    issues.push({
      path: [path, index],
      message: `Duplicate ${label}.`,
    });
  }
}

export function validateGrounding(input: GroundingInput): GroundingIssue[] {
  const issues: GroundingIssue[] = [];
  if (input.score.points > input.score.maxPoints) {
    issues.push({
      path: ['score', 'points'],
      message: 'Score points exceed maxPoints.',
    });
  }

  addDuplicateIssues(
    issues,
    input.competencies.map(({ competencyId }) => competencyId),
    'competencies',
    'competencyId',
  );
  addDuplicateIssues(
    issues,
    input.evidence.map(({ evidenceRef }) => evidenceRef),
    'evidence',
    'evidenceRef',
  );
  addDuplicateIssues(
    issues,
    input.recommendations.map(({ recommendationId }) => recommendationId),
    'recommendations',
    'recommendationId',
  );

  const competencies = new Map(
    input.competencies.map((item) => [item.competencyId, item]),
  );
  const evidence = new Map(
    input.evidence.map((item) => [item.evidenceRef, item]),
  );

  input.evidence.forEach((item, index) => {
    if (!competencies.has(item.competencyId)) {
      issues.push({
        path: ['evidence', index, 'competencyId'],
        message: 'Evidence references an unknown competency.',
      });
    }
  });

  input.priorities.forEach((priority, index) => {
    addDuplicateIssues(
      issues,
      priority.evidenceRefs,
      `priorities.${index}.evidenceRefs`,
      'priority evidenceRef',
    );
    const competency = competencies.get(priority.competencyId);
    if (competency === undefined) {
      issues.push({
        path: ['priorities', index, 'competencyId'],
        message: 'Priority references an unknown competency.',
      });
    } else if (competency.status === 'UNMEASURED') {
      issues.push({
        path: ['priorities', index, 'competencyId'],
        message: 'An unmeasured competency cannot be a priority.',
      });
    }
    if (priority.priority === 'HIGH' && priority.evidenceRefs.length === 0) {
      issues.push({
        path: ['priorities', index, 'evidenceRefs'],
        message: 'A HIGH priority requires evidence.',
      });
    }
    priority.evidenceRefs.forEach((reference, referenceIndex) => {
      const item = evidence.get(reference);
      if (item === undefined) {
        issues.push({
          path: ['priorities', index, 'evidenceRefs', referenceIndex],
          message: 'Priority references unknown evidence.',
        });
      } else if (item.competencyId !== priority.competencyId) {
        issues.push({
          path: ['priorities', index, 'evidenceRefs', referenceIndex],
          message: 'Priority evidence belongs to another competency.',
        });
      }
    });
  });

  input.recommendations.forEach((recommendation, index) => {
    addDuplicateIssues(
      issues,
      recommendation.evidenceRefs,
      `recommendations.${index}.evidenceRefs`,
      'recommendation evidenceRef',
    );
    const catalogEntry = CATALOG.get(recommendation.recommendationId);
    if (!competencies.has(recommendation.competencyId)) {
      issues.push({
        path: ['recommendations', index, 'competencyId'],
        message: 'Recommendation references an unknown competency.',
      });
    }
    if (
      catalogEntry === undefined
      || catalogEntry.competencyId !== recommendation.competencyId
    ) {
      issues.push({
        path: ['recommendations', index, 'recommendationId'],
        message: 'Recommendation is absent from the local catalog.',
      });
    } else if (
      recommendation.title !== undefined
      || recommendation.rationale !== undefined
    ) {
      if (
        recommendation.title !== catalogEntry.title
        || recommendation.rationale !== catalogEntry.rationale
      ) {
        issues.push({
          path: ['recommendations', index],
          message: 'Recommendation copy differs from the local catalog.',
        });
      }
    }
    recommendation.evidenceRefs.forEach((reference, referenceIndex) => {
      const item = evidence.get(reference);
      if (item === undefined) {
        issues.push({
          path: ['recommendations', index, 'evidenceRefs', referenceIndex],
          message: 'Recommendation references unknown evidence.',
        });
      } else if (
        item.competencyId !== recommendation.competencyId
        && !(
          item.evidenceScopeVersion === 'TRANSVERSAL_V1'
          && recommendation.transversalEvidencePolicy
            === 'ALLOW_TRANSVERSAL_V1'
        )
      ) {
        issues.push({
          path: ['recommendations', index, 'evidenceRefs', referenceIndex],
          message: 'Recommendation evidence belongs to another competency.',
        });
      }
    });
  });

  addDuplicateIssues(
    issues,
    input.unmeasuredCompetencyIds,
    'unmeasuredCompetencyIds',
    'unmeasured competencyId',
  );
  const expectedUnmeasured = new Set(
    input.competencies
      .filter(({ status }) => status === 'UNMEASURED')
      .map(({ competencyId }) => competencyId),
  );
  const declaredUnmeasured = new Set(input.unmeasuredCompetencyIds);
  input.unmeasuredCompetencyIds.forEach((competencyId, index) => {
    if (!expectedUnmeasured.has(competencyId)) {
      issues.push({
        path: ['unmeasuredCompetencyIds', index],
        message: 'Only UNMEASURED competencies belong in the list.',
      });
    }
  });
  for (const competencyId of expectedUnmeasured) {
    if (!declaredUnmeasured.has(competencyId)) {
      issues.push({
        path: ['unmeasuredCompetencyIds'],
        message: `Missing UNMEASURED competency ${competencyId}.`,
      });
    }
  }
  return issues;
}

export function resolveRecommendation(
  recommendationId: string,
): Readonly<{
  recommendationId: string;
  competencyId: string;
  title: string;
  rationale: string;
}> | null {
  return CATALOG.get(recommendationId) ?? null;
}
