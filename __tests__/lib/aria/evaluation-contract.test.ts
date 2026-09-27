import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import {
  ARIA_CONVERSATION_EVALUATION_SEMANTIC_VALIDATOR_VERSION,
  ariaConversationEvaluationCaseSchema,
  evaluateAriaConversationPolicyFixtures,
  loadAriaConversationEvaluationBundle,
  validateAriaConversationEvaluationJsonStructure,
} from '@/lib/aria/evaluation/contracts';
import { getCourseCapabilities } from '@/lib/aria/curriculum';

function loadEvaluationWithFixtureBytes(overrides: Readonly<Record<string, Buffer | string>>): () => unknown {
  const originalRead = fs.readFileSync;
  let load: (() => unknown) | undefined;
  jest.isolateModules(() => {
    jest.doMock('node:fs', () => ({
      ...jest.requireActual('node:fs'),
      readFileSync: ((path: fs.PathOrFileDescriptor, ...args: unknown[]) => {
        const replacement = Object.entries(overrides).find(([suffix]) => String(path).endsWith(suffix));
        if (replacement) return replacement[1];
        return (originalRead as (...parameters: unknown[]) => unknown)(path, ...args);
      }) as typeof fs.readFileSync,
    }));
    try {
      load = require('@/lib/aria/evaluation/contracts').loadAriaConversationEvaluationBundle;
    } finally {
      jest.dontMock('node:fs');
    }
  });
  return load!;
}

describe('ARIA versioned pedagogical evaluation contract', () => {
  const pedagogicalCaseIds = [
    'P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008', 'P009', 'P010',
    'P011', 'P012', 'P013', 'P014', 'P015', 'P016', 'P017', 'P018', 'P019',
  ] as const;

  it('loads exactly nineteen cases with schema, corpus and review digests bound together', () => {
    const bundle = loadAriaConversationEvaluationBundle();
    expect(bundle.cases.map(({ caseId }) => caseId)).toEqual(
      Array.from({ length: 19 }, (_, index) => `P${String(index + 1).padStart(3, '0')}`),
    );
    expect(bundle.review.reviewStatus).toBe('PENDING_HUMAN_REVIEW');
    expect(bundle.review.semanticValidatorVersion)
      .toBe(ARIA_CONVERSATION_EVALUATION_SEMANTIC_VALIDATOR_VERSION);
    expect(bundle.review.schemaSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(bundle.review.corpusSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a review digest that no longer matches the evaluation corpus', () => {
    const originalRead = fs.readFileSync;
    const read = ((path: fs.PathOrFileDescriptor, ...args: unknown[]) => {
      if (String(path).endsWith('conversation-policy.v1.review.json')) {
        const review = JSON.parse(originalRead(path, 'utf8') as string);
        return JSON.stringify({ ...review, corpusSha256: '0'.repeat(64) });
      }
      return (originalRead as (...parameters: unknown[]) => unknown)(path, ...args);
    }) as typeof fs.readFileSync;
    jest.isolateModules(() => {
      jest.doMock('node:fs', () => ({ ...jest.requireActual('node:fs'), readFileSync: read }));
      try {
        const { loadAriaConversationEvaluationBundle: load } = require('@/lib/aria/evaluation/contracts');
        expect(() => load()).toThrow('ARIA_EVALUATION_DIGEST_MISMATCH');
      } finally {
        jest.dontMock('node:fs');
      }
    });
  });

  it('rejects duplicate case identities even when the review digest is updated', () => {
    const originalRead = fs.readFileSync;
    const originalCorpus = originalRead('data/aria/evaluation/conversation-policy.v1.jsonl', 'utf8') as string;
    const rows = originalCorpus.trimEnd().split('\n');
    const duplicateCorpus = `${rows[0]}\n${rows[0]}\n`;
    const read = ((path: fs.PathOrFileDescriptor, ...args: unknown[]) => {
      if (String(path).endsWith('conversation-policy.v1.jsonl')) return Buffer.from(duplicateCorpus);
      if (String(path).endsWith('conversation-policy.v1.review.json')) {
        const review = JSON.parse(originalRead(path, 'utf8') as string);
        return JSON.stringify({ ...review, corpusSha256: createHash('sha256').update(duplicateCorpus).digest('hex') });
      }
      return (originalRead as (...parameters: unknown[]) => unknown)(path, ...args);
    }) as typeof fs.readFileSync;
    jest.isolateModules(() => {
      jest.doMock('node:fs', () => ({ ...jest.requireActual('node:fs'), readFileSync: read }));
      try {
        const { loadAriaConversationEvaluationBundle: load } = require('@/lib/aria/evaluation/contracts');
        expect(() => load()).toThrow('ARIA_EVALUATION_DUPLICATE_CASE_ID');
      } finally {
        jest.dontMock('node:fs');
      }
    });
  });

  it.each([
    ['an approval with no reviewer', { reviewStatus: 'APPROVED' }, 'approved evaluation requires human review evidence'],
    ['an approval with a reviewer but no review date', { reviewStatus: 'APPROVED', reviewedBy: ['reviewer-1'] }, 'approved evaluation requires human review evidence'],
    ['a pending review claiming a reviewer', { reviewedBy: ['reviewer-1'] }, 'pending evaluation cannot claim review evidence'],
  ])('rejects %s', (_label, changedReview, message) => {
    const review = JSON.parse(fs.readFileSync('data/aria/evaluation/conversation-policy.v1.review.json', 'utf8') as string);
    const load = loadEvaluationWithFixtureBytes({
      'conversation-policy.v1.review.json': JSON.stringify({ ...review, ...changedReview }),
    });
    expect(() => load()).toThrow(message);
  });

  it('rejects a corpus row that violates the bound JSON schema', () => {
    const row = JSON.parse((fs.readFileSync('data/aria/evaluation/conversation-policy.v1.jsonl', 'utf8') as string).split('\n')[0]!);
    const corpus = `${JSON.stringify({ ...row, courseKey: 123 })}\n`;
    const review = JSON.parse(fs.readFileSync('data/aria/evaluation/conversation-policy.v1.review.json', 'utf8') as string);
    const load = loadEvaluationWithFixtureBytes({
      'conversation-policy.v1.jsonl': Buffer.from(corpus),
      'conversation-policy.v1.review.json': JSON.stringify({
        ...review, corpusSha256: createHash('sha256').update(corpus).digest('hex'),
      }),
    });
    expect(() => load()).toThrow('ARIA_EVALUATION_SCHEMA_INVALID:1');
  });

  it('rejects a review that omits an otherwise valid corpus case', () => {
    const review = JSON.parse(fs.readFileSync('data/aria/evaluation/conversation-policy.v1.review.json', 'utf8') as string);
    const load = loadEvaluationWithFixtureBytes({
      'conversation-policy.v1.review.json': JSON.stringify({
        ...review, expectedCaseIds: review.expectedCaseIds.slice(1),
      }),
    });
    expect(() => load()).toThrow('ARIA_EVALUATION_CASE_SET_MISMATCH');
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
        chatPolicy: canonical.chatPolicy,
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

  it('rejects synthetic digest, canonical manifest identity and canonical capability drift', () => {
    const { cases } = loadAriaConversationEvaluationBundle();
    const synthetic = cases.find(({ caseId }) => caseId === 'P003')!;
    const canonicalEvidence = cases.find(({ caseId }) => caseId === 'P006')!;
    const canonicalCapability = cases.find(({ caseId }) => caseId === 'P007')!;
    expect(ariaConversationEvaluationCaseSchema.safeParse({
      ...synthetic,
      retrieval: {
        ...synthetic.retrieval,
        hits: synthetic.retrieval.hits.map((hit) => ({
          ...hit,
          contentSha256: '0'.repeat(64),
        })),
      },
    }).success).toBe(false);
    expect(ariaConversationEvaluationCaseSchema.safeParse({
      ...canonicalEvidence,
      retrieval: {
        ...canonicalEvidence.retrieval,
        hits: canonicalEvidence.retrieval.hits.map((hit) => ({
          ...hit,
          manifestSha256: '0'.repeat(64),
        })),
      },
    }).success).toBe(false);
    expect(ariaConversationEvaluationCaseSchema.safeParse({
      ...canonicalCapability,
      capabilities: { ...canonicalCapability.capabilities, hasChat: true },
    }).success).toBe(false);
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
    ['valid baseline', (candidate: Record<string, unknown>) => candidate, true],
    ['unknown field', (candidate: Record<string, unknown>) => ({ ...candidate, unknown: true }), false],
    ['invalid mode', (candidate: Record<string, unknown>) => ({
      ...candidate, pedagogicalMode: 'UNBOUNDED_AGENT',
    }), false],
    ['success without hits', (candidate: Record<string, unknown>) => ({
      ...candidate, retrieval: { status: 'SUCCESS', hits: [] },
    }), false],
    ['response kind mismatch', (candidate: Record<string, unknown>) => ({
      ...candidate,
      fixture: { ...(candidate.fixture as object), responseKind: 'POLICY_REJECTION' },
    }), false],
    ['citation required but missing', (candidate: Record<string, unknown>) => ({
      ...candidate,
      fixture: { ...(candidate.fixture as object), citations: [] },
    }), false],
  ])('keeps JSON Schema and Zod aligned for representable rule: %s', (_label, mutate, accepted) => {
    const baseline = loadAriaConversationEvaluationBundle().cases.find(
      ({ caseId }) => caseId === 'P006',
    );
    expect(baseline).toBeDefined();
    const candidate = mutate({ ...baseline! });
    expect(validateAriaConversationEvaluationJsonStructure(candidate)).toBe(accepted);
    expect(ariaConversationEvaluationCaseSchema.safeParse(candidate).success).toBe(accepted);
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

  it('reports every deterministic rubric mismatch without hiding synthetic failures', () => {
    const baseline = loadAriaConversationEvaluationBundle().cases.find(
      ({ caseId }) => caseId === 'P006',
    )!;
    const candidate = {
      ...baseline,
      fixture: {
        ...baseline.fixture,
        text: 'Interdit : réponse sans preuve.',
        citations: [],
      },
      expected: {
        ...baseline.expected,
        outcome: 'NO_MODEL',
        retrievalPolicy: 'GENERAL_CHAT',
        answerDisclosure: 'METHOD_FIRST',
        requiredPhrases: ['absent'],
        forbiddenPhrases: ['interdit'],
      },
    } as never;

    expect(evaluateAriaConversationPolicyFixtures([candidate])).toMatchObject({
      passed: 0,
      failed: 1,
      syntheticPolicyPassed: 0,
      syntheticPolicyFailed: 1,
      canonicalRuntimePassed: 0,
      canonicalRuntimeFailed: 0,
      failures: [{
        caseId: 'P006',
        reasons: [
          'outcome:ALLOW_MODEL',
          'retrievalPolicy:GROUNDED_REQUIRED',
          'answerDisclosure:EXPLAIN_WITH_CHECKS',
          'citation:missing',
          'requiredPhrase:absent',
          'forbiddenPhrase:interdit',
        ],
      }],
    });
  });

  it('does not relabel non-RAG policy errors as retrieval failures', () => {
    const baseline = loadAriaConversationEvaluationBundle().cases.find(
      ({ caseId }) => caseId === 'P006',
    )!;
    expect(() => evaluateAriaConversationPolicyFixtures([{
      ...baseline,
      agentRole: 'UNSUPPORTED_ROLE',
    } as never])).toThrow('Ce rôle ARIA n’est pas disponible pour cette tâche.');
  });
});
