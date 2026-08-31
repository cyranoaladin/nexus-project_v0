import { planConversationTurnBackfill } from '@/scripts/aria/backfill-conversation-turns';

const user = {
  id: 'user-message-private-id',
  conversationId: 'conversation-private-id',
  role: 'user',
  status: 'COMPLETED',
  createdAt: new Date('2026-08-30T10:00:00.000Z'),
  studentId: 'student-private-id',
  actorUserId: 'actor-private-id',
  courseKey: 'eds-maths-premiere',
  contextVersion: 'academic-context-v1',
};

const assistant = {
  ...user,
  id: 'assistant-message-private-id',
  role: 'assistant',
  createdAt: new Date('2026-08-30T10:00:01.000Z'),
};

describe('ARIA conversation-turn backfill planner', () => {
  it('B2_SNAPSHOT_BINDS_MESSAGE_ORDER_ACADEMIC_CONTEXT_AND_INITIAL_SEQUENCE', () => {
    const baseline = planConversationTurnBackfill([user, assistant], new Map([
      [user.conversationId, 4],
    ]));
    const changedContext = planConversationTurnBackfill([
      { ...user, contextVersion: 'academic-context-v2' },
      { ...assistant, contextVersion: 'academic-context-v2' },
    ], new Map([[user.conversationId, 4]]));
    const changedInitialSequence = planConversationTurnBackfill(
      [user, assistant],
      new Map([[user.conversationId, 5]]),
    );

    expect(baseline.report).toMatchObject({
      scannedMessages: 2,
      turnsCreated: 0,
      archivedGroups: 0,
    });
    expect(baseline.groups).toHaveLength(1);
    expect(baseline.groups[0]).toMatchObject({ kind: 'PAIR', sequence: 5 });
    expect(changedContext.report).toMatchObject(baseline.report);
    expect(changedInitialSequence.report).toMatchObject(baseline.report);
    expect(changedContext.sourceDigest).not.toBe(baseline.sourceDigest);
    expect(changedInitialSequence.sourceDigest).not.toBe(baseline.sourceDigest);
    expect(JSON.stringify(baseline.sourceSnapshot)).not.toContain(user.studentId);
    expect(JSON.stringify(baseline.sourceSnapshot)).not.toContain(user.id);
  });

  it('B2_PLAN_DETACHES_MESSAGES_AND_USES_THE_FROZEN_CHRONOLOGICAL_PLAN', () => {
    const mutableUser = { ...user, createdAt: new Date(user.createdAt) };
    const mutableAssistant = { ...assistant, createdAt: new Date(assistant.createdAt) };
    const plan = planConversationTurnBackfill(
      [mutableAssistant, mutableUser],
      new Map([[user.conversationId, 0]]),
    );
    mutableUser.contextVersion = 'mutated-after-plan';
    mutableUser.createdAt.setUTCFullYear(2030);

    expect(plan.groups[0].messages.map(({ role }) => role)).toEqual(['user', 'assistant']);
    expect(plan.groups[0].messages[0]).toMatchObject({
      contextVersion: 'academic-context-v1',
      createdAt: '2026-08-30T10:00:00.000Z',
    });
    expect(Object.isFrozen(plan.groups)).toBe(true);
    expect(Object.isFrozen(plan.groups[0])).toBe(true);
    expect(Object.isFrozen(plan.groups[0].messages)).toBe(true);
    expect(Object.isFrozen(plan.groups[0].messages[0])).toBe(true);
  });

  it('normalizes input order but preserves a semantic ordering change in the digest', () => {
    const unordered = planConversationTurnBackfill(
      [assistant, user],
      new Map([[user.conversationId, 0]]),
    );
    const ordered = planConversationTurnBackfill(
      [user, assistant],
      new Map([[user.conversationId, 0]]),
    );
    const reversedTimestamps = planConversationTurnBackfill([
      { ...user, createdAt: assistant.createdAt },
      { ...assistant, createdAt: user.createdAt },
    ], new Map([[user.conversationId, 0]]));

    expect(unordered.sourceDigest).toBe(ordered.sourceDigest);
    expect(reversedTimestamps.sourceDigest).not.toBe(ordered.sourceDigest);
    expect(reversedTimestamps.report.archivedGroups).toBe(2);
  });
});
