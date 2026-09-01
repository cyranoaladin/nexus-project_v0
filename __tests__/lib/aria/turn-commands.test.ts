import {
  fingerprintAriaTurnRequest,
  makeReserveAriaConversationTurn,
} from '@/lib/aria/application/conversation/reserve-turn';
import { makeClaimAriaConversationTurn } from '@/lib/aria/application/conversation/claim-turn';
import { makeCancelAriaConversationTurn } from '@/lib/aria/application/conversation/cancel-turn';
import type { AriaConversationRepository } from '@/lib/aria/application/conversation/ports';
import type { AriaConversationContext } from '@/lib/aria/application/conversation/build-context';
import {
  registerAriaTurnCancellation,
  unregisterAriaTurnCancellation,
} from '@/lib/aria/application/conversation/cancellation-registry';

const baseContext = {
  actor: { userId: 'user-1', role: 'STUDENT' },
  subject: { studentId: 'student-1' },
  student: {
    id: 'student-1',
    gradeLevel: 'PREMIERE',
    academicTrack: 'EDS_GENERALE',
  },
  courseKey: 'eds-maths-premiere',
  conversation: null,
} as unknown as AriaConversationContext;

function repository(): jest.Mocked<AriaConversationRepository> {
  return {
    findTurnReservation: jest.fn(),
    reserveTurn: jest.fn(),
    claimTurn: jest.fn(),
    loadRecentCompletedTurns: jest.fn(),
    checkpointRetrieval: jest.fn(),
    finalizeTurn: jest.fn(),
    loadTurnResult: jest.fn(),
    requestCancellation: jest.fn(),
    heartbeatTurn: jest.fn(),
  };
}

describe('ARIA Turn application commands', () => {
  it('fingerprints every generation-relevant field with stable explicit defaults', () => {
    const defaults = fingerprintAriaTurnRequest({
      context: baseContext,
      clientRequestId: 'request-1',
      message: 'Question',
    });
    const explicitDefaults = fingerprintAriaTurnRequest({
      context: baseContext,
      clientRequestId: 'request-1',
      message: 'Question',
      pedagogicalMode: 'DISCOVERY',
      agentRole: 'TUTOR',
    });
    expect(defaults).toBe(explicitDefaults);
    expect(fingerprintAriaTurnRequest({
      context: baseContext,
      clientRequestId: 'request-1',
      message: 'Autre question',
    })).not.toBe(defaults);

    const resourceContext = {
      ...baseContext,
      resourceId: 'resource-1',
      resourceVersionId: 'resource-version-1',
    } as unknown as AriaConversationContext;
    expect(fingerprintAriaTurnRequest({
      context: resourceContext,
      clientRequestId: 'request-1',
      message: 'Question',
    })).not.toBe(fingerprintAriaTurnRequest({
      context: {
        ...resourceContext,
        resourceVersionId: 'resource-version-2',
      } as AriaConversationContext,
      clientRequestId: 'request-1',
      message: 'Question',
    }));
  });

  it('reserves with a complete academic snapshot and caller-provided execution policy', async () => {
    const repo = repository();
    repo.reserveTurn.mockResolvedValue({
      turnId: 'turn-1', conversationId: 'conversation-1', userMessageId: 'user-message-1',
      assistantMessageId: 'assistant-message-1', status: 'PENDING', disposition: 'RESERVED',
    });
    const now = new Date('2026-08-30T12:00:00.000Z');
    const context = {
      ...baseContext,
      conversation: { id: 'conversation-1' },
      skillId: 'skill-1',
      resourceId: 'resource-1',
      resourceVersionId: 'resource-version-1',
      student: {
        ...baseContext.student,
        stmgPathway: null,
        academicEnrollments: [{
          courseKey: 'eds-maths-premiere', kind: 'SPECIALTY', source: 'ADMIN',
        }],
      },
    } as unknown as AriaConversationContext;
    await makeReserveAriaConversationTurn(repo)({
      context,
      clientRequestId: 'request-1',
      message: 'Question',
      pedagogicalMode: 'METHODOLOGY',
      agentRole: 'TUTOR',
      modelPolicy: { policyId: 'POLICY_TEST' },
      now,
    });
    expect(repo.reserveTurn).toHaveBeenCalledWith(expect.objectContaining({
      requestedConversationId: 'conversation-1',
      skillId: 'skill-1',
      resourceId: 'resource-1',
      pedagogicalMode: 'METHODOLOGY',
      agentRole: 'TUTOR',
      modelPolicy: { policyId: 'POLICY_TEST' },
      now,
      academicSnapshot: expect.objectContaining({
        gradeLevel: 'PREMIERE',
        academicEnrollments: [{
          courseKey: 'eds-maths-premiere', kind: 'SPECIALTY', source: 'ADMIN',
        }],
      }),
    }));
  });

  it('applies reservation defaults without inventing academic enrollments', async () => {
    const repo = repository();
    repo.reserveTurn.mockResolvedValue({
      turnId: 'turn-1', conversationId: 'conversation-1', userMessageId: 'user-message-1',
      assistantMessageId: 'assistant-message-1', status: 'PENDING', disposition: 'RESERVED',
    });
    await makeReserveAriaConversationTurn(repo)({
      context: baseContext,
      clientRequestId: 'request-1',
      message: 'Question',
    });
    expect(repo.reserveTurn).toHaveBeenCalledWith(expect.objectContaining({
      requestedConversationId: undefined,
      pedagogicalMode: 'DISCOVERY',
      agentRole: 'TUTOR',
      modelPolicy: { policyId: 'ARIA_CHAT_DEFAULT_V1' },
      now: expect.any(Date),
      academicSnapshot: expect.objectContaining({ academicEnrollments: [] }),
    }));
  });

  it('claims only with an explicit or authorized stored conversation identity', async () => {
    const repo = repository();
    repo.claimTurn.mockResolvedValue({
      turnId: 'turn-1', conversationId: 'conversation-1', status: 'RUNNING',
      executionToken: 'token-1', leaseExpiresAt: new Date(), disposition: 'CLAIMED',
    });
    const claim = makeClaimAriaConversationTurn(repo);
    const now = new Date('2026-08-30T12:00:00.000Z');
    await claim({ context: baseContext, turnId: 'turn-1', conversationId: 'conversation-1', now });
    await claim({
      context: { ...baseContext, conversation: { id: 'conversation-2' } } as never,
      turnId: 'turn-2',
    });
    expect(repo.claimTurn.mock.calls.map(([input]) => input.conversationId))
      .toEqual(['conversation-1', 'conversation-2']);
    await expect(claim({ context: baseContext, turnId: 'turn-missing' }))
      .rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(repo.claimTurn).toHaveBeenCalledTimes(2);
  });

  it('requests durable cancellation and signals only the matching local execution', async () => {
    const repo = repository();
    repo.requestCancellation
      .mockResolvedValueOnce({
        turnId: 'turn-1', conversationId: 'conversation-1', status: 'RUNNING',
        disposition: 'CANCELLATION_REQUESTED',
        executionToken: 'token-1',
      })
      .mockResolvedValueOnce({
        turnId: 'turn-2', conversationId: 'conversation-2', status: 'COMPLETED',
        disposition: 'TERMINAL_REPLAY',
      });
    const signal = registerAriaTurnCancellation('turn-1', 'token-1');
    const cancel = makeCancelAriaConversationTurn(repo);
    const now = new Date('2026-08-30T12:00:00.000Z');
    await cancel({
      actor: { userId: 'user-1', role: 'ELEVE' }, turnId: 'turn-1',
      clientRequestId: 'request-1', now,
    });
    expect(signal.aborted).toBe(true);
    await cancel({
      actor: { userId: 'user-1', role: 'ELEVE' }, turnId: 'turn-2',
      clientRequestId: 'request-2',
    });
    expect(repo.requestCancellation).toHaveBeenNthCalledWith(1, expect.objectContaining({ now }));
    expect(repo.requestCancellation).toHaveBeenNthCalledWith(2, expect.objectContaining({
      now: expect.any(Date),
    }));
    unregisterAriaTurnCancellation('turn-1', 'token-1');
  });
});
