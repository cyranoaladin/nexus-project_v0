import { createHash } from 'node:crypto';
import {
  ariaConversationEvaluationCaseSchema,
  evaluateAriaConversationPolicyFixtures,
  loadAriaConversationEvaluationBundle,
} from '@/lib/aria/evaluation/contracts';
import { getCourseCapabilities } from '@/lib/aria/curriculum';

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
    expect(report).toMatchObject({
      mode: 'FIXTURE', passed: 19, failed: 0,
      syntheticPolicyPassed: 16,
      syntheticPolicyFailed: 0,
      canonicalRuntimePassed: 3,
      canonicalRuntimeFailed: 0,
      productionQualification: 'NOT_EVALUATED',
    });
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

  it('labels synthetic policy capabilities and binds canonical cases to runtime truth', () => {
    const { cases } = loadAriaConversationEvaluationBundle();
    const synthetic: string[] = [];
    for (const evaluationCase of cases) {
      const capabilitySource = (evaluationCase as typeof evaluationCase & {
        capabilitySource?: 'CANONICAL_RUNTIME' | 'SYNTHETIC_POLICY_CASE';
      }).capabilitySource;
      if (capabilitySource === 'SYNTHETIC_POLICY_CASE') {
        synthetic.push(evaluationCase.caseId);
        continue;
      }
      expect(capabilitySource).toBe('CANONICAL_RUNTIME');
      const canonical = getCourseCapabilities(evaluationCase.courseKey);
      expect(evaluationCase.capabilities).toEqual({
        hasChat: canonical.hasChat,
        hasRagCorpus: canonical.hasRagCorpus,
        generalChatAllowed: canonical.generalChatAllowed,
      });
    }
    expect(synthetic).toEqual([
      'P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P008', 'P009', 'P010',
      'P011', 'P012', 'P013', 'P014', 'P015', 'P016', 'P017',
    ]);
  });

  it('binds every fixture citation to an exact retrieved resource version', () => {
    for (const evaluationCase of loadAriaConversationEvaluationBundle().cases) {
      const fixture = evaluationCase.fixture as typeof evaluationCase.fixture & {
        citations?: readonly { resourceId: string; resourceVersionId: string }[];
        citationCount?: number;
      };
      expect(fixture).not.toHaveProperty('citationCount');
      expect(fixture.citations).toBeDefined();
      for (const citation of fixture.citations ?? []) {
        expect(evaluationCase.retrieval.hits).toContainEqual(expect.objectContaining(citation));
      }
    }
  });

  it('binds retrieval evidence to a canonical manifest or immutable synthetic content', () => {
    for (const evaluationCase of loadAriaConversationEvaluationBundle().cases) {
      for (const rawHit of evaluationCase.retrieval.hits) {
        const hit = rawHit as typeof rawHit & {
          evidenceSource?: 'CANONICAL_RAG_FIXTURE' | 'SYNTHETIC_EVALUATION_FIXTURE';
          contentSha256?: string;
          chunkId?: string;
          manifestSha256?: string | null;
          corpusId?: string | null;
          corpusVersionId?: string | null;
          fixtureContent?: string;
        };
        expect(hit.contentSha256).toMatch(/^[0-9a-f]{64}$/);
        expect(hit.chunkId).toBeTruthy();
        if (hit.evidenceSource === 'CANONICAL_RAG_FIXTURE') {
          expect(hit.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
          expect(hit.corpusId).toBeTruthy();
          expect(hit.corpusVersionId).toBeTruthy();
          expect(hit.fixtureContent).toBeUndefined();
        } else {
          expect(hit.evidenceSource).toBe('SYNTHETIC_EVALUATION_FIXTURE');
          expect(hit.manifestSha256).toBeNull();
          expect(hit.corpusId).toBeNull();
          expect(hit.corpusVersionId).toBeNull();
          expect(createHash('sha256').update(hit.fixtureContent ?? '').digest('hex'))
            .toBe(hit.contentSha256);
        }
      }
    }
  });

  it('derives citation requirements from the resolved grounding policy', () => {
    const baseline = loadAriaConversationEvaluationBundle().cases.find(
      ({ caseId }) => caseId === 'P006',
    );
    expect(baseline).toBeDefined();
    const candidate = {
      ...baseline!,
      fixture: { ...baseline!.fixture, citations: [] },
      expected: { ...baseline!.expected, citationRequired: false },
    };

    expect(ariaConversationEvaluationCaseSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    ['unknown course', (candidate: Record<string, unknown>) => ({
      ...candidate, courseKey: 'unknown-course',
    })],
    ['course/grade mismatch', (candidate: Record<string, unknown>) => ({
      ...candidate, gradeLevel: 'PREMIERE',
    })],
    ['SUCCESS without hits', (candidate: Record<string, unknown>) => ({
      ...candidate, retrieval: { status: 'SUCCESS', hits: [] },
    })],
    ['non-success with hits', (candidate: Record<string, unknown>) => ({
      ...candidate, retrieval: candidate.retrieval && {
        status: 'NO_RESULTS', hits: (candidate.retrieval as { hits: unknown }).hits,
      },
    })],
    ['model outcome with policy rejection fixture', (candidate: Record<string, unknown>) => ({
      ...candidate,
      fixture: { ...(candidate.fixture as object), responseKind: 'POLICY_REJECTION' },
    })],
  ])('rejects incoherent evaluation state: %s', (_label, mutate) => {
    const baseline = loadAriaConversationEvaluationBundle().cases.find(
      ({ caseId }) => caseId === 'P006',
    );
    expect(baseline).toBeDefined();
    expect(ariaConversationEvaluationCaseSchema.safeParse(
      mutate({ ...baseline! }),
    ).success).toBe(false);
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
