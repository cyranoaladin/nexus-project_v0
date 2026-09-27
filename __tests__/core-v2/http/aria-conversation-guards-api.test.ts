import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/gateway', () => ({
  ...jest.requireActual('@/lib/aria/gateway'),
  streamChatCompletion: jest.fn(() => { throw new Error('PROVIDER_MUST_NOT_BE_CALLED'); }),
}));

import { auth } from '@/auth';
import { NO_PARAMS } from '@/lib/core-v2/http/staff-route';
import { setupServiceHarness, seedAcademicYear } from '../helpers/service-harness';
import { CoreV2AriaConversationRepository } from '@/lib/core-v2/aria/conversation-repository';
import { grantCoreV2AriaAccess } from '@/lib/core-v2/aria/access-grants';
import { kickCoreV2AriaRecoveryDrain, startCoreV2AriaRecoveryScheduler, stopCoreV2AriaRecoveryScheduler } from '@/lib/core-v2/aria/recovery-scheduler';
import * as ariaGateway from '@/lib/aria/gateway';
import * as chatRoute from '@/app/api/v2/aria/chat/route';
import * as conversationsRoute from '@/app/api/v2/aria/conversations/route';
import * as messagesRoute from '@/app/api/v2/aria/conversations/[conversationId]/messages/route';
import * as cancelRoute from '@/app/api/v2/aria/turns/[turnId]/cancel/route';
import * as feedbackRoute from '@/app/api/v2/aria/feedback/route';

const h = setupServiceHarness();
const mockedAuth = auth as unknown as jest.Mock;
const clientRequestId = '00000000-0000-4000-8000-000000000001';

function signInAs(user: { id: string; role: string } | null) {
  mockedAuth.mockResolvedValue(user ? { user: { id: user.id, role: user.role, email: 'synthetic@example.test' }, expires: '2099-01-01' } : null);
}

async function call(method: 'GET' | 'POST', path: string, body?: unknown, params: Record<string, string> = {}) {
  const request = new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { origin: 'http://localhost:3000', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const context = Object.keys(params).length ? { params: Promise.resolve(params) } : NO_PARAMS;
  const route = path.includes('/chat') ? chatRoute.POST
    : path.includes('/cancel') ? cancelRoute.POST
      : path.includes('/feedback') ? feedbackRoute.POST : conversationsRoute.GET;
  const response = await route(request, context);
  return { status: response.status, body: await response.json() };
}

async function seedStudent(email: string) {
  const year = await h.client.academicYear.findFirstOrThrow({ where: { status: 'CURRENT' } });
  const household = await h.client.household.create({ data: {} });
  const user = await h.client.user.create({ data: { role: 'ELEVE', email, accountStatus: 'ACTIVE' } });
  const student = await h.client.student.create({ data: { userId: user.id, householdId: household.id } });
  await h.client.studentAcademicYearEnrollment.create({ data: { studentId: student.id, academicYearId: year.id, status: 'ACTIVE', gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE' } });
  return { user, student };
}

async function reserve(userId: string, studentId: string, suffix: string) {
  const repository = new CoreV2AriaConversationRepository(h.client);
  return repository.reserveTurn({
    actorUserId: userId, subjectStudentId: studentId, clientRequestId,
    requestFingerprint: 'a'.repeat(64), courseKey: 'philosophie-terminale',
    message: `Question ${suffix}`, academicSnapshot: { gradeLevel: 'TERMINALE' },
    pedagogicalMode: 'DISCOVERY', agentRole: 'TUTOR', modelPolicy: { policyId: 'test' },
    now: new Date('2026-09-26T12:00:00.000Z'), pendingRecoveryAt: new Date('2026-09-26T12:01:00.000Z'),
  });
}

describe('Core v2 ARIA conversation route guards', () => {
  beforeEach(async () => {
    await seedAcademicYear(h.client, 2026);
    mockedAuth.mockReset();
    delete process.env.CORE_V2_ARIA_CONVERSATION_ENABLED;
    delete process.env.CORE_V2_ARIA_RECOVERY_WORKER_ENABLED;
  });

  afterEach(() => {
    delete process.env.CORE_V2_ARIA_CONVERSATION_ENABLED;
    delete process.env.CORE_V2_ARIA_RECOVERY_WORKER_ENABLED;
  });

  test('disabled chat refuses before any Turn, message, watchdog or provider execution', async () => {
    const owner = await seedStudent('chat-disabled@synthetic.test');
    signInAs({ id: owner.user.id, role: 'ELEVE' });
    process.env.CORE_V2_ARIA_CONVERSATION_ENABLED = 'false';
    const result = await call('POST', '/api/v2/aria/chat', {
      courseKey: 'philosophie-terminale', clientRequestId, content: 'Question', pedagogicalMode: 'DISCOVERY',
    });
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe('FORBIDDEN');
    expect(await h.client.ariaConversationTurnCoreV2.count()).toBe(0);
    expect(await h.client.ariaMessageCoreV2.count()).toBe(0);
    expect(await h.client.coreV2JobOutbox.count()).toBe(0);
  });

  test('POST chat rejects a Maths course for an NSI-only grant before reservation or provider execution', async () => {
    const owner = await seedStudent('cross-feature-chat@synthetic.test');
    const enrollment = await h.client.studentAcademicYearEnrollment.findFirstOrThrow({ where: { studentId: owner.student.id } });
    await h.client.studentCourseEnrollment.createMany({ data: [
      { academicYearEnrollmentId: enrollment.id, courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' },
      { academicYearEnrollmentId: enrollment.id, courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY' },
    ] });
    await grantCoreV2AriaAccess(h.client, h.admin, {
      studentId: owner.student.id, featureKey: 'aria_nsi', ariaTier: 'ARIA_ACCOMPAGNEE',
    });
    process.env.CORE_V2_ARIA_CONVERSATION_ENABLED = 'true';
    process.env.CORE_V2_ARIA_RECOVERY_WORKER_ENABLED = 'true';
    signInAs({ id: owner.user.id, role: 'ELEVE' });
    const provider = ariaGateway.streamChatCompletion as jest.Mock;
    provider.mockClear();
    const result = await call('POST', '/api/v2/aria/chat', {
      courseKey: 'maths-terminale-eds', clientRequestId, content: 'Question de maths', pedagogicalMode: 'DISCOVERY',
    });
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe('NOT_ENTITLED');
    expect(await h.client.ariaConversationTurnCoreV2.count()).toBe(0);
    expect(await h.client.ariaMessageCoreV2.count()).toBe(0);
    expect(await h.client.coreV2JobOutbox.count()).toBe(0);
    expect(provider).not.toHaveBeenCalled();
  });

  test('disabled new chat preserves history and cancellation of an existing Turn', async () => {
    const owner = await seedStudent('existing-turn@synthetic.test');
    const turn = await reserve(owner.user.id, owner.student.id, 'existing');
    signInAs({ id: owner.user.id, role: 'ELEVE' });
    process.env.CORE_V2_ARIA_CONVERSATION_ENABLED = 'false';
    const historyPath = `/api/v2/aria/conversations/${turn.conversationId}/messages`;
    const context = { params: Promise.resolve({ conversationId: turn.conversationId }) };
    const before = await messagesRoute.GET(new NextRequest(`http://localhost:3000${historyPath}`), context);
    expect(before.status).toBe(200);
    expect((await before.json()).data.conversation.activeTurn.turnId).toBe(turn.turnId);

    const cancelled = await call('POST', `/api/v2/aria/turns/${turn.turnId}/cancel`, { clientRequestId }, { turnId: turn.turnId });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');

    const after = await messagesRoute.GET(new NextRequest(`http://localhost:3000${historyPath}`), context);
    expect(after.status).toBe(200);
    expect((await after.json()).data.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: turn.assistantMessageId, status: 'CANCELLED' }),
    ]));
  });

  test('disabled new chat still cancels and recovers a RUNNING Turn in the real store', async () => {
    const owner = await seedStudent('running-rollout-cancel@synthetic.test');
    const turn = await reserve(owner.user.id, owner.student.id, 'running-rollout');
    const repository = new CoreV2AriaConversationRepository(h.client);
    const claimedAt = new Date(Date.now() - 120_000);
    const leaseExpiresAt = new Date(claimedAt.getTime() + 60_000);
    await repository.claimTurn({
      turnId: turn.turnId, conversationId: turn.conversationId,
      actorUserId: owner.user.id, subjectStudentId: owner.student.id,
      executionToken: 'rollout-cancel-token', now: claimedAt, leaseExpiresAt,
    });
    process.env.CORE_V2_ARIA_CONVERSATION_ENABLED = 'false';
    process.env.CORE_V2_ARIA_RECOVERY_WORKER_ENABLED = 'true';
    signInAs({ id: owner.user.id, role: 'ELEVE' });
    const historyPath = `/api/v2/aria/conversations/${turn.conversationId}/messages`;
    const context = { params: Promise.resolve({ conversationId: turn.conversationId }) };

    const before = await messagesRoute.GET(new NextRequest(`http://localhost:3000${historyPath}`), context);
    expect(before.status).toBe(200);
    const runningHistory = (await before.json()).data;
    expect(runningHistory.conversation.activeTurn).toMatchObject({ turnId: turn.turnId, status: 'RUNNING', clientRequestId });
    expect(runningHistory.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: turn.assistantMessageId, status: 'STREAMING' }),
    ]));

    const cancelled = await call('POST', `/api/v2/aria/turns/${turn.turnId}/cancel`, { clientRequestId }, { turnId: turn.turnId });
    expect(cancelled.status).toBe(202);
    expect(cancelled.body.data).toMatchObject({ status: 'RUNNING', disposition: 'CANCELLATION_REQUESTED' });
    expect((await h.client.ariaConversationTurnCoreV2.findUniqueOrThrow({ where: { id: turn.turnId } })).cancellationRequestedAt).not.toBeNull();

    kickCoreV2AriaRecoveryDrain();
    await stopCoreV2AriaRecoveryScheduler();
    expect((await h.client.ariaConversationTurnCoreV2.findUniqueOrThrow({ where: { id: turn.turnId } })).status).toBe('CANCELLED');
    expect((await h.client.coreV2JobOutbox.findUniqueOrThrow({ where: { idempotencyKey: `aria-turn-watchdog:${turn.turnId}` } })).status).toBe('COMPLETED');
    const after = await messagesRoute.GET(new NextRequest(`http://localhost:3000${historyPath}`), context);
    expect(after.status).toBe(200);
    const finalHistory = (await after.json()).data;
    expect(finalHistory.conversation.activeTurn).toBeNull();
    expect(finalHistory.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: turn.assistantMessageId, status: 'CANCELLED' }),
    ]));
  });

  test('startup rejects enabled conversation without the recovery worker', () => {
    process.env.CORE_V2_ARIA_CONVERSATION_ENABLED = 'true';
    process.env.CORE_V2_ARIA_RECOVERY_WORKER_ENABLED = 'false';
    expect(() => startCoreV2AriaRecoveryScheduler()).toThrow('CORE_V2_ARIA_RECOVERY_WORKER_ENABLED must be enabled');
  });

  test('conversation list is owner scoped and its active Turn uses the client contract', async () => {
    const owner = await seedStudent('owner-list@synthetic.test');
    const other = await seedStudent('other-list@synthetic.test');
    const mine = await reserve(owner.user.id, owner.student.id, 'mine');
    const foreign = await reserve(other.user.id, other.student.id, 'foreign');
    signInAs({ id: owner.user.id, role: 'ELEVE' });
    const result = await call('GET', '/api/v2/aria/conversations');
    expect(result.status).toBe(200);
    expect(result.body.data.items).toEqual([expect.objectContaining({
      id: mine.conversationId,
      activeTurn: expect.objectContaining({ turnId: mine.turnId, clientRequestId, status: 'PENDING', pedagogicalMode: 'DISCOVERY' }),
    })]);
    expect(JSON.stringify(result.body)).not.toContain(foreign.conversationId);
  });

  test('anonymous and a wrong Core v2 role cannot list conversations', async () => {
    signInAs(null);
    expect((await call('GET', '/api/v2/aria/conversations')).status).toBe(401);
    signInAs({ id: h.admin.userId, role: 'ELEVE' });
    expect((await call('GET', '/api/v2/aria/conversations')).status).toBe(403);
  });

  test('cancel refuses anonymous, wrong role and a known foreign Turn without mutating it', async () => {
    const owner = await seedStudent('owner-cancel@synthetic.test');
    const other = await seedStudent('other-cancel@synthetic.test');
    const turn = await reserve(owner.user.id, owner.student.id, 'cancel');
    const path = `/api/v2/aria/turns/${turn.turnId}/cancel`;
    const body = { clientRequestId };
    const params = { turnId: turn.turnId };
    signInAs(null);
    expect((await call('POST', path, body, params)).status).toBe(401);
    signInAs({ id: h.admin.userId, role: 'ELEVE' });
    expect((await call('POST', path, body, params)).status).toBe(403);
    signInAs({ id: other.user.id, role: 'ELEVE' });
    const foreign = await call('POST', path, body, params);
    expect(foreign.status).toBe(404);
    expect(JSON.stringify(foreign.body)).not.toContain(turn.conversationId);
    expect((await h.client.ariaConversationTurnCoreV2.findUniqueOrThrow({ where: { id: turn.turnId } })).status).toBe('PENDING');
  });

  test('cancel response hides the internal execution token of a running Turn', async () => {
    const owner = await seedStudent('running-cancel@synthetic.test');
    const turn = await reserve(owner.user.id, owner.student.id, 'running');
    const repository = new CoreV2AriaConversationRepository(h.client);
    await repository.claimTurn({ turnId: turn.turnId, conversationId: turn.conversationId, actorUserId: owner.user.id, subjectStudentId: owner.student.id, executionToken: 'internal-secret-token', now: new Date('2026-09-26T12:00:01.000Z'), leaseExpiresAt: new Date('2026-09-26T12:02:00.000Z') });
    signInAs({ id: owner.user.id, role: 'ELEVE' });
    const result = await call('POST', `/api/v2/aria/turns/${turn.turnId}/cancel`, { clientRequestId }, { turnId: turn.turnId });
    expect(result.status).toBe(202);
    expect(result.body.data).toMatchObject({ turnId: turn.turnId, status: 'RUNNING', disposition: 'CANCELLATION_REQUESTED' });
    expect(JSON.stringify(result.body)).not.toContain('internal-secret-token');
  });

  test('feedback refuses anonymous, wrong role and known foreign message without creating a row', async () => {
    const owner = await seedStudent('owner-feedback@synthetic.test');
    const other = await seedStudent('other-feedback@synthetic.test');
    const turn = await reserve(owner.user.id, owner.student.id, 'feedback');
    const body = { messageId: turn.assistantMessageId, useful: true };
    signInAs(null);
    expect((await call('POST', '/api/v2/aria/feedback', body)).status).toBe(401);
    signInAs({ id: h.admin.userId, role: 'ELEVE' });
    expect((await call('POST', '/api/v2/aria/feedback', body)).status).toBe(403);
    signInAs({ id: other.user.id, role: 'ELEVE' });
    const foreign = await call('POST', '/api/v2/aria/feedback', body);
    expect(foreign.status).toBe(404);
    expect(JSON.stringify(foreign.body)).not.toContain(turn.assistantMessageId);
    expect(await h.client.ariaFeedbackCoreV2.count()).toBe(0);
  });

  test('feedback accepts only an owned assistant message', async () => {
    const owner = await seedStudent('owned-feedback@synthetic.test');
    const turn = await reserve(owner.user.id, owner.student.id, 'owned-feedback');
    signInAs({ id: owner.user.id, role: 'ELEVE' });

    const userMessage = await call('POST', '/api/v2/aria/feedback', { messageId: turn.userMessageId, useful: true });
    expect(userMessage.status).toBe(404);
    expect(await h.client.ariaFeedbackCoreV2.count()).toBe(0);

    const assistantMessage = await call('POST', '/api/v2/aria/feedback', { messageId: turn.assistantMessageId, useful: false });
    expect(assistantMessage.status).toBe(200);
    expect(assistantMessage.body.data.feedback.useful).toBe(false);
    expect(await h.client.ariaFeedbackCoreV2.count()).toBe(1);
  });
});
