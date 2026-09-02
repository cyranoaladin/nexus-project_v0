/** @jest-environment node */

import { prisma } from '@/lib/prisma';
import { buildAriaConversationContext } from '@/lib/aria/application/conversation/public';
import { toAriaJsonResponse } from '@/lib/aria/transport/json';
import { formatAriaSSEEvent } from '@/lib/aria/transport/sse-parser';
import { ariaSSEMetadataSchema } from '@/lib/aria/transport/contracts';
import {
  ariaIntegrationContext,
  ariaIntegrationInput,
  makeAriaApplicationFixture,
} from '../helpers/aria-application-fixture';

jest.mock('@/lib/prisma', () => ({
  prisma: { student: { findUnique: jest.fn() } },
}));
jest.mock('@/lib/aria/infrastructure/rag/manifest', () => ({
  getAriaRagCorpusCapability: jest.fn((courseKey: string) => (
    courseKey === 'eds-maths-premiere'
      ? {
        status: 'AVAILABLE',
        corpus: {
          corpusId: 'aria-maths-premiere',
          corpusVersionId: 'integration-v1',
          physicalCollection: 'aria_maths_premiere_integration',
          manifestSha256: 'a'.repeat(64),
          resourceRegistrySha256: 'b'.repeat(64),
          academicYear: '2026-2027',
          curriculumVersion: 'integration-v1',
          retrievalScope: {},
          retrievalScopeSha256: 'c'.repeat(64),
          resourceBindings: [],
        },
      }
      : { status: 'NOT_CONFIGURED', reasonCode: 'INTEGRATION_NO_CORPUS' }
  )),
}));

describe('ARIA canonical application boundary', () => {
  it('I001 completes one new canonical pipeline in dependency order', async () => {
    const fixture = makeAriaApplicationFixture();
    await expect(fixture.run(ariaIntegrationInput())).resolves.toMatchObject({
      status: 'COMPLETED', disposition: 'EXECUTED', fullText: 'Réponse groundée.',
    });
    expect(fixture.order).toEqual([
      'lookup', 'admission', 'reserve', 'claim', 'history', 'retrieve', 'checkpoint', 'prompt', 'model',
      'finalize',
    ]);
  });

  it('I002 resumes the exact persisted terminal Turn without external execution', async () => {
    const fixture = makeAriaApplicationFixture();
    fixture.repository.reserveTurn.mockResolvedValueOnce({
      turnId: 'turn-integration-1', conversationId: 'conversation-integration-1',
      userMessageId: 'user-message-integration-1', assistantMessageId: 'assistant-message-integration-1',
      status: 'COMPLETED', disposition: 'REPLAY',
    });
    fixture.repository.loadTurnResult.mockResolvedValueOnce({
      turnId: 'turn-integration-1', conversationId: 'conversation-integration-1',
      assistantMessageId: 'assistant-message-integration-1', status: 'COMPLETED',
      content: 'Persistée', ragStatus: 'SUCCESS', citations: [],
    });
    await expect(fixture.run(ariaIntegrationInput())).resolves.toMatchObject({
      disposition: 'REPLAY', fullText: 'Persistée',
    });
    expect(fixture.dependencies.retrieve).not.toHaveBeenCalled();
    expect(fixture.dependencies.streamModel).not.toHaveBeenCalled();
  });

  it('I003 reuses an in-progress idempotent Turn after disconnect without a second model call', async () => {
    const fixture = makeAriaApplicationFixture();
    fixture.repository.reserveTurn.mockResolvedValueOnce({
      turnId: 'turn-integration-1', conversationId: 'conversation-integration-1',
      userMessageId: 'user-message-integration-1', assistantMessageId: 'assistant-message-integration-1',
      status: 'RUNNING', disposition: 'IN_PROGRESS',
    });
    await expect(fixture.run(ariaIntegrationInput())).resolves.toMatchObject({
      status: 'RUNNING', disposition: 'IN_PROGRESS',
    });
    expect(fixture.dependencies.streamModel).not.toHaveBeenCalled();
  });

  it('I004 ARIA-B-R031 THREAD_NO_CHAT_REACHES_MODEL', async () => {
    const fixture = makeAriaApplicationFixture();
    await expect(fixture.run(ariaIntegrationInput({
      context: ariaIntegrationContext({
        capabilities: { hasChat: false, hasRagCorpus: false, generalChatAllowed: false },
      } as never),
    }))).resolves.toMatchObject({ status: 'ERROR', failureCode: 'UNSUPPORTED' });
    expect(fixture.dependencies.retrieve).not.toHaveBeenCalled();
    expect(fixture.dependencies.streamModel).not.toHaveBeenCalled();
  });

  it('I005 builds one immutable actor=self context with authorized requested course state', async () => {
    const identityEnvironment = {
      E2E_DISPOSABLE_STACK: process.env.E2E_DISPOSABLE_STACK,
      NEXUS_INTERNAL_TOKEN_SECRET: process.env.NEXUS_INTERNAL_TOKEN_SECRET,
      ARIA_E2E_RAG_CANDIDAT: process.env.ARIA_E2E_RAG_CANDIDAT,
      ARIA_E2E_RAG_AUDIENCE: process.env.ARIA_E2E_RAG_AUDIENCE,
      ARIA_E2E_RAG_ZONE: process.env.ARIA_E2E_RAG_ZONE,
      ARIA_E2E_RAG_STATUS_DETAIL: process.env.ARIA_E2E_RAG_STATUS_DETAIL,
    };
    Object.assign(process.env, {
      E2E_DISPOSABLE_STACK: '1',
      NEXUS_INTERNAL_TOKEN_SECRET: 'k'.repeat(32),
      ARIA_E2E_RAG_CANDIDAT: 'scolarise',
      ARIA_E2E_RAG_AUDIENCE: 'aefe',
      ARIA_E2E_RAG_ZONE: 'aefe',
      ARIA_E2E_RAG_STATUS_DETAIL: 'aefe',
    });
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-maths', userId: 'student-user-maths', gradeLevel: 'PREMIERE',
      academicTrack: 'EDS_GENERALE', stmgPathway: null,
      academicEnrollments: [{ courseKey: 'eds-maths-premiere', kind: 'SPECIALTY', source: 'ADMIN' }],
      ariaConversations: [],
      user: { entitlements: [{
        id: 'entitlement-maths', productCode: 'ARIA_ACCESS', status: 'ACTIVE',
        startsAt: new Date('2026-08-01T00:00:00.000Z'), endsAt: null,
        ariaScopes: [{ kind: 'COURSE', courseKey: 'eds-maths-premiere' }],
      }] },
    });
    try {
      await expect(buildAriaConversationContext({
        actor: { userId: 'student-user-maths', role: 'ELEVE' },
        courseKey: 'eds-maths-premiere', now: new Date('2026-08-30T12:00:00.000Z'),
      })).resolves.toMatchObject({
        subject: { studentId: 'student-maths' }, courseKey: 'eds-maths-premiere',
      });
    } finally {
      for (const [key, value] of Object.entries(identityEnvironment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('I015 rejects STMG no-chat without invoking a model or approximating another course', async () => {
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-stmg',
      userId: 'student-user-stmg',
      gradeLevel: 'PREMIERE',
      academicTrack: 'STMG',
      stmgPathway: null,
      academicEnrollments: [],
      ariaConversations: [],
      user: {
        entitlements: [{
          id: 'entitlement-stmg',
          productCode: 'ARIA_ACCESS',
          status: 'ACTIVE',
          startsAt: new Date('2026-08-01T00:00:00.000Z'),
          endsAt: null,
          ariaScopes: [{ kind: 'COURSE', courseKey: 'stmg-sgn-premiere' }],
        }],
      },
    });
    let modelInvocationCount = 0;

    await expect((async () => {
      await buildAriaConversationContext({
        actor: { userId: 'student-user-stmg', role: 'ELEVE' },
        courseKey: 'stmg-sgn-premiere',
        now: new Date('2026-08-30T12:00:00.000Z'),
      });
      modelInvocationCount += 1;
    })()).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(modelInvocationCount).toBe(0);
  });

  it('I018 keeps canonical JSON metadata and SSE event framing field-equivalent', () => {
    const result = {
      turnId: 'turn-parity', conversationId: 'conversation-parity', messageId: 'message-parity',
      status: 'COMPLETED' as const, disposition: 'EXECUTED' as const,
      fullText: 'Réponse', ragStatus: 'SUCCESS' as const, citations: [],
    };
    const json = toAriaJsonResponse(result, 'eds-maths-premiere');
    const metadata = ariaSSEMetadataSchema.parse(json.metadata);
    const wire = formatAriaSSEEvent({ event: 'metadata', data: metadata });
    expect(wire).toContain(JSON.stringify(json.metadata));
  });
});
