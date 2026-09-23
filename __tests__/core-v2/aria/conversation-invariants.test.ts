import { setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();
const FINGERPRINT = 'a'.repeat(64);

async function seedConversationGraph() {
  const year = await h.client.academicYear.create({
    data: {
      startYear: 2026,
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      endsAt: new Date('2027-07-15T00:00:00.000Z'),
      status: 'CURRENT',
    },
  });
  const household = await h.client.household.create({ data: {} });
  const userA = await h.client.user.create({ data: { role: 'ELEVE', email: 'conversation-a@synthetic.test', accountStatus: 'ACTIVE' } });
  const userB = await h.client.user.create({ data: { role: 'ELEVE', email: 'conversation-b@synthetic.test', accountStatus: 'ACTIVE' } });
  const studentA = await h.client.student.create({ data: { userId: userA.id, householdId: household.id } });
  const householdB = await h.client.household.create({ data: {} });
  const studentB = await h.client.student.create({ data: { userId: userB.id, householdId: householdB.id } });
  await h.client.studentAcademicYearEnrollment.create({
    data: { studentId: studentA.id, academicYearId: year.id, status: 'ACTIVE', gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE' },
  });
  await h.client.studentAcademicYearEnrollment.create({
    data: { studentId: studentB.id, academicYearId: year.id, status: 'ACTIVE', gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE' },
  });
  const conversationA = await h.client.ariaConversationCoreV2.create({
    data: { studentId: studentA.id, courseKey: 'philosophie-terminale' },
  });
  const conversationB = await h.client.ariaConversationCoreV2.create({
    data: { studentId: studentA.id, courseKey: 'philosophie-terminale' },
  });
  return { userA, studentA, studentB, conversationA, conversationB };
}

function pendingTurnData(input: { conversationId: string; subjectStudentId: string; actorUserId: string; clientRequestId: string; sequence: number }) {
  return {
    ...input,
    useCase: 'CONVERSATION' as const,
    requestFingerprint: FINGERPRINT,
    sequence: input.sequence,
    academicSnapshot: {},
    pedagogicalMode: 'DISCOVERY',
    agentRole: 'TUTOR',
    modelPolicy: {},
  };
}

describe('Core v2 conversation database invariants', () => {
  test('rejects a turn whose subject does not own the conversation', async () => {
    const { userA, studentB, conversationA } = await seedConversationGraph();

    await expect(h.client.ariaConversationTurnCoreV2.create({
      data: pendingTurnData({
        conversationId: conversationA.id,
        subjectStudentId: studentB.id,
        actorUserId: userA.id,
        clientRequestId: 'cross-subject',
        sequence: 1,
      }),
    })).rejects.toMatchObject({ code: 'P2003' });
  });

  test('rejects a message whose turn belongs to another conversation', async () => {
    const { userA, studentA, conversationA, conversationB } = await seedConversationGraph();
    const turn = await h.client.ariaConversationTurnCoreV2.create({
      data: pendingTurnData({
        conversationId: conversationA.id,
        subjectStudentId: studentA.id,
        actorUserId: userA.id,
        clientRequestId: 'turn-a',
        sequence: 1,
      }),
    });

    await expect(h.client.ariaMessageCoreV2.create({
      data: {
        conversationId: conversationB.id,
        turnId: turn.id,
        role: 'USER',
        turnRole: 'USER',
        content: 'cross conversation',
      },
    })).rejects.toMatchObject({ code: 'P2003' });
  });

  test('the partial unique index allows at most one active turn under a race', async () => {
    const { userA, studentA, conversationA } = await seedConversationGraph();
    const attempts = await Promise.allSettled([
      h.client.ariaConversationTurnCoreV2.create({
        data: pendingTurnData({ conversationId: conversationA.id, subjectStudentId: studentA.id, actorUserId: userA.id, clientRequestId: 'race-a', sequence: 1 }),
      }),
      h.client.ariaConversationTurnCoreV2.create({
        data: pendingTurnData({ conversationId: conversationA.id, subjectStudentId: studentA.id, actorUserId: userA.id, clientRequestId: 'race-b', sequence: 2 }),
      }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(await h.client.ariaConversationTurnCoreV2.count({ where: { conversationId: conversationA.id } })).toBe(1);
  });

  test('enforces turn state shape, legal transitions and terminal immutability', async () => {
    const { userA, studentA, conversationA } = await seedConversationGraph();

    await expect(h.client.ariaConversationTurnCoreV2.create({
      data: {
        ...pendingTurnData({ conversationId: conversationA.id, subjectStudentId: studentA.id, actorUserId: userA.id, clientRequestId: 'bad-fingerprint', sequence: 1 }),
        requestFingerprint: 'b'.repeat(63),
      },
    })).rejects.toThrow();
    await expect(h.client.ariaConversationTurnCoreV2.create({
      data: pendingTurnData({ conversationId: conversationA.id, subjectStudentId: studentA.id, actorUserId: userA.id, clientRequestId: 'bad-sequence', sequence: 0 }),
    })).rejects.toThrow();

    const turn = await h.client.ariaConversationTurnCoreV2.create({
      data: pendingTurnData({ conversationId: conversationA.id, subjectStudentId: studentA.id, actorUserId: userA.id, clientRequestId: 'lifecycle', sequence: 1 }),
    });

    await expect(h.client.ariaConversationTurnCoreV2.update({
      where: { id: turn.id },
      data: { status: 'COMPLETED' },
    })).rejects.toThrow();

    await h.client.ariaConversationTurnCoreV2.update({
      where: { id: turn.id },
      data: {
        status: 'RUNNING',
        executionToken: 'execution-token',
        heartbeatAt: new Date('2026-09-23T12:00:00.000Z'),
        leaseExpiresAt: new Date('2026-09-23T12:01:00.000Z'),
        startedAt: new Date('2026-09-23T12:00:00.000Z'),
      },
    });

    await expect(h.client.ariaConversationTurnCoreV2.update({
      where: { id: turn.id },
      data: { status: 'PENDING' },
    })).rejects.toThrow('ARIA_CORE_V2_TURN_STATUS_TRANSITION_FORBIDDEN');

    await h.client.ariaConversationTurnCoreV2.update({
      where: { id: turn.id },
      data: { status: 'COMPLETED', completedAt: new Date('2026-09-23T12:02:00.000Z') },
    });
    await expect(h.client.ariaConversationTurnCoreV2.update({
      where: { id: turn.id },
      data: { status: 'RUNNING' },
    })).rejects.toThrow('ARIA_CORE_V2_TURN_STATUS_TRANSITION_FORBIDDEN');
  });

  test('audits cancellation actor and rejects a partial cancellation pair', async () => {
    const { userA, studentA, conversationA } = await seedConversationGraph();
    await expect(h.client.ariaConversationTurnCoreV2.create({
      data: {
        ...pendingTurnData({ conversationId: conversationA.id, subjectStudentId: studentA.id, actorUserId: userA.id, clientRequestId: 'partial-cancel', sequence: 1 }),
        cancellationRequestedAt: new Date('2026-09-23T12:00:00.000Z'),
      },
    })).rejects.toThrow();

    const cancelled = await h.client.ariaConversationTurnCoreV2.create({
      data: {
        ...pendingTurnData({ conversationId: conversationA.id, subjectStudentId: studentA.id, actorUserId: userA.id, clientRequestId: 'audited-cancel', sequence: 1 }),
        status: 'CANCELLED',
        completedAt: new Date('2026-09-23T12:00:00.000Z'),
        cancellationRequestedAt: new Date('2026-09-23T12:00:00.000Z'),
        cancellationRequestedByActorId: userA.id,
      },
    });
    expect(cancelled.cancellationRequestedByActorId).toBe(userA.id);
  });

  test('keeps message semantics and citation provenance atomic', async () => {
    const { userA, studentA, conversationA } = await seedConversationGraph();
    const turn = await h.client.ariaConversationTurnCoreV2.create({
      data: pendingTurnData({ conversationId: conversationA.id, subjectStudentId: studentA.id, actorUserId: userA.id, clientRequestId: 'message-semantics', sequence: 1 }),
    });

    await expect(h.client.ariaMessageCoreV2.create({
      data: { conversationId: conversationA.id, turnId: turn.id, role: 'USER', content: 'missing role' },
    })).rejects.toThrow();
    await expect(h.client.ariaMessageCoreV2.create({
      data: { conversationId: conversationA.id, turnId: turn.id, role: 'ASSISTANT', turnRole: 'USER', content: 'wrong role' },
    })).rejects.toThrow();

    const message = await h.client.ariaMessageCoreV2.create({
      data: { conversationId: conversationA.id, turnId: turn.id, role: 'USER', turnRole: 'USER', content: 'valid user message' },
    });
    await expect(h.client.ariaMessageCitationCoreV2.create({
      data: {
        messageId: message.id,
        sourceTitle: 'Source',
        sourceDocument: 'Document',
        courseKey: 'philosophie-terminale',
        provenance: 'NEXUS_METHOD',
        resourceId: 'resource-only',
      },
    })).rejects.toThrow();

    const citation = await h.client.ariaMessageCitationCoreV2.create({
      data: {
        messageId: message.id,
        sourceTitle: 'Source',
        sourceDocument: 'Document',
        courseKey: 'philosophie-terminale',
        provenance: 'NEXUS_METHOD',
        resourceId: 'resource-1',
        resourceVersionId: 'resource-version-1',
        contentSha256: FINGERPRINT,
        chunkId: 'chunk-1',
        locator: { page: 1 },
        corpusId: 'corpus-1',
        corpusVersionId: 'corpus-version-1',
        manifestSha256: FINGERPRINT,
      },
    });
    expect(citation.contentSha256).toBe(FINGERPRINT);

    const feedback = await h.client.ariaFeedbackCoreV2.create({
      data: { messageId: message.id, studentId: studentA.id, useful: true },
    });
    await expect(h.client.ariaFeedbackCoreV2.create({
      data: { messageId: message.id, studentId: studentA.id, useful: false },
    })).rejects.toThrow();
    const updated = await h.client.ariaFeedbackCoreV2.update({ where: { id: feedback.id }, data: { useful: false } });
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(feedback.updatedAt.getTime());
  });
});
