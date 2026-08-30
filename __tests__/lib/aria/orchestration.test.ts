import { prisma } from '@/lib/prisma';
import { streamAriaConversation } from '@/lib/aria/orchestration';
import { buildAriaConversationContext } from '@/lib/aria/application/conversation/public';
import { parseAriaSSEStream, type AriaSSECallbacks } from '@/lib/aria/sse';
import * as gateway from '@/lib/aria/gateway';
import * as rag from '@/lib/aria/rag';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    ariaConversation: { findUnique: jest.fn(), create: jest.fn() },
    ariaMessage: { create: jest.fn(), update: jest.fn() },
    ariaMessageCitation: { createMany: jest.fn() },
  },
}));

jest.mock('@/lib/aria/rag', () => ({
  buildAriaRetrievalPlan: jest.fn(),
  executeAriaRetrieval: jest.fn(),
}));

jest.mock('@/lib/aria/gateway', () => ({
  streamChatCompletion: jest.fn(),
  getAriaDefaultModel: jest.fn().mockReturnValue('gpt-4o'),
}));

describe('ARIA Orchestration Engine (ARIA_GENERATION_PIPELINES=1)', () => {
  const mockPrisma = prisma as unknown as {
    student: { findUnique: jest.Mock };
    ariaConversation: { findUnique: jest.Mock; create: jest.Mock };
    ariaMessage: { create: jest.Mock; update: jest.Mock };
    ariaMessageCitation: { createMany: jest.Mock };
  };

  const studentData = {
    id: 'student-1',
    userId: 'student-user-1',
    gradeLevel: 'TERMINALE',
    academicTrack: 'EDS_GENERALE',
    stmgPathway: null,
    academicEnrollments: [
      { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
    ],
    user: {
      entitlements: [{
        id: 'entitlement-1',
        productCode: 'ARIA_ACCESS',
        status: 'ACTIVE',
        startsAt: new Date('2026-08-01T00:00:00.000Z'),
        endsAt: new Date('2026-09-30T00:00:00.000Z'),
        ariaScopes: [{ kind: 'COURSE', courseKey: 'eds-maths-terminale' }],
      }],
    },
    ariaConversations: [],
    ariaProfile: null,
  };

  async function authorizedContext() {
    mockPrisma.student.findUnique.mockResolvedValueOnce(studentData);
    return buildAriaConversationContext({
      actor: { userId: 'student-user-1', role: 'ELEVE' },
      courseKey: 'eds-maths-terminale',
      now: new Date('2026-08-30T12:00:00.000Z'),
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exécute le cycle complet SSE avec persistance et citations', async () => {
    const context = await authorizedContext();
    mockPrisma.ariaConversation.findUnique.mockResolvedValueOnce(null);
    mockPrisma.ariaConversation.create.mockResolvedValueOnce({
      id: 'conv-123',
      studentId: 'student-1',
      courseKey: 'eds-maths-terminale',
      messages: [],
    });

    mockPrisma.ariaMessage.create
      .mockResolvedValueOnce({ id: 'msg-user-1' }) // User msg
      .mockResolvedValueOnce({ id: 'msg-assistant-1' }); // Assistant msg

    // Mock RAG
    (rag.buildAriaRetrievalPlan as jest.Mock).mockReturnValueOnce({
      courseKey: 'eds-maths-terminale',
    });
    (rag.executeAriaRetrieval as jest.Mock).mockResolvedValueOnce({
      status: 'SUCCESS',
      hits: [
        {
          sourceTitle: 'BO Maths Terminale',
          sourceDocument: 'bo-maths-tle.pdf',
          sourceLocation: 'Page 5',
          courseKey: 'eds-maths-terminale',
          provenance: 'OFFICIEL_MEN',
          snippet: 'Théorème des valeurs intermédiaires',
        },
      ],
    });

    // Mock Gateway stream
    async function* mockStream() {
      yield 'Pour appliquer le TVI, ';
      yield 'vérifie d abord que la fonction est continue.';
    }
    (gateway.streamChatCompletion as jest.Mock).mockReturnValue(mockStream());

    const sseStream = await streamAriaConversation({
      context,
      message: 'Comment utiliser le TVI ?',
    });

    const receivedEvents: string[] = [];
    const deltas: string[] = [];

    const callbacks: AriaSSECallbacks = {
      onStart: () => receivedEvents.push('start'),
      onCitation: () => receivedEvents.push('citation'),
      onDelta: (p) => {
        receivedEvents.push('delta');
        deltas.push(p.text);
      },
      onMetadata: () => receivedEvents.push('metadata'),
      onDone: () => receivedEvents.push('done'),
    };

    await parseAriaSSEStream(sseStream, callbacks);

    expect(receivedEvents).toContain('start');
    expect(receivedEvents).toContain('citation');
    expect(receivedEvents).toContain('delta');
    expect(receivedEvents).toContain('done');
    expect(deltas.join('')).toBe(
      'Pour appliquer le TVI, vérifie d abord que la fonction est continue.'
    );

    // Vérification de la persistance DB
    expect(mockPrisma.ariaMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'msg-assistant-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          content: 'Pour appliquer le TVI, vérifie d abord que la fonction est continue.',
        }),
      })
    );

    expect(mockPrisma.ariaMessageCitation.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          messageId: 'msg-assistant-1',
          sourceTitle: 'BO Maths Terminale',
        }),
      ],
    });
  });

  it('gère l annulation AbortSignal et marque le message CANCELLED', async () => {
    const context = await authorizedContext();
    mockPrisma.ariaConversation.create.mockResolvedValueOnce({
      id: 'conv-123',
      studentId: 'student-1',
      messages: [],
    });
    mockPrisma.ariaMessage.create
      .mockResolvedValueOnce({ id: 'msg-user-1' })
      .mockResolvedValueOnce({ id: 'msg-assistant-1' });
    (rag.buildAriaRetrievalPlan as jest.Mock).mockReturnValueOnce({
      courseKey: 'eds-maths-terminale',
      subject: 'MATHEMATIQUES',
      collection: 'col',
      filters: {},
    });
    (rag.executeAriaRetrieval as jest.Mock).mockResolvedValueOnce({
      status: 'NO_RESULTS',
      hits: [],
    });

    const controller = new AbortController();

    async function* mockStream() {
      yield 'Début de réponse... ';
      controller.abort();
      yield 'cette partie ne sera pas traitée.';
    }
    (gateway.streamChatCompletion as jest.Mock).mockReturnValue(mockStream());

    const sseStream = await streamAriaConversation({
      context,
      message: 'Question interrompue',
      signal: controller.signal,
    });

    let doneStatus = '';
    await parseAriaSSEStream(sseStream, {
      onDone: (p) => {
        doneStatus = p.status;
      },
    });

    expect(doneStatus).toBe('CANCELLED');
    expect(mockPrisma.ariaMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'msg-assistant-1' },
        data: expect.objectContaining({
          status: 'CANCELLED',
          content: 'Début de réponse... ',
        }),
      })
    );
  });
});
