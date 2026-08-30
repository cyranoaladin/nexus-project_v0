import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { Subject } from '@/types/enums';

// Mock OpenAI
jest.mock('openai', () => {
  return class OpenAI {
      embeddings = {
        create: jest.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }] // Fake embedding
        })
      };
      chat = {
        completions: {
          create: jest.fn().mockImplementation(async (opts) => {
            if (opts?.stream) {
              async function* gen() {
                yield { choices: [{ delta: { content: "Réponse intelligente basée sur le contexte" } }] };
              }
              return gen();
            }
            return {
              choices: [{ message: { content: "Réponse intelligente basée sur le contexte" } }]
            };
          })
        }
      };
  };
});

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'student-1',
        gradeLevel: 'TERMINALE',
        academicTrack: 'EDS_GENERALE',
        academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' }],
        subscriptions: [{ status: 'ACTIVE', ariaSubjects: ['MATHEMATIQUES'] }],
      }),
    },
    ariaConversation: {
      create: jest.fn().mockResolvedValue({ id: 'conv-1' }),
      findUnique: jest.fn(),
    },
    ariaMessage: {
      create: jest.fn().mockResolvedValue({ id: 'msg-assistant-1', createdAt: new Date() }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'msg-1', status: 'COMPLETED' }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ariaMessageCitation: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  }
}));

// Mock rag-client
jest.mock('@/lib/rag-client', () => ({
  ragSearch: jest.fn(),
  buildRAGContext: jest.fn().mockReturnValue('Contexte de test'),
}));

import { ragSearch } from '@/lib/rag-client';

describe('ARIA Intelligence Vector Check', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-fake-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use knowledge base when available', async () => {
    // Dynamic import
    const { generateAriaResponse } = await import('@/lib/aria');

    // Setup mock return for ragSearch
    (ragSearch as jest.Mock).mockResolvedValue([
      { id: '1', document: 'Contenu pertinent', metadata: { subject: 'maths' }, distance: 0.1 }
    ]);

    const response = await generateAriaResponse('student-1', Subject.MATHEMATIQUES, 'calculer la pente');

    // Verify ragSearch was called
    expect(ragSearch).toHaveBeenCalled();
    // Verify response
    expect(response).toContain("Réponse intelligente");
  });

  it('should fail closed with typed RAG_UNAVAILABLE when knowledge base search fails on required course', async () => {
    const { generateAriaResponse } = await import('@/lib/aria');
    
    // Simulate ragSearch failure
    (ragSearch as jest.Mock).mockRejectedValue(new Error('rag error'));
    
    await expect(
      generateAriaResponse('student-1', Subject.MATHEMATIQUES, 'calculer la pente')
    ).rejects.toMatchObject({ code: 'RAG_UNAVAILABLE' });
  });
});
