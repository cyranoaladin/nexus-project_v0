import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { auth } from '@/auth';
import { seedAcademicYear, setupServiceHarness } from '../helpers/service-harness';
import * as messagesRoute from '@/app/api/v2/aria/conversations/[conversationId]/messages/route';
import * as curriculumRoute from '@/app/api/v2/aria/curriculum/route';

const h = setupServiceHarness();
const mockedAuth = auth as unknown as jest.Mock;
const createdAt = new Date('2026-09-24T10:00:00.000Z');

function signIn(userId: string | null) {
  mockedAuth.mockResolvedValue(userId ? {
    user: { id: userId, role: 'ELEVE', email: 'student@synthetic.test' }, expires: '2099-01-01',
  } : null);
}

async function seedStudent(suffix: string, yearId: string) {
  const user = await h.client.user.create({ data: { role: 'ELEVE', email: `history-${suffix}@synthetic.test`, accountStatus: 'ACTIVE' } });
  const household = await h.client.household.create({ data: {} });
  const student = await h.client.student.create({ data: { userId: user.id, householdId: household.id } });
  await h.client.studentAcademicYearEnrollment.create({ data: {
    studentId: student.id, academicYearId: yearId, status: 'ACTIVE', gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE',
  } });
  return { user, student };
}

function historyRequest(conversationId: string, cursor?: string) {
  const url = new URL(`http://localhost:3000/api/v2/aria/conversations/${conversationId}/messages`);
  url.searchParams.set('limit', '50');
  if (cursor) url.searchParams.set('cursor', cursor);
  return messagesRoute.GET(new NextRequest(url), { params: Promise.resolve({ conversationId }) });
}

describe('Core v2 ARIA history HTTP projection', () => {
  test('curriculum focuses the course of an active Turn so reload reconnects without a second course selection', async () => {
    const year = await seedAcademicYear(h.client, 2026);
    const owner = await seedStudent('focused', year.id);
    const enrollment = await h.client.studentAcademicYearEnrollment.findFirstOrThrow({
      where: { studentId: owner.student.id, academicYearId: year.id },
    });
    await h.client.studentCourseEnrollment.create({ data: {
      academicYearEnrollmentId: enrollment.id, courseKey: 'eds-maths-terminale', kind: 'SPECIALTY',
    } });
    await h.client.ariaAccessGrant.create({ data: {
      studentId: owner.student.id, featureKey: 'aria_maths', ariaTier: 'ARIA_ACCOMPAGNEE',
      courseScopes: ['maths-terminale-eds'], status: 'ACTIVE', startsAt: new Date('2026-09-01T00:00:00.000Z'),
      source: 'disposable-test',
    } });
    const conversation = await h.client.ariaConversationCoreV2.create({ data: {
      studentId: owner.student.id, courseKey: 'maths-terminale-eds',
    } });
    await h.client.ariaConversationTurnCoreV2.create({ data: {
      conversationId: conversation.id, subjectStudentId: owner.student.id, actorUserId: owner.user.id,
      useCase: 'CONVERSATION', clientRequestId: '00000000-0000-4000-8000-000000000101',
      requestFingerprint: 'a'.repeat(64), sequence: 1, status: 'RUNNING',
      executionToken: '<test-execution-token-placeholder>', heartbeatAt: createdAt,
      leaseExpiresAt: new Date(createdAt.getTime() + 60_000), startedAt: createdAt,
      academicSnapshot: {}, pedagogicalMode: 'DISCOVERY', agentRole: 'TUTOR', modelPolicy: {},
    } });
    signIn(owner.user.id);

    const response = await curriculumRoute.GET(new NextRequest('http://localhost:3000/api/v2/aria/curriculum'), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);
    expect((await response.json()).data.profile.focusedCourseKey).toBe('maths-terminale-eds');

    await h.client.ariaConversationTurnCoreV2.updateMany({
      where: { conversationId: conversation.id },
      data: { status: 'COMPLETED', completedAt: createdAt },
    });
    const completed = await curriculumRoute.GET(new NextRequest('http://localhost:3000/api/v2/aria/curriculum'), { params: Promise.resolve({}) });
    expect((await completed.json()).data.profile.focusedCourseKey).toBe('maths-terminale-eds');

    await h.client.ariaAccessGrant.updateMany({ where: { studentId: owner.student.id }, data: { status: 'REVOKED' } });
    const revoked = await curriculumRoute.GET(new NextRequest('http://localhost:3000/api/v2/aria/curriculum'), { params: Promise.resolve({}) });
    expect(revoked.status).toBe(200);
    expect((await revoked.json()).data.profile.focusedCourseKey).toBeNull();
  });

  test('keyset pages return all 54 messages exactly once, the active Turn and student-owned feedback', async () => {
    const year = await seedAcademicYear(h.client, 2026);
    const owner = await seedStudent('owner', year.id);
    const other = await seedStudent('other', year.id);
    const conversation = await h.client.ariaConversationCoreV2.create({ data: { studentId: owner.student.id, courseKey: 'philosophie-terminale' } });
    const turns = Array.from({ length: 27 }, (_, index) => ({
      id: `history-turn-${String(index).padStart(2, '0')}`,
      conversationId: conversation.id,
      subjectStudentId: owner.student.id,
      actorUserId: owner.user.id,
      useCase: 'CONVERSATION' as const,
      clientRequestId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      requestFingerprint: 'a'.repeat(64),
      sequence: index + 1,
      status: index === 26 ? 'RUNNING' as const
        : index === 0 ? 'ERROR' as const
          : index === 1 ? 'CANCELLED' as const : 'COMPLETED' as const,
      ...(index === 26 ? {
        executionToken: '<test-execution-token-placeholder>', heartbeatAt: createdAt,
        leaseExpiresAt: new Date(createdAt.getTime() + 60_000), startedAt: createdAt,
      } : { completedAt: createdAt }),
      academicSnapshot: {}, pedagogicalMode: 'DISCOVERY', agentRole: 'TUTOR', modelPolicy: {},
    }));
    await h.client.ariaConversationTurnCoreV2.createMany({ data: turns });
    const messageIds: string[] = [];
    const messages = turns.flatMap((turn, index) => (['USER', 'ASSISTANT'] as const).map((role, offset) => {
      const id = `history-message-${String(index * 2 + offset).padStart(3, '0')}`;
      messageIds.push(id);
      return {
        id, conversationId: conversation.id, turnId: turn.id, role,
        content: role === 'USER' ? `Question ${index}` : index === 26 ? '' : `Réponse ${index}`,
        // Shared timestamp on either side of the page boundary exercises the (createdAt, id) tie-breaker.
        createdAt: new Date(createdAt.getTime() + Math.floor((index * 2 + offset) / 4) * 1_000),
      };
    }));
    await h.client.ariaMessageCoreV2.createMany({ data: messages });
    await h.client.ariaFeedbackCoreV2.createMany({ data: [
      { messageId: messageIds[49]!, studentId: owner.student.id, useful: true },
      { messageId: messageIds[49]!, studentId: other.student.id, useful: false },
    ] });

    signIn(owner.user.id);
    const firstResponse = await historyRequest(conversation.id);
    expect(firstResponse.status).toBe(200);
    const first = (await firstResponse.json()).data;
    expect(first.messages).toHaveLength(50);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(first.conversation.activeTurn).toEqual({
      turnId: turns[26]!.id,
      clientRequestId: turns[26]!.clientRequestId,
      status: 'RUNNING',
      pedagogicalMode: 'DISCOVERY',
    });
    expect(first.messages.find((message: { id: string }) => message.id === messageIds[49])).toMatchObject({ feedback: true });

    const secondResponse = await historyRequest(conversation.id, first.nextCursor);
    expect(secondResponse.status).toBe(200);
    const second = (await secondResponse.json()).data;
    expect(second.nextCursor).toBeNull();
    const all = [...first.messages, ...second.messages];
    expect(all.map((message: { id: string }) => message.id)).toEqual(messageIds);
    expect(new Set(all.map((message: { id: string }) => message.id)).size).toBe(54);
    expect(all[1]).toMatchObject({ role: 'ASSISTANT', status: 'ERROR' });
    expect(all[3]).toMatchObject({ role: 'ASSISTANT', status: 'CANCELLED' });
    expect(all[5]).toMatchObject({ role: 'ASSISTANT', status: 'COMPLETED' });
    expect(all.at(-1)).toMatchObject({ role: 'ASSISTANT', status: 'STREAMING' });
    expect(all.at(-2)).toMatchObject({ role: 'USER', status: 'COMPLETED' });

    signIn(other.user.id);
    const foreign = await historyRequest(conversation.id);
    expect(foreign.status).toBe(404);
    expect(JSON.stringify(await foreign.json())).not.toContain(messageIds[49]!);

    signIn(null);
    expect((await historyRequest(conversation.id)).status).toBe(401);
    signIn(h.admin.userId);
    expect((await historyRequest(conversation.id)).status).toBe(403);
  });

  test('derives pending, running and cancelled assistant status from the same Turn', async () => {
    const year = await seedAcademicYear(h.client, 2026);
    const owner = await seedStudent('lifecycle', year.id);
    const conversation = await h.client.ariaConversationCoreV2.create({ data: { studentId: owner.student.id, courseKey: 'philosophie-terminale' } });
    const turn = await h.client.ariaConversationTurnCoreV2.create({ data: {
      conversationId: conversation.id, subjectStudentId: owner.student.id, actorUserId: owner.user.id,
      useCase: 'CONVERSATION', clientRequestId: '00000000-0000-4000-8000-000000000100',
      requestFingerprint: 'a'.repeat(64), sequence: 1,
      academicSnapshot: {}, pedagogicalMode: 'DISCOVERY', agentRole: 'TUTOR', modelPolicy: {},
    } });
    await h.client.ariaMessageCoreV2.createMany({ data: [
      { id: 'lifecycle-user', conversationId: conversation.id, turnId: turn.id, role: 'USER', content: 'Question', createdAt },
      { id: 'lifecycle-assistant', conversationId: conversation.id, turnId: turn.id, role: 'ASSISTANT', content: '', createdAt: new Date(createdAt.getTime() + 1_000) },
    ] });
    signIn(owner.user.id);

    const pending = (await (await historyRequest(conversation.id)).json()).data;
    expect(pending.messages.map((message: { status: string }) => message.status)).toEqual(['COMPLETED', 'PENDING']);
    expect(pending.conversation.activeTurn).toMatchObject({ turnId: turn.id, status: 'PENDING' });

    await h.client.ariaConversationTurnCoreV2.update({ where: { id: turn.id }, data: {
      status: 'RUNNING', executionToken: 'disposable-test-token', heartbeatAt: createdAt,
      leaseExpiresAt: new Date(createdAt.getTime() + 60_000), startedAt: createdAt,
    } });
    const running = (await (await historyRequest(conversation.id)).json()).data;
    expect(running.messages.map((message: { status: string }) => message.status)).toEqual(['COMPLETED', 'STREAMING']);
    expect(running.conversation.activeTurn).toMatchObject({ turnId: turn.id, status: 'RUNNING' });

    await h.client.ariaConversationTurnCoreV2.update({ where: { id: turn.id }, data: {
      status: 'CANCELLED', completedAt: new Date(createdAt.getTime() + 2_000),
    } });
    const cancelled = (await (await historyRequest(conversation.id)).json()).data;
    expect(cancelled.messages.map((message: { status: string }) => message.status)).toEqual(['COMPLETED', 'CANCELLED']);
    expect(cancelled.conversation.activeTurn).toBeNull();
  });
});
