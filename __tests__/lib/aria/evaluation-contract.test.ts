import {
  evaluateAriaConversationPolicyFixtures,
  loadAriaConversationEvaluationBundle,
} from '@/lib/aria/evaluation/contracts';

describe('ARIA versioned pedagogical evaluation contract', () => {
  const pedagogicalCaseIds = [
    'P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008', 'P009', 'P010',
    'P011', 'P012', 'P013', 'P014', 'P015', 'P016', 'P017', 'P018', 'P019',
  ] as const;

  it('loads exactly P001-P019 with schema, corpus and review digests bound together', () => {
    const bundle = loadAriaConversationEvaluationBundle();
    expect(bundle.cases.map(({ caseId }) => caseId)).toEqual(
      Array.from({ length: 19 }, (_, index) => `P${String(index + 1).padStart(3, '0')}`),
    );
    expect(bundle.review.reviewStatus).toBe('PENDING_HUMAN_REVIEW');
    expect(bundle.review.schemaSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(bundle.review.corpusSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('proves fixture policy wiring without claiming real-model pedagogical quality', () => {
    const report = evaluateAriaConversationPolicyFixtures(
      loadAriaConversationEvaluationBundle().cases,
    );
    expect(report).toMatchObject({ mode: 'FIXTURE', passed: 19, failed: 0 });
    expect(report).not.toHaveProperty('pedagogicalModelQuality', 'PASS');
  });

  it('keeps task policies distinct, citations grounded and STMG free of SES approximation', () => {
    const { cases } = loadAriaConversationEvaluationBundle();
    const byId = new Map(cases.map((item) => [item.caseId, item]));
    expect(byId.get('P001')?.expected.answerDisclosure).not.toBe(
      byId.get('P008')?.expected.answerDisclosure,
    );
    expect(byId.get('P006')?.expected.citationRequired).toBe(true);
    expect(JSON.stringify(byId.get('P007'))).not.toMatch(/\bSES\b/i);
    expect(byId.get('P018')?.expected.outcome).toBe('BLOCKED_ACADEMIC_CONTEXT');
    expect(byId.get('P019')?.expected.outcome).toBe('BLOCKED_ACADEMIC_CONTEXT');
  });

  it.each(pedagogicalCaseIds)('%s passes its deterministic policy rubric', (caseId) => {
    const evaluationCase = loadAriaConversationEvaluationBundle().cases.find(
      (candidate) => candidate.caseId === caseId,
    );
    expect(evaluationCase).toBeDefined();
    expect(evaluateAriaConversationPolicyFixtures([evaluationCase!])).toMatchObject({
      mode: 'FIXTURE',
      passed: 1,
      failed: 0,
      failures: [],
    });
  });
});
