import {
  decideAriaRetrievalOutcome,
  isAriaRagStatus,
  resolveAriaRetrievalPolicy,
} from '@/lib/aria/domain/retrieval/policy';

const groundedCapabilities = {
  hasChat: true,
  hasRagCorpus: true,
  generalChatAllowed: false,
  chatPolicy: 'GROUNDED_REQUIRED' as const,
};

const optionalCapabilities = {
  ...groundedCapabilities,
  chatPolicy: 'OPTIONAL_GROUNDING' as const,
};

it('validates only canonical persisted RAG states at runtime', () => {
  expect([
    'NOT_CONFIGURED', 'NO_RESULTS', 'RUNTIME_UNAVAILABLE', 'SUCCESS',
  ].every(isAriaRagStatus)).toBe(true);
  expect(isAriaRagStatus('PRIVATE_PROVIDER_DETAIL')).toBe(false);
  expect(isAriaRagStatus(null)).toBe(false);
});

describe('ARIA multi-dimensional retrieval policy', () => {
  it('rejects an unknown course before resolving any model or grounding policy', () => {
    expect(() => resolveAriaRetrievalPolicy({
      task: 'DISCOVERY',
      courseKey: 'unknown-course',
      agentRole: 'TUTOR',
      visibility: 'STUDENT_PRIVATE',
      capabilities: groundedCapabilities,
    })).toThrow(expect.objectContaining({ code: 'COURSE_NOT_FOUND' }));
  });

  it('U041 returns NO_MODEL before retrieval when chat is unavailable', () => {
    expect(resolveAriaRetrievalPolicy({
      task: 'DISCOVERY',
      courseKey: 'stmg-sgn-premiere',
      agentRole: 'TUTOR',
      visibility: 'STUDENT_PRIVATE',
      capabilities: {
        hasChat: false, hasRagCorpus: false, chatPolicy: null, generalChatAllowed: false,
      },
    }).kind).toBe('NO_MODEL');
  });

  it('U040 ARIA-B-R038 requires the exact requested resource version over general course grounding', () => {
    const policy = resolveAriaRetrievalPolicy({
      task: 'WORKED_EXAMPLE',
      courseKey: 'eds-maths-premiere',
      agentRole: 'TUTOR',
      visibility: 'STUDENT_PRIVATE',
      capabilities: groundedCapabilities,
      requestedResource: {
        resourceId: 'resource-1',
        resourceVersionId: 'resource-1@sha256:abc',
      },
    });
    expect(policy).toMatchObject({
      kind: 'RESOURCE_GROUNDED_REQUIRED',
      requestedResource: {
        resourceId: 'resource-1',
        resourceVersionId: 'resource-1@sha256:abc',
      },
    });
  });

  it.each([
    ['METHODOLOGY', 'GROUNDED_REQUIRED'],
    ['GUIDED_PRACTICE', 'GROUNDED_REQUIRED'],
    ['WORKED_EXAMPLE', 'GROUNDED_REQUIRED'],
  ] as const)('resolves %s to %s with the same Tutor role', (task, expected) => {
    expect(resolveAriaRetrievalPolicy({
      task,
      courseKey: 'eds-maths-premiere',
      agentRole: 'TUTOR',
      visibility: 'STUDENT_PRIVATE',
      capabilities: groundedCapabilities,
    }).kind).toBe(expected);
  });

  it('U039 ARIA-B-R037 allows GENERAL_CHAT only through an explicit no-corpus capability', () => {
    expect(resolveAriaRetrievalPolicy({
      task: 'DISCOVERY',
      courseKey: 'eds-maths-premiere',
      agentRole: 'TUTOR',
      visibility: 'STUDENT_PRIVATE',
      capabilities: {
        hasChat: true, hasRagCorpus: false,
        chatPolicy: 'GENERAL_CHAT', generalChatAllowed: true,
      },
    }).kind).toBe('GENERAL_CHAT');
  });

  it('requires grounding fail-closed when chat exists without a corpus or explicit general-chat capability', () => {
    expect(resolveAriaRetrievalPolicy({
      task: 'DISCOVERY',
      courseKey: 'eds-maths-premiere',
      agentRole: 'TUTOR',
      visibility: 'STUDENT_PRIVATE',
      capabilities: {
        hasChat: true, hasRagCorpus: false,
        chatPolicy: 'GROUNDED_REQUIRED', generalChatAllowed: false,
      },
    })).toMatchObject({
      kind: 'GROUNDED_REQUIRED',
      reasonCode: 'MISSING_CORPUS_MUST_FAIL_CLOSED',
    });
  });

  it.each([
    [true, 'COURSE_TASK_REQUIRES_PROVEN_CORPUS'],
    [false, 'MISSING_CORPUS_MUST_FAIL_CLOSED'],
  ] as const)(
    'resolves a null chat policy from explicit corpus evidence=%s',
    (hasRagCorpus, reasonCode) => {
      expect(resolveAriaRetrievalPolicy({
        task: 'DISCOVERY',
        courseKey: 'eds-maths-premiere',
        agentRole: 'TUTOR',
        visibility: 'STUDENT_PRIVATE',
        capabilities: {
          hasChat: true,
          hasRagCorpus,
          chatPolicy: null,
          generalChatAllowed: false,
        },
      })).toMatchObject({ kind: 'GROUNDED_REQUIRED', reasonCode });
    },
  );

  it('keeps SUCCESS, NO_RESULTS, NOT_CONFIGURED and RUNTIME_UNAVAILABLE distinct', () => {
    const optional = resolveAriaRetrievalPolicy({
      task: 'METHODOLOGY',
      courseKey: 'eds-maths-premiere',
      agentRole: 'TUTOR',
      visibility: 'STUDENT_PRIVATE',
      capabilities: optionalCapabilities,
    });
    expect(decideAriaRetrievalOutcome(optional, { status: 'SUCCESS', hits: [] })).toMatchObject({
      ragStatus: 'SUCCESS',
      allowModel: true,
      grounded: true,
    });
    expect(decideAriaRetrievalOutcome(optional, { status: 'NO_RESULTS' })).toMatchObject({
      ragStatus: 'NO_RESULTS',
      allowModel: true,
      grounded: false,
    });
    expect(decideAriaRetrievalOutcome(optional, { status: 'NOT_CONFIGURED' })).toMatchObject({
      ragStatus: 'NOT_CONFIGURED',
      allowModel: true,
      grounded: false,
    });
    expect(decideAriaRetrievalOutcome(optional, { status: 'RUNTIME_UNAVAILABLE' })).toMatchObject({
      ragStatus: 'RUNTIME_UNAVAILABLE',
      allowModel: true,
      grounded: false,
      downgradeReason: 'RUNTIME_UNAVAILABLE_POLICY_AUTHORIZED',
    });
  });

  it.each(['NO_RESULTS', 'NOT_CONFIGURED', 'RUNTIME_UNAVAILABLE'] as const)(
    'fails closed for required grounding on %s',
    (status) => {
      const required = resolveAriaRetrievalPolicy({
        task: 'GUIDED_PRACTICE',
        courseKey: 'eds-maths-premiere',
        agentRole: 'TUTOR',
        visibility: 'STUDENT_PRIVATE',
        capabilities: groundedCapabilities,
      });
      expect(() => decideAriaRetrievalOutcome(required, { status })).toThrow(
        expect.objectContaining({ code: 'RAG_UNAVAILABLE' }),
      );
    },
  );

  it('rejects a resource-grounded SUCCESS without the exact canonical version', () => {
    const required = resolveAriaRetrievalPolicy({
      task: 'WORKED_EXAMPLE',
      courseKey: 'eds-maths-premiere',
      agentRole: 'TUTOR',
      visibility: 'STUDENT_PRIVATE',
      capabilities: groundedCapabilities,
      requestedResource: { resourceId: 'resource-1', resourceVersionId: 'version-1' },
    });
    expect(() => decideAriaRetrievalOutcome(required, {
      status: 'SUCCESS',
      hits: [{ resourceId: 'resource-1', resourceVersionId: 'version-2' }],
    })).toThrow(expect.objectContaining({ code: 'RAG_UNAVAILABLE' }));
    expect(decideAriaRetrievalOutcome(required, {
      status: 'SUCCESS',
      hits: [{ resourceId: 'resource-1', resourceVersionId: 'version-1' }],
    })).toMatchObject({ allowModel: true, grounded: true });
  });

  it('uses visibility and agent capability as fail-closed inputs', () => {
    const noModel = resolveAriaRetrievalPolicy({
      task: 'DISCOVERY',
      courseKey: 'eds-maths-premiere',
      agentRole: 'TUTOR',
      visibility: 'SYSTEM_ONLY',
      capabilities: groundedCapabilities,
    });
    expect(noModel.kind).toBe('NO_MODEL');
    expect(decideAriaRetrievalOutcome(noModel, { status: 'NOT_CONFIGURED' }))
      .toEqual({ ragStatus: 'NOT_CONFIGURED', allowModel: false, grounded: false });

    const generalChat = resolveAriaRetrievalPolicy({
      task: 'DISCOVERY',
      courseKey: 'eds-maths-premiere',
      agentRole: 'TUTOR',
      visibility: 'STUDENT_PRIVATE',
      capabilities: {
        hasChat: true, hasRagCorpus: false,
        chatPolicy: 'GENERAL_CHAT', generalChatAllowed: true,
      },
    });
    expect(decideAriaRetrievalOutcome(generalChat, { status: 'NOT_CONFIGURED' }))
      .toEqual({ ragStatus: 'NOT_CONFIGURED', allowModel: true, grounded: false });
    expect(() => resolveAriaRetrievalPolicy({
      task: 'DISCOVERY',
      courseKey: 'eds-maths-premiere',
      agentRole: 'PLANNER',
      visibility: 'STUDENT_PRIVATE',
      capabilities: groundedCapabilities,
    })).toThrow(expect.objectContaining({ code: 'UNSUPPORTED' }));
  });
});
