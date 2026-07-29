import {
  ManualGradingRequiredError,
  assertFinalizationAllowed,
  evaluateManualGrading,
  loadPedagogyCatalog,
  type ManualGrade,
} from '@/lib/pre-rentree/pedagogy';

describe('canonical manual-grading gate', () => {
  const catalog = loadPedagogyCatalog();
  const assessment = catalog.getAssessment(
    'francais-entree-premiere',
    'INTERNAL_REVIEW',
  );
  const manualItemIds = assessment.items
    .filter(({ responseMode }) => responseMode === 'MANUAL_SHORT_RESPONSE')
    .map(({ id }) => id);

  it('keeps short responses pending instead of treating them as false', () => {
    const readiness = evaluateManualGrading(assessment, []);

    expect(manualItemIds.length).toBeGreaterThan(0);
    expect(readiness.workflowStatus).toBe('EN_ATTENTE_CORRECTION_MANUELLE');
    expect(readiness.pendingManualItemIds).toEqual(manualItemIds);
    expect(readiness.manuallyGradedItemIds).toEqual([]);
    expect(readiness.automaticallyScorableItemIds).not.toEqual(
      expect.arrayContaining(manualItemIds),
    );
    expect(readiness).not.toHaveProperty('incorrectItemIds');
  });

  it.each([
    'FINAL_SCORE',
    'FINAL_GROUP_CALIBRATION',
    'FINAL_REPORT',
  ] as const)('blocks %s until every manual response is reviewed', (operation) => {
    const readiness = evaluateManualGrading(assessment, []);

    expect(() => assertFinalizationAllowed(readiness, operation)).toThrow(
      ManualGradingRequiredError,
    );
    expect(() => assertFinalizationAllowed(readiness, operation)).toThrow(
      'EN_ATTENTE_CORRECTION_MANUELLE',
    );
  });

  it('allows result calculation only after every manual response is graded', () => {
    const grades: ManualGrade[] = manualItemIds.map((itemId) => ({
      itemId,
      awardedPoints: 1,
      maxPoints: 1,
      reviewedBy: 'teacher-test-id',
      reviewedAt: '2026-07-29T18:00:00.000Z',
    }));
    const readiness = evaluateManualGrading(assessment, grades);

    expect(readiness.workflowStatus).toBe('CORRIGE');
    expect(readiness.pendingManualItemIds).toEqual([]);
    expect(readiness.manuallyGradedItemIds).toEqual(manualItemIds);
    expect(() => assertFinalizationAllowed(readiness, 'FINAL_SCORE')).not.toThrow();
  });

  it('rejects a manual grade for an unknown or automatically scored item', () => {
    const automaticItem = assessment.items.find(
      ({ responseMode }) => responseMode === 'AUTOMATIC_QCM',
    );
    expect(automaticItem).toBeDefined();

    expect(() => evaluateManualGrading(assessment, [{
      itemId: automaticItem!.id,
      awardedPoints: 0,
      maxPoints: 1,
      reviewedBy: 'teacher-test-id',
      reviewedAt: '2026-07-29T18:00:00.000Z',
    }])).toThrow('INVALID_MANUAL_GRADE');
  });
});
