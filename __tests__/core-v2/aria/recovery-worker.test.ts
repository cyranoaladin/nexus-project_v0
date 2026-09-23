import { setupServiceHarness } from '../helpers/service-harness';
import { CoreV2JobStatus, CoreV2JobType } from '@/core-v2/generated/client';
import { CoreV2AriaConversationRepository } from '@/lib/core-v2/aria/conversation-repository';
import { drainCoreV2AriaRecoveryOutbox, MAX_RECOVERY_ATTEMPTS, recoveryBackoffMs } from '@/lib/core-v2/aria/recovery-worker';
import { assertCoreV2AriaRecoveryConfiguration } from '@/lib/core-v2/aria/recovery-config';
import type { ReserveTurnRepositoryInput } from '@/lib/aria/application/conversation/ports';

const h = setupServiceHarness();

async function seedTurn() {
  const household = await h.client.household.create({ data: {} });
  const user = await h.client.user.create({ data: { role: 'ELEVE', email: `recovery-${Date.now()}-${Math.random()}@synthetic.test`, accountStatus: 'ACTIVE' } });
  const student = await h.client.student.create({ data: { userId: user.id, householdId: household.id } });
  const repository = new CoreV2AriaConversationRepository(h.client);
  const input: ReserveTurnRepositoryInput = {
    actorUserId: user.id,
    subjectStudentId: student.id,
    clientRequestId: `recovery-${Date.now()}-${Math.random()}`,
    requestFingerprint: 'e'.repeat(64),
    courseKey: 'philosophie-terminale',
    message: 'synthetic recovery test',
    academicSnapshot: { gradeLevel: 'TERMINALE' },
    pedagogicalMode: 'DISCOVERY',
    agentRole: 'TUTOR',
    modelPolicy: { policyId: 'test' },
    now: new Date('2026-09-23T12:00:00.000Z'),
    pendingRecoveryAt: new Date('2026-09-23T12:00:30.000Z'),
  };
  return { user, student, repository, clientRequestId: input.clientRequestId, reservation: await repository.reserveTurn(input) };
}

describe('Core v2 ARIA watchdog and recovery', () => {
  test('reserve creates exactly one minimal watchdog atomically', async () => {
    const { reservation } = await seedTurn();
    const jobs = await h.client.coreV2JobOutbox.findMany({ where: { aggregateId: reservation.turnId } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ jobType: CoreV2JobType.RECOVER_ARIA_TURN, aggregateType: 'AriaConversationTurnCoreV2', idempotencyKey: `aria-turn-watchdog:${reservation.turnId}`, status: CoreV2JobStatus.PENDING, payload: { schemaVersion: 1, turnId: reservation.turnId } });
    expect(JSON.stringify(jobs[0]?.payload)).not.toMatch(/message|email|name/i);
  });

  test('watchdog creation failure rolls the Turn and messages back', async () => {
    const { user, student, reservation } = await seedTurn();
    const conversation = await h.client.ariaConversationCoreV2.create({ data: { studentId: student.id, courseKey: 'philosophie-terminale' } });
    await expect(h.client.$transaction(async (tx) => {
      const turn = await tx.ariaConversationTurnCoreV2.create({ data: { conversationId: conversation.id, subjectStudentId: student.id, actorUserId: user.id, useCase: 'CONVERSATION', clientRequestId: 'atomic-failure', requestFingerprint: 'f'.repeat(64), sequence: 1, academicSnapshot: {}, pedagogicalMode: 'DISCOVERY', agentRole: 'TUTOR', modelPolicy: {} } });
      await tx.ariaMessageCoreV2.create({ data: { conversationId: conversation.id, turnId: turn.id, role: 'USER', content: 'should rollback' } });
      await tx.coreV2JobOutbox.create({ data: { jobType: CoreV2JobType.RECOVER_ARIA_TURN, aggregateType: 'AriaConversationTurnCoreV2', aggregateId: turn.id, idempotencyKey: `aria-turn-watchdog:${reservation.turnId}`, payload: { schemaVersion: 1, turnId: turn.id } } });
    })).rejects.toThrow();
    expect(await h.client.ariaConversationTurnCoreV2.count({ where: { conversationId: conversation.id } })).toBe(0);
    expect(await h.client.ariaMessageCoreV2.count({ where: { conversationId: conversation.id } })).toBe(0);
  });

  test('claim, heartbeat and finalize move the watchdog with the Turn', async () => {
    const { user, student, repository, reservation } = await seedTurn();
    const claimed = await repository.claimTurn({ turnId: reservation.turnId, conversationId: reservation.conversationId, actorUserId: user.id, subjectStudentId: student.id, executionToken: 'recovery-token', now: new Date('2026-09-23T12:01:00.000Z'), leaseExpiresAt: new Date('2026-09-23T12:02:00.000Z') });
    expect(claimed.disposition).toBe('CLAIMED');
    expect(await h.client.coreV2JobOutbox.findUnique({ where: { idempotencyKey: `aria-turn-watchdog:${reservation.turnId}` }, select: { status: true, availableAt: true } })).toMatchObject({ status: 'PENDING', availableAt: new Date('2026-09-23T12:02:00.000Z') });
    expect((await repository.heartbeatTurn({ turnId: reservation.turnId, conversationId: reservation.conversationId, executionToken: 'recovery-token', now: new Date('2026-09-23T12:01:30.000Z'), leaseExpiresAt: new Date('2026-09-23T12:03:00.000Z') })).disposition).toBe('RENEWED');
    const evidence = { schemaVersion: 1 as const, hits: [] };
    await repository.checkpointRetrieval({ turnId: reservation.turnId, conversationId: reservation.conversationId, executionToken: 'recovery-token', ragStatus: 'NOT_CONFIGURED', retrievalPolicy: {}, retrievalEvidence: evidence, policyVersion: 'test' });
    await repository.finalizeTurn({ turnId: reservation.turnId, conversationId: reservation.conversationId, assistantMessageId: reservation.assistantMessageId, executionToken: 'recovery-token', status: 'ERROR', content: 'interrupted', ragStatus: 'NOT_CONFIGURED', retrievalEvidence: evidence, citations: [], executionMetadata: { reasonCode: 'EXECUTION_INTERRUPTED' }, now: new Date('2026-09-23T12:04:00.000Z') });
    expect(await h.client.coreV2JobOutbox.findUnique({ where: { idempotencyKey: `aria-turn-watchdog:${reservation.turnId}` }, select: { status: true, completedAt: true, leaseOwner: true, leaseExpiresAt: true } })).toMatchObject({ status: 'COMPLETED', leaseOwner: null, leaseExpiresAt: null });
  });

  test('pending cancellation terminalizes the Turn and watchdog together', async () => {
    const { user, repository, clientRequestId, reservation } = await seedTurn();
    expect((await repository.requestCancellation({ turnId: reservation.turnId, actorUserId: user.id, clientRequestId, now: new Date('2026-09-23T12:01:00.000Z') })).disposition).toBe('CANCELLED');
    expect(await h.client.coreV2JobOutbox.findUnique({ where: { idempotencyKey: `aria-turn-watchdog:${reservation.turnId}` }, select: { status: true, completedAt: true } })).toMatchObject({ status: 'COMPLETED' });
  });

  test('missing watchdog rolls claim back and running cancellation is recovered safely', async () => {
    const missing = await seedTurn();
    await h.client.coreV2JobOutbox.delete({ where: { idempotencyKey: `aria-turn-watchdog:${missing.reservation.turnId}` } });
    await expect(missing.repository.claimTurn({ turnId: missing.reservation.turnId, conversationId: missing.reservation.conversationId, actorUserId: missing.user.id, subjectStudentId: missing.student.id, executionToken: 'missing-watchdog', now: new Date(), leaseExpiresAt: new Date(Date.now() + 60_000) })).rejects.toMatchObject({ internalDetails: { reasonCode: 'TURN_WATCHDOG_MISSING' } });
    expect((await h.client.ariaConversationTurnCoreV2.findUnique({ where: { id: missing.reservation.turnId }, select: { status: true } }))?.status).toBe('PENDING');

    const running = await seedTurn();
    await running.repository.claimTurn({ turnId: running.reservation.turnId, conversationId: running.reservation.conversationId, actorUserId: running.user.id, subjectStudentId: running.student.id, executionToken: 'cancel-running', now: new Date('2026-09-23T12:01:00.000Z'), leaseExpiresAt: new Date('2026-09-23T12:05:00.000Z') });
    expect((await running.repository.requestCancellation({ turnId: running.reservation.turnId, actorUserId: running.user.id, clientRequestId: running.clientRequestId, now: new Date('2026-09-23T12:01:30.000Z') })).disposition).toBe('CANCELLATION_REQUESTED');
    await h.client.coreV2JobOutbox.update({ where: { idempotencyKey: `aria-turn-watchdog:${running.reservation.turnId}` }, data: { availableAt: new Date('2026-09-23T12:01:31.000Z') } });
    expect((await drainCoreV2AriaRecoveryOutbox({ owner: 'worker-cancel', now: new Date('2026-09-23T12:02:00.000Z') }, h.client)).recovered).toBe(1);
    expect((await h.client.ariaConversationTurnCoreV2.findUnique({ where: { id: running.reservation.turnId }, select: { status: true, executionMetadata: true } }))?.status).toBe('CANCELLED');
  });

  test('fresh running recovery reschedules and stale running recovery is terminal-safe', async () => {
    const fresh = await seedTurn();
    await fresh.repository.claimTurn({ turnId: fresh.reservation.turnId, conversationId: fresh.reservation.conversationId, actorUserId: fresh.user.id, subjectStudentId: fresh.student.id, executionToken: 'fresh-token', now: new Date('2026-09-23T12:01:00.000Z'), leaseExpiresAt: new Date('2026-09-23T12:05:00.000Z') });
    await h.client.coreV2JobOutbox.update({ where: { idempotencyKey: `aria-turn-watchdog:${fresh.reservation.turnId}` }, data: { availableAt: new Date('2026-09-23T12:01:01.000Z') } });
    const freshMetrics = await drainCoreV2AriaRecoveryOutbox({ owner: 'worker-fresh', now: new Date('2026-09-23T12:02:00.000Z') }, h.client);
    expect(freshMetrics.rescheduled).toBe(1);
    expect((await h.client.ariaConversationTurnCoreV2.findUnique({ where: { id: fresh.reservation.turnId }, select: { status: true } }))?.status).toBe('RUNNING');

    const stale = await seedTurn();
    await stale.repository.claimTurn({ turnId: stale.reservation.turnId, conversationId: stale.reservation.conversationId, actorUserId: stale.user.id, subjectStudentId: stale.student.id, executionToken: 'stale-token', now: new Date('2026-09-23T12:01:00.000Z'), leaseExpiresAt: new Date('2026-09-23T12:01:30.000Z') });
    await h.client.coreV2JobOutbox.update({ where: { idempotencyKey: `aria-turn-watchdog:${stale.reservation.turnId}` }, data: { availableAt: new Date('2026-09-23T12:01:31.000Z') } });
    const staleMetrics = await drainCoreV2AriaRecoveryOutbox({ owner: 'worker-stale', now: new Date('2026-09-23T12:02:00.000Z') }, h.client);
    expect(staleMetrics.recovered).toBe(1);
    expect((await h.client.ariaConversationTurnCoreV2.findUnique({ where: { id: stale.reservation.turnId }, select: { status: true, executionMetadata: true } }))?.status).toBe('ERROR');
  });

  test('pending stale recovery and concurrent workers are bounded', async () => {
    const stale = await seedTurn();
    await h.client.coreV2JobOutbox.update({ where: { idempotencyKey: `aria-turn-watchdog:${stale.reservation.turnId}` }, data: { availableAt: new Date('2026-09-23T11:59:00.000Z') } });
    expect((await drainCoreV2AriaRecoveryOutbox({ owner: 'worker-pending', now: new Date('2026-09-23T12:00:00.000Z') }, h.client)).recovered).toBe(1);
    expect((await h.client.ariaConversationTurnCoreV2.findUnique({ where: { id: stale.reservation.turnId }, select: { status: true } }))?.status).toBe('ERROR');

    const concurrent = await seedTurn();
    await h.client.coreV2JobOutbox.update({ where: { idempotencyKey: `aria-turn-watchdog:${concurrent.reservation.turnId}` }, data: { availableAt: new Date('2026-09-23T11:59:00.000Z') } });
    const results = await Promise.all([
      drainCoreV2AriaRecoveryOutbox({ owner: 'worker-a', now: new Date('2026-09-23T12:00:00.000Z') }, h.client),
      drainCoreV2AriaRecoveryOutbox({ owner: 'worker-b', now: new Date('2026-09-23T12:00:00.000Z') }, h.client),
    ]);
    expect(results.map((result) => result.claimed).reduce((a, b) => a + b, 0)).toBe(1);
  });

  test('worker failures retry with bounded backoff and end in FAILED_FINAL', async () => {
    const bad = await h.client.coreV2JobOutbox.create({ data: { jobType: CoreV2JobType.RECOVER_ARIA_TURN, aggregateType: 'AriaConversationTurnCoreV2', aggregateId: 'aggregate-id', idempotencyKey: 'bad-recovery-job', payload: { schemaVersion: 1, turnId: 'different-turn' }, availableAt: new Date('2026-09-23T12:00:00.000Z') } });
    const retried = await drainCoreV2AriaRecoveryOutbox({ owner: 'worker-retry', now: new Date('2026-09-23T12:00:00.000Z') }, h.client);
    expect(retried.retried).toBe(1);
    expect((await h.client.coreV2JobOutbox.findUnique({ where: { id: bad.id }, select: { status: true, lastError: true, attemptCount: true, availableAt: true } }))?.lastError).toBe('RECOVERY_JOB_IDENTITY_MISMATCH');
    expect(recoveryBackoffMs(1)).toBe(5_000);
    expect(recoveryBackoffMs(20)).toBe(40_000);
    await h.client.coreV2JobOutbox.update({ where: { id: bad.id }, data: { status: CoreV2JobStatus.RETRY_SCHEDULED, attemptCount: MAX_RECOVERY_ATTEMPTS - 1, availableAt: new Date('2026-09-23T12:00:00.000Z'), lastError: null } });
    const final = await drainCoreV2AriaRecoveryOutbox({ owner: 'worker-final', now: new Date('2026-09-23T12:00:00.000Z') }, h.client);
    expect(final.failedFinal).toBe(1);
    expect((await h.client.coreV2JobOutbox.findUnique({ where: { id: bad.id }, select: { status: true, leaseOwner: true, leaseExpiresAt: true } }))).toMatchObject({ status: 'FAILED_FINAL', leaseOwner: null, leaseExpiresAt: null });
    await expect(h.client.coreV2JobOutbox.update({ where: { id: bad.id }, data: { status: CoreV2JobStatus.PENDING } })).rejects.toThrow('CORE_V2_JOB_TERMINAL_IMMUTABLE');
  });

  test('recovery and finalization racing on one Turn produce one terminal outcome', async () => {
    const seeded = await seedTurn();
    await seeded.repository.claimTurn({
      turnId: seeded.reservation.turnId,
      conversationId: seeded.reservation.conversationId,
      actorUserId: seeded.user.id,
      subjectStudentId: seeded.student.id,
      executionToken: 'race-token',
      now: new Date('2026-09-23T12:01:00.000Z'),
      leaseExpiresAt: new Date('2026-09-23T12:01:30.000Z'),
    });
    await h.client.coreV2JobOutbox.update({
      where: { idempotencyKey: `aria-turn-watchdog:${seeded.reservation.turnId}` },
      data: { availableAt: new Date('2026-09-23T12:01:31.000Z') },
    });
    const evidence = { schemaVersion: 1 as const, hits: [] };
    const outcomes = await Promise.allSettled([
      drainCoreV2AriaRecoveryOutbox({ owner: 'worker-race', now: new Date('2026-09-23T12:02:00.000Z') }, h.client),
      seeded.repository.finalizeTurn({
        turnId: seeded.reservation.turnId,
        conversationId: seeded.reservation.conversationId,
        assistantMessageId: seeded.reservation.assistantMessageId,
        executionToken: 'race-token',
        status: 'COMPLETED',
        content: 'completed exactly once',
        ragStatus: 'NOT_CONFIGURED',
        retrievalEvidence: evidence,
        citations: [],
        executionMetadata: {},
        now: new Date('2026-09-23T12:02:00.000Z'),
      }),
    ]);
    const turn = await h.client.ariaConversationTurnCoreV2.findUnique({
      where: { id: seeded.reservation.turnId },
      select: { status: true },
    });
    const watchdog = await h.client.coreV2JobOutbox.findUnique({
      where: { idempotencyKey: `aria-turn-watchdog:${seeded.reservation.turnId}` },
      select: { status: true },
    });
    expect(['COMPLETED', 'ERROR']).toContain(turn?.status);
    expect(watchdog?.status).toBe('COMPLETED');
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
  });

  test('conversation enablement cannot run without the recovery worker', () => {
    expect(() => assertCoreV2AriaRecoveryConfiguration({ CORE_V2_ARIA_CONVERSATION_ENABLED: 'true', CORE_V2_ARIA_RECOVERY_WORKER_ENABLED: 'false' })).toThrow();
    expect(() => assertCoreV2AriaRecoveryConfiguration({ CORE_V2_ARIA_CONVERSATION_ENABLED: 'false', CORE_V2_ARIA_RECOVERY_WORKER_ENABLED: 'false' })).not.toThrow();
  });
});
