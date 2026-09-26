import { setupServiceHarness } from '../helpers/service-harness';
import { CoreV2AriaConversationRepository } from '@/lib/core-v2/aria/conversation-repository';
import type { ReserveTurnRepositoryInput } from '@/lib/aria/application/conversation/ports';

const h = setupServiceHarness();
const fingerprint = 'c'.repeat(64);

async function seedActor() {
  const household = await h.client.household.create({ data: {} });
  const user = await h.client.user.create({ data: { role: 'ELEVE', email: `repo-${Date.now()}@synthetic.test`, accountStatus: 'ACTIVE' } });
  const student = await h.client.student.create({ data: { userId: user.id, householdId: household.id } });
  return { user, student };
}

function input(userId: string, studentId: string, requestId: string, conversationId?: string): ReserveTurnRepositoryInput {
  return {
    actorUserId: userId,
    subjectStudentId: studentId,
    clientRequestId: requestId,
    requestFingerprint: fingerprint,
    requestedConversationId: conversationId,
    courseKey: 'philosophie-terminale',
    message: `message:${requestId}`,
    academicSnapshot: { gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE' },
    pedagogicalMode: 'DISCOVERY',
    agentRole: 'TUTOR',
    modelPolicy: { policyId: 'test-policy' },
    now: new Date('2026-09-23T12:00:00.000Z'),
    pendingRecoveryAt: new Date('2026-09-23T12:05:00.000Z'),
  };
}

describe('Core v2 Aria conversation repository', () => {
  test('reserves placeholders and replays idempotently', async () => {
    const { user, student } = await seedActor();
    const repository = new CoreV2AriaConversationRepository(h.client);
    const first = await repository.reserveTurn(input(user.id, student.id, 'reserve-1'));
    expect(first.disposition).toBe('RESERVED');
    expect(await h.client.ariaMessageCoreV2.count({ where: { turnId: first.turnId } })).toBe(2);

    const replay = await repository.reserveTurn(input(user.id, student.id, 'reserve-1'));
    expect(replay).toMatchObject({ turnId: first.turnId, disposition: 'IN_PROGRESS' });
    await expect(repository.reserveTurn({ ...input(user.id, student.id, 'reserve-1'), requestFingerprint: 'd'.repeat(64) }))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  test('serializes identical and distinct requests on one conversation', async () => {
    const { user, student } = await seedActor();
    const repository = new CoreV2AriaConversationRepository(h.client);
    const firstConversation = await h.client.ariaConversationCoreV2.create({ data: { studentId: student.id, courseKey: 'philosophie-terminale' } });
    const identical = await Promise.all([
      repository.reserveTurn(input(user.id, student.id, 'race-2', firstConversation.id)),
      repository.reserveTurn(input(user.id, student.id, 'race-2', firstConversation.id)),
    ]);
    expect(new Set(identical.map((reservation) => reservation.turnId)).size).toBe(1);
    const turnCount = await h.client.ariaConversationTurnCoreV2.count({ where: { conversationId: firstConversation.id } });
    expect(turnCount).toBe(1);

    const secondConversation = await h.client.ariaConversationCoreV2.create({ data: { studentId: student.id, courseKey: 'philosophie-terminale' } });
    const distinct = await Promise.allSettled([
      repository.reserveTurn(input(user.id, student.id, 'race-3', secondConversation.id)),
      repository.reserveTurn(input(user.id, student.id, 'race-4', secondConversation.id)),
    ]);
    expect(distinct.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(await h.client.ariaConversationTurnCoreV2.count({ where: { conversationId: secondConversation.id } })).toBe(1);
  });

  test('claims, checkpoints, finalizes and loads a result with fencing', async () => {
    const { user, student } = await seedActor();
    const repository = new CoreV2AriaConversationRepository(h.client);
    const reserved = await repository.reserveTurn(input(user.id, student.id, 'lifecycle'));
    expect((await repository.claimTurn({ turnId: reserved.turnId, conversationId: reserved.conversationId, actorUserId: user.id, subjectStudentId: student.id, executionToken: 'token-1', now: new Date('2026-09-23T12:01:00.000Z'), leaseExpiresAt: new Date('2026-09-23T12:02:00.000Z') })).disposition).toBe('CLAIMED');
    const evidence = { schemaVersion: 1 as const, hits: [] };
    await repository.checkpointRetrieval({ turnId: reserved.turnId, conversationId: reserved.conversationId, executionToken: 'token-1', ragStatus: 'NOT_CONFIGURED', retrievalPolicy: { kind: 'GENERAL_CHAT' }, retrievalEvidence: evidence, policyVersion: 'test' });
    await repository.finalizeTurn({ turnId: reserved.turnId, conversationId: reserved.conversationId, assistantMessageId: reserved.assistantMessageId, executionToken: 'token-1', status: 'ERROR', content: 'provider unavailable', ragStatus: 'NOT_CONFIGURED', retrievalEvidence: evidence, citations: [], executionMetadata: { failureCode: 'MODEL_UNAVAILABLE' }, now: new Date('2026-09-23T12:03:00.000Z') });
    const result = await repository.loadTurnResult({ turnId: reserved.turnId, actorUserId: user.id, subjectStudentId: student.id });
    expect(result).toMatchObject({ turnId: reserved.turnId, status: 'ERROR', content: 'provider unavailable' });
    await expect(repository.finalizeTurn({ turnId: reserved.turnId, conversationId: reserved.conversationId, assistantMessageId: reserved.assistantMessageId, executionToken: 'token-1', status: 'ERROR', content: 'overwritten', ragStatus: 'NOT_CONFIGURED', retrievalEvidence: evidence, citations: [], executionMetadata: {}, now: new Date('2026-09-23T12:04:00.000Z') })).rejects.toThrow();
  });

  test('cancellation and heartbeat preserve ownership and fencing', async () => {
    const { user, student } = await seedActor();
    const repository = new CoreV2AriaConversationRepository(h.client);
    const reserved = await repository.reserveTurn(input(user.id, student.id, 'cancel'));
    const cancellation = await repository.requestCancellation({ turnId: reserved.turnId, actorUserId: user.id, clientRequestId: 'cancel', now: new Date('2026-09-23T12:01:00.000Z') });
    expect(cancellation.disposition).toBe('CANCELLED');
    expect((await repository.heartbeatTurn({ turnId: reserved.turnId, conversationId: reserved.conversationId, executionToken: 'missing', now: new Date(), leaseExpiresAt: new Date() })).disposition).toBe('LEASE_LOST');
  });

  test('history is bounded to completed turns and owned by the subject', async () => {
    const { user, student } = await seedActor();
    const repository = new CoreV2AriaConversationRepository(h.client);
    const reserved = await repository.reserveTurn(input(user.id, student.id, 'history'));
    await repository.claimTurn({ turnId: reserved.turnId, conversationId: reserved.conversationId, actorUserId: user.id, subjectStudentId: student.id, executionToken: 'history-token', now: new Date(), leaseExpiresAt: new Date(Date.now() + 60_000) });
    const evidence = { schemaVersion: 1 as const, hits: [] };
    await repository.checkpointRetrieval({ turnId: reserved.turnId, conversationId: reserved.conversationId, executionToken: 'history-token', ragStatus: 'NOT_CONFIGURED', retrievalPolicy: {}, retrievalEvidence: evidence, policyVersion: 'test' });
    await repository.finalizeTurn({ turnId: reserved.turnId, conversationId: reserved.conversationId, assistantMessageId: reserved.assistantMessageId, executionToken: 'history-token', status: 'COMPLETED', content: 'done', ragStatus: 'NOT_CONFIGURED', retrievalEvidence: evidence, citations: [], executionMetadata: {}, now: new Date() });
    const history = await repository.loadRecentCompletedTurns({ conversationId: reserved.conversationId, subjectStudentId: student.id, maxTurns: 5 });
    expect(history).toHaveLength(1);
    expect(history[0]?.assistant.content).toBe('done');
  });
});
