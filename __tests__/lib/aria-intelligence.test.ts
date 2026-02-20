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
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: "Réponse intelligente basée sur le contexte" } }]
          })
        }
      };
  };
});

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    pedagogicalContent: {
      findMany: jest.fn()
    },
    ariaConversation: {
        create: jest.fn().mockResolvedValue({ id: 'conv-1' }),
        findUnique: jest.fn()
    },
    ariaMessage: {
        create: jest.fn()
    }
  }
}));

describe('ARIA Intelligence Vector Check', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-fake-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use vector search when embedding is successful', async () => {
    // Dynamic import to pick up env vars if needed, though generateEmbedding checks at runtime
    const { generateAriaResponse } = await import('@/lib/aria');

    // Setup mock return for vector search
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { id: '1', title: "Taux d'accroissement", content: 'Contenu pertinent', similarity: 0.95 }
    ]);

    const response = await generateAriaResponse('student-1', Subject.MATHEMATIQUES, 'calculer la pente');

    // Verify vector search was called
    expect(prisma.$queryRaw).toHaveBeenCalled();
    // Verify response
    expect(response).toContain("Réponse intelligente");
  });

  it('should fallback to keyword search if vector search fails', async () => {
    const { generateAriaResponse } = await import('@/lib/aria');
    
     // Simulate vector search failure
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('pgvector error'));
    
    // Setup fallback return
    (prisma.pedagogicalContent.findMany as jest.Mock).mockResolvedValue([
        { id: '2', title: 'Derivee', content: 'Contenu fallback' }
    ]);

    const response = await generateAriaResponse('student-1', Subject.MATHEMATIQUES, 'calculer la pente');

    // Verify fallback was called
    expect(prisma.pedagogicalContent.findMany).toHaveBeenCalled();
  });
});
