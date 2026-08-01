import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { Subject } from '@/types/enums';

const mockChatCreate = jest.fn().mockResolvedValue({
  choices: [{ message: { content: 'Réponse intelligente basée sur le contexte' } }],
});

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
          create: mockChatCreate
        }
      };
  };
});

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    ariaConversation: {
        create: jest.fn().mockResolvedValue({ id: 'conv-1' }),
        findUnique: jest.fn()
    },
    ariaMessage: {
        create: jest.fn()
    }
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
    (ragSearch as jest.Mock).mockResolvedValue({
      status: 'success',
      durationMs: 4,
      hits: [
        { id: '1', document: 'Contenu pertinent', metadata: { subject: 'maths' }, distance: 0.1 }
      ],
    });

    const response = await generateAriaResponse('student-1', Subject.MATHEMATIQUES, 'calculer la pente');

    // Verify ragSearch was called
    expect(ragSearch).toHaveBeenCalled();
    // Verify response
    expect(response).toContain("Réponse intelligente");
  });

  it('does not call the model when the knowledge base has a technical failure', async () => {
    const { generateAriaResponse } = await import('@/lib/aria');
    
     // Simulate ragSearch failure
    (ragSearch as jest.Mock).mockResolvedValue({
      status: 'error',
      durationMs: 12,
      hits: [],
      error: { code: 'NETWORK_ERROR' },
    });
    
    const response = await generateAriaResponse('student-1', Subject.MATHEMATIQUES, 'calculer la pente');

    expect(response).toBe(
      'La base documentaire est momentanément indisponible. Je ne peux pas appuyer ma réponse sur les programmes pour le moment. Merci de réessayer dans quelques instants.'
    );
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it('labels a generated response when a successful search has no source', async () => {
    const { generateAriaResponse } = await import('@/lib/aria');
    (ragSearch as jest.Mock).mockResolvedValue({ status: 'empty', durationMs: 3, hits: [] });

    const response = await generateAriaResponse(
      'student-1',
      Subject.MATHEMATIQUES,
      'calculer la pente'
    );

    expect(response).toContain('Cette réponse ne s’appuie sur aucune source du corpus Nexus.');
    expect(response).toContain('Réponse intelligente');
  });
});
