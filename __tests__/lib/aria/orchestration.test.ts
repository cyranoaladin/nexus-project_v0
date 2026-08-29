import { prisma } from '@/lib/prisma';
import { streamAriaConversation } from '@/lib/aria/orchestration';
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
    gradeLevel: 'TERMINALE',
    academicTrack: 'EDS_GENERALE',
    academicEnrollments: [
      { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
    ],
    subscriptions: [
      { status: 'ACTIVE', ariaSubjects: ['MATHEMATIQUES'] },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuse une requête si le profil élève n existe pas', async () => {
    mockPrisma.student.findUnique.mockResolvedValueOnce(null);

    await expect(
      streamAriaConversation({
        studentId: 'inconnu',
        message: 'Bonjour',
      })
    ).rejects.toThrow('Profil élève introuvable');
  });

  it('refuse une requête pour un cours hors cursus', async () => {
    mockPrisma.student.findUnique.mockResolvedValueOnce(studentData);

    await expect(
      streamAriaConversation({
        studentId: 'student-1',
        courseKey: 'eds-maths-premiere', // L'élève est en Terminale
        message: 'Dérivation',
      })
    ).rejects.toThrow('ne fait pas partie de votre cursus');
  });

  it('exécute le cycle complet SSE avec persistance et citations', async () => {
    mockPrisma.student.findUnique.mockResolvedValueOnce(studentData);
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
      studentId: 'student-1',
      courseKey: 'eds-maths-terminale',
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
    mockPrisma.student.findUnique.mockResolvedValueOnce(studentData);
    mockPrisma.ariaConversation.create.mockResolvedValueOnce({
      id: 'conv-123',
      studentId: 'student-1',
      messages: [],
    });
    mockPrisma.ariaMessage.create
      .mockResolvedValueOnce({ id: 'msg-user-1' })
      .mockResolvedValueOnce({ id: 'msg-assistant-1' });

    const controller = new AbortController();

    async function* mockStream() {
      yield 'Début de réponse... ';
      controller.abort();
      yield 'cette partie ne sera pas traitée.';
    }
    (gateway.streamChatCompletion as jest.Mock).mockReturnValue(mockStream());

    const sseStream = await streamAriaConversation({
      studentId: 'student-1',
      courseKey: 'eds-maths-terminale',
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
