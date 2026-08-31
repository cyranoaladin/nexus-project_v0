import {
  parseConversationTurnMessageAuditBeforeImage,
  parseConversationTurnTargetKey,
  planConversationTurnBackfill,
  validateCompletedTurnEvidence,
} from '@/scripts/aria/backfill-conversation-turns';
import { stableLegacyFingerprint } from '@/scripts/aria/audit-legacy-data';

const user = {
  id: 'user-message-private-id',
  conversationId: 'conversation-private-id',
  role: 'user',
  status: 'COMPLETED',
  createdAt: new Date('2026-08-30T10:00:00.000Z'),
  studentId: 'student-private-id',
  actorUserId: 'actor-private-id',
  courseKey: 'eds-maths-premiere',
  contextState: 'ACTIVE',
  contextVersion: 'academic-context-v1',
};

const assistant = {
  ...user,
  id: 'assistant-message-private-id',
  role: 'assistant',
  createdAt: new Date('2026-08-30T10:00:01.000Z'),
};

describe('ARIA conversation-turn backfill planner', () => {
  it('U019 B2_AMBIGUOUS_LEGACY_GROUPS_REQUIRE_MANUAL_REVIEW', () => {
    const sameTimestamp = new Date('2026-08-30T10:00:00.000Z');
    const plan = planConversationTurnBackfill([
      { ...user, id: 'equal-user', createdAt: sameTimestamp },
      { ...assistant, id: 'equal-assistant', createdAt: sameTimestamp },
    ], new Map([[user.conversationId, 0]]));

    expect(plan.report).toMatchObject({
      scannedMessages: 2,
      deterministicGroups: 0,
      archivedGroups: 0,
      manualReviewGroups: 2,
    });
    expect(plan.groups).toHaveLength(2);
    expect(plan.groups.every(({ kind, messages }) =>
      kind === 'MANUAL' && messages.length === 1)).toBe(true);
    expect(plan.groups[0].clusterId).toMatch(/^[0-9a-f]{64}$/);
    expect(plan.groups[1].clusterId).toBe(plan.groups[0].clusterId);
  });

  it('B2_KNOWN_NON_RESUMABLE_MESSAGES_REMAIN_ARCHIVED', () => {
    const rows = [
      { ...user, id: 'pending-user', conversationId: 'conv-pending', status: 'PENDING' },
      { ...assistant, id: 'streaming-assistant', conversationId: 'conv-streaming', status: 'STREAMING' },
      { ...user, id: 'system-message', conversationId: 'conv-system', role: 'system' },
      { ...assistant, id: 'isolated-orphan', conversationId: 'conv-orphan' },
    ];
    const plan = planConversationTurnBackfill(rows, new Map());

    expect(plan.report).toMatchObject({
      scannedMessages: 4,
      deterministicGroups: 0,
      archivedGroups: 4,
      manualReviewGroups: 0,
    });
    expect(plan.groups.every(({ kind }) => kind === 'ARCHIVE')).toBe(true);
  });

  it('B2_UNKNOWN_ROLE_OR_STATUS_REQUIRES_MANUAL_REVIEW', () => {
    const plan = planConversationTurnBackfill([
      { ...user, id: 'unknown-role', conversationId: 'conv-unknown-role', role: 'tool' },
      { ...assistant, id: 'unknown-status', conversationId: 'conv-unknown-status', status: 'LOST' },
    ], new Map());

    expect(plan.report).toMatchObject({
      scannedMessages: 2,
      deterministicGroups: 0,
      archivedGroups: 0,
      manualReviewGroups: 2,
    });
    expect(plan.groups.every(({ kind }) => kind === 'MANUAL')).toBe(true);
  });

  it('B2_UUA_AND_UAA_CLUSTERS_ARE_MANUAL_SINGLETON_AUDITS', () => {
    const rows = [
      { ...user, id: 'uua-user-1', conversationId: 'conv-uua' },
      { ...user, id: 'uua-user-2', conversationId: 'conv-uua', createdAt: '2026-08-30T10:00:01.000Z' },
      { ...assistant, id: 'uua-assistant', conversationId: 'conv-uua', createdAt: '2026-08-30T10:00:02.000Z' },
      { ...user, id: 'uaa-user', conversationId: 'conv-uaa' },
      { ...assistant, id: 'uaa-assistant-1', conversationId: 'conv-uaa', createdAt: '2026-08-30T10:00:01.000Z' },
      { ...assistant, id: 'uaa-assistant-2', conversationId: 'conv-uaa', createdAt: '2026-08-30T10:00:02.000Z' },
    ];
    const plan = planConversationTurnBackfill(rows, new Map());

    expect(plan.report).toMatchObject({
      scannedMessages: 6,
      deterministicGroups: 0,
      archivedGroups: 0,
      manualReviewGroups: 6,
    });
    expect(plan.groups.every(({ kind, messages }) =>
      kind === 'MANUAL' && messages.length === 1)).toBe(true);
    expect(new Set(plan.groups.slice(0, 3).map(({ clusterId }) => clusterId)).size).toBe(1);
    expect(new Set(plan.groups.slice(3).map(({ clusterId }) => clusterId)).size).toBe(1);
  });

  it('B2_STRICT_PAIRS_REMAIN_DETERMINISTIC_WITH_STABLE_SEQUENCE', () => {
    const rows = [
      user,
      assistant,
      { ...user, id: 'user-message-2', createdAt: '2026-08-30T10:00:02.000Z' },
      { ...assistant, id: 'assistant-message-2', createdAt: '2026-08-30T10:00:03.000Z' },
    ];
    const first = planConversationTurnBackfill(rows, new Map([[user.conversationId, 4]]));
    const replay = planConversationTurnBackfill([...rows].reverse(), new Map([[user.conversationId, 4]]));

    expect(first.report).toMatchObject({
      scannedMessages: 4,
      deterministicGroups: 2,
      archivedGroups: 0,
      manualReviewGroups: 0,
    });
    expect(first.groups.map(({ kind, sequence }) => ({ kind, sequence }))).toEqual([
      { kind: 'PAIR', sequence: 5 },
      { kind: 'PAIR', sequence: 6 },
    ]);
    expect(replay.sourceDigest).toBe(first.sourceDigest);
  });

  it('B2_UNRESOLVED_CONTEXT_MESSAGES_ARE_ALL_EXPLICITLY_ARCHIVED', () => {
    const plan = planConversationTurnBackfill([
      { ...user, courseKey: null, contextState: 'LEGACY_CONTEXT_UNRESOLVED' },
      { ...assistant, courseKey: null, contextState: 'LEGACY_CONTEXT_UNRESOLVED' },
    ], new Map());

    expect(plan.report).toMatchObject({
      scannedMessages: 2,
      deterministicGroups: 0,
      archivedGroups: 2,
      manualReviewGroups: 0,
    });
    expect(plan.groups.map(({ kind, reason }) => ({ kind, reason }))).toEqual([
      { kind: 'ARCHIVE', reason: 'CONTEXT_UNRESOLVED' },
      { kind: 'ARCHIVE', reason: 'CONTEXT_UNRESOLVED' },
    ]);
  });

  it('B2_CANCELLED_AND_ERROR_ASSISTANT_PAIRS_PRESERVE_EXACT_TERMINAL_STATE', () => {
    const plan = planConversationTurnBackfill([
      { ...user, conversationId: 'conv-cancelled' },
      { ...assistant, conversationId: 'conv-cancelled', status: 'CANCELLED' },
      { ...user, conversationId: 'conv-error' },
      { ...assistant, conversationId: 'conv-error', status: 'ERROR' },
    ], new Map());

    expect(plan.report).toMatchObject({ deterministicGroups: 2, archivedGroups: 0 });
    expect(plan.groups.map(({ kind, reason, targetStatus }) => ({
      kind, reason, targetStatus,
    }))).toEqual([
      { kind: 'PAIR', reason: 'PAIR_CANCELLED', targetStatus: 'CANCELLED' },
      { kind: 'PAIR', reason: 'PAIR_ERROR', targetStatus: 'ERROR' },
    ]);
  });

  it('B2_LEADING_ASSISTANT_IS_ARCHIVED_BEFORE_A_STRICT_PAIR', () => {
    const plan = planConversationTurnBackfill([
      { ...assistant, id: 'leading-assistant', createdAt: '2026-08-30T09:59:59.000Z' },
      user,
      assistant,
    ], new Map());

    expect(plan.groups.map(({ kind, reason }) => ({ kind, reason }))).toEqual([
      { kind: 'ARCHIVE', reason: 'ORPHAN_ASSISTANT' },
      { kind: 'PAIR', reason: 'PAIR_COMPLETED' },
    ]);
  });

  it('B2_EVERY_MESSAGE_IS_COVERED_EXACTLY_ONCE', () => {
    const rows = [
      { ...assistant, id: 'coverage-leading', createdAt: '2026-08-30T09:59:59.000Z' },
      user,
      assistant,
      { ...user, id: 'coverage-manual-user-1', conversationId: 'coverage-manual' },
      { ...user, id: 'coverage-manual-user-2', conversationId: 'coverage-manual', createdAt: '2026-08-30T10:00:01.000Z' },
      { ...assistant, id: 'coverage-manual-assistant', conversationId: 'coverage-manual', createdAt: '2026-08-30T10:00:02.000Z' },
      { ...user, id: 'coverage-pending', conversationId: 'coverage-pending', status: 'PENDING' },
    ];
    const plan = planConversationTurnBackfill(rows, new Map());
    const coveredIds = plan.groups.flatMap(({ messages }) => messages.map(({ id }) => id));

    expect(coveredIds.sort()).toEqual(rows.map(({ id }) => id).sort());
    expect(new Set(coveredIds).size).toBe(rows.length);
    expect(plan.report.scannedMessages).toBe(
      (2 * plan.report.deterministicGroups)
      + plan.report.archivedGroups
      + plan.report.manualReviewGroups,
    );
  });

  it('B2_IDENTITY_IS_STABLE_UNDER_SHUFFLE_AND_TIMESTAMP_CHANGES_ONLY_FINGERPRINT', () => {
    const baseline = planConversationTurnBackfill([assistant, user], new Map());
    const timestampDrift = planConversationTurnBackfill([
      user,
      { ...assistant, createdAt: '2026-08-30T10:00:02.000Z' },
    ], new Map());

    expect(baseline.groups[0].sourceId).toMatch(/^legacy_message_group_v2_[0-9a-f]{64}$/);
    expect(baseline.groups[0].turnId).toMatch(/^legacy_turn_v2_[0-9a-f]{64}$/);
    expect(timestampDrift.groups[0].sourceId).toBe(baseline.groups[0].sourceId);
    expect(timestampDrift.groups[0].turnId).toBe(baseline.groups[0].turnId);
    expect(timestampDrift.groups[0].sourceFingerprint)
      .not.toBe(baseline.groups[0].sourceFingerprint);
    expect(timestampDrift.sourceDigest).not.toBe(baseline.sourceDigest);
  });

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

  it('B2_VERIFY_REJECTS_REASON_CLASSIFICATION_DRIFT_AGAINST_PLANNER_V2', async () => {
    const message = {
      ...user,
      id: 'classification-drift-message',
      role: 'tool',
      createdAt: '2029-04-01T10:00:00.000Z',
      turnId: null,
      turnRole: null,
    };
    const sourceId = `legacy_message_group_v2_${stableLegacyFingerprint({
      contractVersion: 2,
      conversationId: message.conversationId,
      orderedMessageIds: [message.id],
    })}`;
    const sourceFingerprint = stableLegacyFingerprint({
      actorUserId: message.actorUserId,
      contextState: message.contextState,
      contextVersion: message.contextVersion,
      contractVersion: 2,
      conversationId: message.conversationId,
      courseKey: message.courseKey,
      messages: [{
        id: message.id,
        role: message.role,
        status: message.status,
        createdAt: message.createdAt,
      }],
      studentId: message.studentId,
    });
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM aria_data_migration_row_audits')) return {
        rowCount: 1,
        rows: [{
          sourceId,
          sourceFingerprint,
          classification: 'ARCHIVED_NON_RESUMABLE',
          targetTable: null,
          targetId: null,
          targetKey: null,
          beforeImage: {
            clusterId: null,
            createdAts: [message.createdAt],
            messageIds: [message.id],
            reason: 'SYSTEM_MESSAGE',
            roles: [message.role],
            statuses: [message.status],
          },
        }],
      };
      if (sql.includes('FROM aria_messages')) return { rowCount: 1, rows: [message] };
      if (sql.includes('MAX(sequence)')) return {
        rowCount: 1,
        rows: [{ conversationId: message.conversationId, maximum: 0 }],
      };
      if (sql.includes('FROM aria_conversation_turns')) return { rowCount: 0, rows: [] };
      throw new Error(`UNEXPECTED_QUERY:${sql}`);
    });

    await expect(validateCompletedTurnEvidence({ query } as never, 'run-drift', {
      scannedCount: 1,
      deterministicCount: 0,
      archivedCount: 1,
      manualReviewCount: 0,
      mutatedCount: 0,
    })).rejects.toThrow('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  });

  it.each([
    ['NULL', null, 'DETERMINISTIC_BACKFILL'],
    ['ARRAY', [], 'DETERMINISTIC_BACKFILL'],
    ['MISSING_KEY', { clusterId: null }, 'DETERMINISTIC_BACKFILL'],
    ['CLUSTER_TYPE', {
      clusterId: 42, createdAts: ['2026-08-30T10:00:00.000Z'], messageIds: ['m1'],
      reason: 'ORPHAN_USER', roles: ['user'], statuses: ['COMPLETED'],
    }, 'ARCHIVED_NON_RESUMABLE'],
    ['REASON_TYPE', {
      clusterId: null, createdAts: ['2026-08-30T10:00:00.000Z'], messageIds: ['m1'],
      reason: 42, roles: ['user'], statuses: ['COMPLETED'],
    }, 'ARCHIVED_NON_RESUMABLE'],
    ['CREATED_ATS_TYPE', {
      clusterId: null, createdAts: 'bad', messageIds: ['m1'], reason: 'ORPHAN_USER',
      roles: ['user'], statuses: ['COMPLETED'],
    }, 'ARCHIVED_NON_RESUMABLE'],
    ['MESSAGE_ID_ITEM_TYPE', {
      clusterId: null, createdAts: ['2026-08-30T10:00:00.000Z'], messageIds: [42],
      reason: 'ORPHAN_USER', roles: ['user'], statuses: ['COMPLETED'],
    }, 'ARCHIVED_NON_RESUMABLE'],
    ['EMPTY_MESSAGES', {
      clusterId: null, createdAts: [], messageIds: [], reason: 'ORPHAN_USER', roles: [], statuses: [],
    }, 'ARCHIVED_NON_RESUMABLE'],
    ['MISMATCHED_ARRAYS', {
      clusterId: null, createdAts: [], messageIds: ['m1'], reason: 'ORPHAN_USER',
      roles: ['user'], statuses: ['COMPLETED'],
    }, 'ARCHIVED_NON_RESUMABLE'],
    ['EMPTY_MESSAGE_ID', {
      clusterId: null, createdAts: ['2026-08-30T10:00:00.000Z'], messageIds: [''],
      reason: 'ORPHAN_USER', roles: ['user'], statuses: ['COMPLETED'],
    }, 'ARCHIVED_NON_RESUMABLE'],
    ['INVALID_CREATED_AT', {
      clusterId: null, createdAts: ['invalid'], messageIds: ['m1'], reason: 'ORPHAN_USER',
      roles: ['user'], statuses: ['COMPLETED'],
    }, 'ARCHIVED_NON_RESUMABLE'],
    ['PAIR_CLUSTER', {
      clusterId: 'a'.repeat(64), createdAts: ['2026-08-30T10:00:00.000Z', '2026-08-30T10:00:01.000Z'],
      messageIds: ['m1', 'm2'], reason: 'PAIR_COMPLETED', roles: ['user', 'assistant'],
      statuses: ['COMPLETED', 'COMPLETED'],
    }, 'DETERMINISTIC_BACKFILL'],
    ['PAIR_REASON', {
      clusterId: null, createdAts: ['2026-08-30T10:00:00.000Z', '2026-08-30T10:00:01.000Z'],
      messageIds: ['m1', 'm2'], reason: 'ORPHAN_USER', roles: ['user', 'assistant'],
      statuses: ['COMPLETED', 'COMPLETED'],
    }, 'DETERMINISTIC_BACKFILL'],
    ['PAIR_ROLES', {
      clusterId: null, createdAts: ['2026-08-30T10:00:00.000Z', '2026-08-30T10:00:01.000Z'],
      messageIds: ['m1', 'm2'], reason: 'PAIR_COMPLETED', roles: ['assistant', 'user'],
      statuses: ['COMPLETED', 'COMPLETED'],
    }, 'DETERMINISTIC_BACKFILL'],
    ['PAIR_STATUS', {
      clusterId: null, createdAts: ['2026-08-30T10:00:00.000Z', '2026-08-30T10:00:01.000Z'],
      messageIds: ['m1', 'm2'], reason: 'PAIR_ERROR', roles: ['user', 'assistant'],
      statuses: ['COMPLETED', 'COMPLETED'],
    }, 'DETERMINISTIC_BACKFILL'],
    ['ARCHIVE_CLUSTER', {
      clusterId: 'a'.repeat(64), createdAts: ['2026-08-30T10:00:00.000Z'], messageIds: ['m1'],
      reason: 'ORPHAN_USER', roles: ['user'], statuses: ['COMPLETED'],
    }, 'ARCHIVED_NON_RESUMABLE'],
    ['ARCHIVE_REASON', {
      clusterId: null, createdAts: ['2026-08-30T10:00:00.000Z'], messageIds: ['m1'],
      reason: 'UNKNOWN_ROLE', roles: ['tool'], statuses: ['COMPLETED'],
    }, 'ARCHIVED_NON_RESUMABLE'],
    ['MANUAL_CLUSTER', {
      clusterId: null, createdAts: ['2026-08-30T10:00:00.000Z'], messageIds: ['m1'],
      reason: 'UNKNOWN_ROLE', roles: ['tool'], statuses: ['COMPLETED'],
    }, 'MANUAL_REVIEW_REQUIRED'],
    ['MANUAL_REASON', {
      clusterId: 'a'.repeat(64), createdAts: ['2026-08-30T10:00:00.000Z'], messageIds: ['m1'],
      reason: 'ORPHAN_USER', roles: ['user'], statuses: ['COMPLETED'],
    }, 'MANUAL_REVIEW_REQUIRED'],
  ] as const)(
    'B2_AUDIT_BEFORE_IMAGE_REJECTS_%s',
    (_name, value, classification) => {
      expect(() => parseConversationTurnMessageAuditBeforeImage(value, classification))
        .toThrow('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
    },
  );

  it('B2_AUDIT_BEFORE_IMAGE_ACCEPTS_EACH_CANONICAL_CLASSIFICATION', () => {
    expect(parseConversationTurnMessageAuditBeforeImage({
      clusterId: null,
      createdAts: ['2026-08-30T10:00:00.000Z', '2026-08-30T10:00:01.000Z'],
      messageIds: ['m1', 'm2'], reason: 'PAIR_CANCELLED', roles: ['user', 'assistant'],
      statuses: ['COMPLETED', 'CANCELLED'],
    }, 'DETERMINISTIC_BACKFILL')).toMatchObject({ reason: 'PAIR_CANCELLED' });
    expect(parseConversationTurnMessageAuditBeforeImage({
      clusterId: null, createdAts: ['2026-08-30T10:00:00.000Z'], messageIds: ['m1'],
      reason: 'NON_TERMINAL_STATUS', roles: ['user'], statuses: ['PENDING'],
    }, 'ARCHIVED_NON_RESUMABLE')).toMatchObject({ reason: 'NON_TERMINAL_STATUS' });
    expect(parseConversationTurnMessageAuditBeforeImage({
      clusterId: 'a'.repeat(64), createdAts: ['2026-08-30T10:00:00.000Z'],
      messageIds: ['m1'], reason: 'UNKNOWN_STATUS', roles: ['assistant'], statuses: ['LOST'],
    }, 'MANUAL_REVIEW_REQUIRED')).toMatchObject({ reason: 'UNKNOWN_STATUS' });
  });

  it.each([
    ['NULL', null],
    ['ARRAY', []],
    ['MESSAGE_IDS_TYPE', { contractVersion: 2, messageIds: 'bad', sequence: 1, status: 'COMPLETED', turnId: 't1' }],
    ['EXTRA_KEY', { contractVersion: 2, messageIds: ['m1', 'm2'], sequence: 1, status: 'COMPLETED', turnId: 't1', extra: true }],
    ['CONTRACT_VERSION', { contractVersion: 1, messageIds: ['m1', 'm2'], sequence: 1, status: 'COMPLETED', turnId: 't1' }],
    ['MESSAGE_CARDINALITY', { contractVersion: 2, messageIds: ['m1'], sequence: 1, status: 'COMPLETED', turnId: 't1' }],
    ['EMPTY_MESSAGE_ID', { contractVersion: 2, messageIds: ['m1', ''], sequence: 1, status: 'COMPLETED', turnId: 't1' }],
    ['ZERO_SEQUENCE', { contractVersion: 2, messageIds: ['m1', 'm2'], sequence: 0, status: 'COMPLETED', turnId: 't1' }],
    ['HIGH_SEQUENCE', { contractVersion: 2, messageIds: ['m1', 'm2'], sequence: 2_147_483_648, status: 'COMPLETED', turnId: 't1' }],
    ['STATUS', { contractVersion: 2, messageIds: ['m1', 'm2'], sequence: 1, status: 'RUNNING', turnId: 't1' }],
    ['TURN_ID', { contractVersion: 2, messageIds: ['m1', 'm2'], sequence: 1, status: 'COMPLETED', turnId: '' }],
  ] as const)('B2_TARGET_KEY_REJECTS_%s', (_name, value) => {
    expect(() => parseConversationTurnTargetKey(value))
      .toThrow('ARIA_CONVERSATION_TURN_BACKFILL_REPLAY_AUDIT_INVALID');
  });

  it('B2_TARGET_KEY_ACCEPTS_THE_CANONICAL_SHAPE', () => {
    expect(parseConversationTurnTargetKey({
      contractVersion: 2, messageIds: ['m1', 'm2'], sequence: 1,
      status: 'ERROR', turnId: 'turn-1',
    })).toEqual({
      contractVersion: 2, messageIds: ['m1', 'm2'], sequence: 1,
      status: 'ERROR', turnId: 'turn-1',
    });
  });

  it.each([
    ['MESSAGE_DATE', [{ ...user, createdAt: 'invalid' }], new Map(), 'ARIA_BACKFILL_MESSAGE_DATE_INVALID'],
    [
      'INITIAL_SEQUENCE', [user, assistant], new Map([[user.conversationId, -1]]),
      'ARIA_BACKFILL_TURN_SEQUENCE_INVALID',
    ],
  ] as const)('B2_PLAN_REJECTS_INVALID_%s', (_name, rows, maximums, expectedError) => {
    expect(() => planConversationTurnBackfill(rows, maximums))
      .toThrow(expectedError);
  });
});
