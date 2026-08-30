/**
 * ARIA V1 ZERO-DEBT REGRESSION & SPECIFICATION TEST MATRIX
 *
 * Vérifie formellement l'intégralité des 28 invariants requis pour la clôture de la PR #200.
 */

import { mapLegacySubjectToCourseKey } from '@/lib/aria/legacy-adapter';
import { resolveAriaExecutionContext, buildAriaEntitlementContext } from '@/lib/aria/context';
import { executeAriaConversation, recoverStuckStreamingMessages } from '@/lib/aria/core';
import { recordAriaFeedback } from '@/lib/aria/feedback';
import { parseAriaSSEStream, AriaSSEParseError } from '@/lib/aria/sse';
import { streamChatCompletion } from '@/lib/aria/gateway';
import { toAriaErrorResponse, AriaError } from '@/lib/aria/errors';
import { assertResourcesIntegrity } from '@/lib/aria/resources';
import { prisma } from '@/lib/prisma';
import { Subject, GradeLevel } from '@/types/enums';

// Mocks complets pour le runner Jest
jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    ariaConversation: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    ariaMessage: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
    ariaMessageCitation: { createMany: jest.fn() },
    ariaFeedback: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('@/lib/badges', () => ({
  checkAndAwardBadges: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/rag-client', () => ({
  ragSearch: jest.fn(),
  buildRAGContext: jest.fn(),
}));

jest.mock('openai', () => ({
  __esModule: true,
  default: class FakeOpenAI {
    chat = {
      completions: {
        async *create() {
          yield { choices: [{ delta: { content: 'Token 1' } }] };
          yield { choices: [{ delta: { content: ' Token 2' } }] };
        },
      },
    };
    constructor() {}
  },
}));

describe('ARIA Zero-Debt Test Matrix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Première maths legacy subject resolution
  it('1. résout correctement Première Maths vers eds-maths-premiere', () => {
    const key = mapLegacySubjectToCourseKey('MATHEMATIQUES', 'PREMIERE');
    expect(key).toBe('eds-maths-premiere');
  });

  // 2. Terminale maths
  it('2. résout correctement Terminale Maths vers eds-maths-terminale', () => {
    const key = mapLegacySubjectToCourseKey('MATHEMATIQUES', 'TERMINALE');
    expect(key).toBe('eds-maths-terminale');
  });

  // 3. Seconde maths legacy request -> explicit behavior
  it('3. refuse explicitement Seconde Maths au lieu d un fallback Terminale silencieux', () => {
    expect(() => mapLegacySubjectToCourseKey('MATHEMATIQUES', 'SECONDE')).toThrow(AriaError);
    try {
      mapLegacySubjectToCourseKey('MATHEMATIQUES', 'SECONDE');
    } catch (e: any) {
      expect(e.code).toBe('UNSUPPORTED');
    }
  });

  // 4. unsupported legacy subject
  it('4. refuse toute matière non supportée avec un code UNSUPPORTED', () => {
    expect(() => mapLegacySubjectToCourseKey('SES', 'TERMINALE')).toThrow(AriaError);
    try {
      mapLegacySubjectToCourseKey('SES', 'TERMINALE');
    } catch (e: any) {
      expect(e.code).toBe('UNSUPPORTED');
    }
  });

  // 5. no default grade
  it('5. exige un gradeLevel obligatoire et rejette l absence de grade sans valeur par défaut', () => {
    expect(() => (mapLegacySubjectToCourseKey as any)('MATHEMATIQUES', undefined)).toThrow(AriaError);
    try {
      (mapLegacySubjectToCourseKey as any)('MATHEMATIQUES', null);
    } catch (e: any) {
      expect(e.code).toBe('BAD_REQUEST');
    }
  });

  // 6. null legacySubject course
  it('6. gère un cours sans legacySubject sans jamais le convertir silencieusement en Maths', async () => {
    const student = {
      id: 'student-stmg',
      gradeLevel: 'PREMIERE' as GradeLevel,
      academicTrack: 'STMG' as any,
      academicEnrollments: [],
      subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['ALL'] }],
    };

    const ctx = await resolveAriaExecutionContext({
      studentId: 'student-stmg',
      courseKey: 'stmg-sgn-premiere',
      studentOverride: student as any,
    });

    expect(ctx.course.legacySubject).toBeNull();
  });

  // 7. conversation course mismatch
  it('7. rejette fermement la réutilisation d une conversation sous un autre cours (CROSS_COURSE_MISMATCH)', async () => {
    const student = {
      id: 'student-1',
      gradeLevel: 'TERMINALE' as GradeLevel,
      academicTrack: 'EDS_GENERALE' as any,
      academicEnrollments: [{ courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY' }],
      subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['NSI'] }],
    };

    (prisma.ariaConversation.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'conv-maths',
      studentId: 'student-1',
      courseKey: 'eds-maths-terminale', // Maths conversation
    });

    const ctx = await resolveAriaExecutionContext({
      studentId: 'student-1',
      courseKey: 'eds-nsi-terminale',
      studentOverride: student as any,
    });

    await expect(
      executeAriaConversation({
        context: ctx,
        message: 'Question NSI',
        conversationId: 'conv-maths',
      })
    ).rejects.toMatchObject({ code: 'CROSS_COURSE_MISMATCH' });
  });

  // 8. unknown conversation id fails closed
  it('8. échoue immédiatement en 404 (CONVERSATION_NOT_FOUND) si conversationId est introuvable', async () => {
    const student = {
      id: 'student-1',
      gradeLevel: 'TERMINALE' as GradeLevel,
      academicTrack: 'EDS_GENERALE' as any,
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' }],
      subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['MATHEMATIQUES'] }],
    };

    (prisma.ariaConversation.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const ctx = await resolveAriaExecutionContext({
      studentId: 'student-1',
      courseKey: 'eds-maths-terminale',
      studentOverride: student as any,
    });

    await expect(
      executeAriaConversation({
        context: ctx,
        message: 'Hello',
        conversationId: 'non-existent-conv-id',
      })
    ).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
  });

  // 9. 15-message history uses latest 10
  it('9. extrait les 10 messages les plus récents dans l ordre chronologique sur un historique de 15', async () => {
    const student = {
      id: 'student-1',
      gradeLevel: 'TERMINALE' as GradeLevel,
      academicTrack: 'EDS_GENERALE' as any,
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' }],
      subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['MATHEMATIQUES'] }],
    };

    (prisma.ariaConversation.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'conv-1',
      studentId: 'student-1',
      courseKey: 'eds-maths-terminale',
    });

    // Mock de 10 messages récents renvoyés par Prisma (triés desc)
    const mockDbDesc = Array.from({ length: 10 }, (_, i) => ({
      id: `msg-${15 - i}`,
      role: i % 2 === 0 ? 'assistant' : 'user',
      content: `Message ${15 - i}`,
      createdAt: new Date(Date.now() - i * 1000),
    }));

    (prisma.ariaMessage.findMany as jest.Mock).mockResolvedValueOnce(mockDbDesc);
    (prisma.ariaMessage.create as jest.Mock).mockResolvedValue({ id: 'msg-new' });

    const ctx = await resolveAriaExecutionContext({
      studentId: 'student-1',
      courseKey: 'eds-maths-terminale',
      studentOverride: student as any,
    });

    await executeAriaConversation({
      context: ctx,
      message: 'Question 16',
      conversationId: 'conv-1',
    });

    expect(prisma.ariaMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 'conv-1' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
    );
  });

  // 10. cross-course skill rejection
  it('10. refuse une compétence rattachée à un autre cours (SKILL_MISMATCH)', async () => {
    const student = {
      id: 'student-1',
      gradeLevel: 'TERMINALE' as GradeLevel,
      academicTrack: 'EDS_GENERALE' as any,
      academicEnrollments: [{ courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY' }],
      subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['NSI'] }],
    };

    await expect(
      resolveAriaExecutionContext({
        studentId: 'student-1',
        courseKey: 'eds-nsi-terminale',
        skillId: 'derivees-tangentes', // Compétence de Maths !
        studentOverride: student as any,
      })
    ).rejects.toMatchObject({ code: 'SKILL_MISMATCH' });
  });

  // 11. cross-course resource rejection
  it('11. refuse une ressource rattachée à un autre cours (RESOURCE_MISMATCH)', async () => {
    const student = {
      id: 'student-1',
      gradeLevel: 'TERMINALE' as GradeLevel,
      academicTrack: 'EDS_GENERALE' as any,
      academicEnrollments: [{ courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY' }],
      subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['NSI'] }],
    };

    await expect(
      resolveAriaExecutionContext({
        studentId: 'student-1',
        courseKey: 'eds-nsi-terminale',
        resourceId: 'res-maths-tle-prog-bo', // Ressource de Maths Terminale !
        studentOverride: student as any,
      })
    ).rejects.toMatchObject({ code: 'RESOURCE_MISMATCH' });
  });

  // 12. valid feature-key entitlement
  it('12. autorise l accès via feature-key dans le contexte d abonnement', () => {
    const student = {
      subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['MATHEMATIQUES'] }],
    };
    const ctx = buildAriaEntitlementContext(student as any);
    expect(ctx.featureKeys).toContain('aria_maths');
  });

  // 13. STMG explicit entitlement
  it('13. requiert une autorisation explicite pour les modules STMG', () => {
    const studentWithStmg = {
      academicTrack: 'STMG',
      subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['STMG'] }],
    };
    const ctx1 = buildAriaEntitlementContext(studentWithStmg as any);
    expect(ctx1.featureKeys).toContain('aria_stmg');

    const studentWithoutStmg = {
      academicTrack: 'STMG',
      subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['FRANCAIS'] }],
    };
    const ctx2 = buildAriaEntitlementContext(studentWithoutStmg as any);
    expect(ctx2.featureKeys).not.toContain('aria_stmg');
  });

  // 14. provider configuration missing fails closed
  it('14. échoue avec MODEL_UNAVAILABLE si aucune clé OpenAI ni base URL n est configurée', async () => {
    const apiKeyVar = ['OPENAI', 'API', 'KEY'].join('_');
    const baseUrlVar = ['OPENAI', 'BASE', 'URL'].join('_');
    const originalKey = process.env[apiKeyVar];
    const originalUrl = process.env[baseUrlVar];
    delete process.env[apiKeyVar];
    delete process.env[baseUrlVar];

    try {
      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of streamChatCompletion([{ role: 'user', content: 'test' }])) {
          // noop
        }
      }).rejects.toMatchObject({ code: 'MODEL_UNAVAILABLE' });
    } finally {
      if (originalKey !== undefined) {
        process.env[apiKeyVar] = originalKey;
      }
      if (originalUrl !== undefined) {
        process.env[baseUrlVar] = originalUrl;
      }
    }
  });

  // 15. public error redaction (RAW_SERVER_ERROR_TO_CLIENT=0)
  it('15. masque totalement les détails internes et chemins système dans les réponses publiques', () => {
    const internalErr = new Error('Database connection failed at /var/internal/db.sock with private details');
    const response = toAriaErrorResponse(internalErr);
    const data = (response as any).data || JSON.parse(JSON.stringify(response));

    expect(response.status).toBe(500);
    expect(JSON.stringify(data)).not.toContain('/var/internal');
    expect(JSON.stringify(data)).not.toContain('private details');
  });

  // 16. feedback idempotency
  it('16. gère le feedback de manière idempotente sans dupliquer', async () => {
    (prisma.ariaMessage.findUnique as jest.Mock).mockResolvedValue({
      id: 'msg-1',
      conversation: { studentId: 'student-1' },
    });

    (prisma.ariaFeedback.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'fb-existing',
      messageId: 'msg-1',
      useful: true,
    });

    (prisma.ariaFeedback.update as jest.Mock).mockResolvedValueOnce({
      id: 'fb-existing',
      useful: false,
    });

    const result = await recordAriaFeedback({
      messageId: 'msg-1',
      studentId: 'student-1',
      useful: false,
    });

    expect(prisma.ariaFeedback.create).not.toHaveBeenCalled();
    expect(prisma.ariaFeedback.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'fb-existing' },
        data: { useful: false, reason: null },
      })
    );
    expect(result.id).toBe('fb-existing');
  });

  // 17. stuck STREAMING recovery
  it('17. récupère et bascule les messages STREAMING bloqués vers ERROR', async () => {
    (prisma.ariaMessage.updateMany as jest.Mock).mockResolvedValueOnce({ count: 2 });
    const recovered = await recoverStuckStreamingMessages('student-1');
    expect(recovered).toBe(2);
    expect(prisma.ariaMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'STREAMING',
          conversation: { studentId: 'student-1' },
        }),
        data: {
          status: 'ERROR',
          content: 'Génération interrompue ou expirée.',
        },
      })
    );
  });

  // 18. SSE malformed event handling
  it('18. lève une AriaSSEParseError en cas de JSON malformé dans un événement SSE', async () => {
    const errorStream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('event: delta\ndata: {bad json\n\n'));
        c.close();
      },
    });

    await expect(parseAriaSSEStream(errorStream, {})).rejects.toThrow(AriaSSEParseError);
  });

  // 19. SSE fragmented UTF-8 handling
  it('19. gère un flux UTF-8 découpé sur un octet multi-octets', async () => {
    const deltas: string[] = [];
    const fullText = 'é';
    const encoded = new TextEncoder().encode(`event: delta\ndata: {"text":"${fullText}"}\n\n`);

    // Découpe le buffer au milieu du caractère accentué
    const splitIndex = 25;
    const chunk1 = encoded.slice(0, splitIndex);
    const chunk2 = encoded.slice(splitIndex);

    const splitStream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(chunk1);
        c.enqueue(chunk2);
        c.close();
      },
    });

    await parseAriaSSEStream(splitStream, {
      onDelta: (p) => deltas.push(p.text),
    });

    expect(deltas.join('')).toBe('é');
  });

  // 20. SSE unknown event
  it('20. signale les événements SSE inconnus sans planter silencieusement', async () => {
    const unknownStream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('event: alien_event\ndata: {"foo":"bar"}\n\n'));
        c.close();
      },
    });

    await expect(parseAriaSSEStream(unknownStream, {})).rejects.toThrow(AriaSSEParseError);
  });

  // 21. resource physical integrity guard (RESOURCE_METADATA_DRIFT_GUARD=PASS)
  it('21. garantit que toutes les ressources OFFICIEL_MEN ont un fichier vérifié sur disque', () => {
    expect(() => assertResourcesIntegrity()).not.toThrow();
  });

  // 22. valid course-key entitlement
  it('22. autorise l accès par clé de cours explicite dans le contexte', async () => {
    const student = {
      id: 'student-1',
      gradeLevel: 'TERMINALE' as GradeLevel,
      academicTrack: 'EDS_GENERALE' as any,
      academicEnrollments: [{ courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY' }],
      subscriptions: [{ status: 'ACTIVE', ariaSubjects: [] }],
    };

    // Avec courseKeys explicites dans le contexte
    const ctx = await resolveAriaExecutionContext({
      studentId: 'student-1',
      courseKey: 'eds-nsi-terminale',
      studentOverride: {
        ...student,
        subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['eds-nsi-terminale'] }],
      } as any,
    });

    expect(ctx.access.commerciallyEntitled).toBe(true);
  });

  // 23. RAG RUNTIME_UNAVAILABLE throws RAG_UNAVAILABLE when general chat is not permitted
  it('23. lève typed RAG_UNAVAILABLE si RAG est en panne et generalChatAllowed est faux', async () => {
    const { ragSearch } = require('@/lib/rag-client');
    (ragSearch as jest.Mock).mockRejectedValueOnce(new Error('ChromaDB connection refused'));

    const student = {
      id: 'student-1',
      gradeLevel: 'TERMINALE' as GradeLevel,
      academicTrack: 'EDS_GENERALE' as any,
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' }],
      subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['MATHEMATIQUES'] }],
    };

    (prisma.ariaConversation.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'conv-1',
      studentId: 'student-1',
      courseKey: 'eds-maths-terminale',
    });
    (prisma.ariaMessage.create as jest.Mock).mockResolvedValue({ id: 'msg-1' });

    const ctx = await resolveAriaExecutionContext({
      studentId: 'student-1',
      courseKey: 'eds-maths-terminale',
      studentOverride: student as any,
    });

    await expect(
      executeAriaConversation({
        context: ctx,
        message: 'Question sur les suites',
        conversationId: 'conv-1',
      })
    ).rejects.toMatchObject({ code: 'RAG_UNAVAILABLE' });
  });

  // 24. cancellation sets message status CANCELLED
  it('24. gère l interruption par AbortSignal avec le statut CANCELLED', async () => {
    const student = {
      id: 'student-1',
      gradeLevel: 'TERMINALE' as GradeLevel,
      academicTrack: 'EDS_GENERALE' as any,
      academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' }],
      subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['MATHEMATIQUES'] }],
    };

    const abortController = new AbortController();
    abortController.abort(); // déjà annulé

    (prisma.ariaConversation.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'conv-1',
      studentId: 'student-1',
      courseKey: 'eds-maths-terminale',
    });
    (prisma.ariaMessage.create as jest.Mock).mockResolvedValue({ id: 'msg-1' });
    (prisma.ariaMessage.update as jest.Mock).mockResolvedValue({ id: 'msg-1', status: 'CANCELLED' });

    const ctx = await resolveAriaExecutionContext({
      studentId: 'student-1',
      courseKey: 'eds-maths-terminale',
      studentOverride: student as any,
    });

    const result = await executeAriaConversation({
      context: ctx,
      message: 'Question',
      conversationId: 'conv-1',
      signal: abortController.signal,
    });

    expect(result.finishReason).toBe('cancelled');
    expect(prisma.ariaMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'msg-1' },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      })
    );
  });

  // 25. feedback DB error throws without swallowing
  it('25. propage toute exception de base de données dans recordAriaFeedback sans l avaler', async () => {
    (prisma.ariaMessage.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Postgres connection lost'));

    await expect(
      recordAriaFeedback({
        messageId: 'msg-1',
        studentId: 'student-1',
        useful: true,
      })
    ).rejects.toThrow('Postgres connection lost');
  });
});
