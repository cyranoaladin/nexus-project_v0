/**
 * ARIA AI Assistant — Complete Test Suite
 *
 * Tests: generateAriaResponse, generateAriaStream, saveAriaConversation,
 *        recordAriaFeedback, generateEmbedding, searchKnowledgeBase
 *
 * Source: lib/aria.ts
 */

const mockStreamChunks = [
  { choices: [{ delta: { content: 'Bonjour' } }] },
  { choices: [{ delta: { content: ' élève' } }] },
  { choices: [{ delta: { content: '!' } }] },
];

if (!globalThis.ReadableStream) {
  (globalThis as any).ReadableStream = require('stream/web').ReadableStream;
}

jest.mock('openai', () => ({
  __esModule: true,
  default: class FakeOpenAI {
    chat = {
      completions: {
        async create(opts: any) {
          if (opts.stream) {
            async function* gen() {
              for (const chunk of mockStreamChunks) {
                yield chunk;
              }
            }
            return gen();
          }
          return { choices: [{ message: { content: 'Réponse ARIA test' } }] };
        },
      },
    };
    embeddings = {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      }),
    };
    constructor() {}
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    pedagogicalContent: { findMany: jest.fn() },
    ariaConversation: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    ariaMessage: {
      create: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

import {
  generateAriaResponse,
  generateAriaStream,
  saveAriaConversation,
  recordAriaFeedback,
  generateEmbedding,
} from '@/lib/aria';
import { prisma } from '@/lib/prisma';

async function readStream(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value);
  }
  return result;
}

// ─── generateAriaResponse ────────────────────────────────────────────────────

function resetPrismaMocks() {
  (prisma.pedagogicalContent.findMany as jest.Mock).mockClear();
  (prisma.pedagogicalContent.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.ariaConversation.findUnique as jest.Mock).mockClear();
  (prisma.ariaConversation.create as jest.Mock).mockClear();
  (prisma.ariaMessage.create as jest.Mock).mockClear();
  (prisma.ariaMessage.update as jest.Mock).mockClear();
}

describe('generateAriaResponse', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('should return a non-empty string response from LLM', async () => {
    // Act
    const result = await generateAriaResponse('student-1', 'MATHEMATIQUES' as any, 'Explique les dérivées');

    // Assert
    expect(typeof result).toBe('string');
    expect(result).toBe('Réponse ARIA test');
  });

  it('should use knowledge base context when results exist', async () => {
    // Arrange: knowledge base returns content
    (prisma.pedagogicalContent.findMany as jest.Mock).mockResolvedValue([
      { title: 'Dérivées', content: 'La dérivée mesure le taux de variation...', similarity: 0 },
    ]);

    // Act
    const result = await generateAriaResponse('student-1', 'MATHEMATIQUES' as any, 'Explique les dérivées');

    // Assert: should still return a valid response
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Verify knowledge base was queried
    expect(prisma.pedagogicalContent.findMany).toHaveBeenCalled();
  });

  it('should handle conversation history without error', async () => {
    // Arrange
    const history = [
      { role: 'user', content: 'Bonjour' },
      { role: 'assistant', content: 'Bonjour! Comment puis-je t\'aider?' },
    ];

    // Act
    const result = await generateAriaResponse('student-1', 'NSI' as any, 'Explique les boucles', history);

    // Assert
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should return user-friendly fallback when no knowledge base results', async () => {
    // Arrange: empty knowledge base
    (prisma.pedagogicalContent.findMany as jest.Mock).mockResolvedValue([]);

    // Act
    const result = await generateAriaResponse('student-1', 'MATHEMATIQUES' as any, 'Question obscure');

    // Assert
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should query pedagogicalContent with correct subject', async () => {
    // Act
    await generateAriaResponse('student-1', 'NSI' as any, 'Explique les boucles');

    // Assert
    expect(prisma.pedagogicalContent.findMany).toHaveBeenCalled();
    const call = (prisma.pedagogicalContent.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.subject).toBe('NSI');
  });
});

// ─── generateAriaStream ──────────────────────────────────────────────────────

describe('generateAriaStream', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('should return a ReadableStream', async () => {
    // Act
    const stream = await generateAriaStream('student-1', 'NSI' as any, 'Question');

    // Assert
    expect(stream).toBeInstanceOf(ReadableStream);
    await readStream(stream);
  });

  it('should emit text chunks progressively', async () => {
    // Act
    const stream = await generateAriaStream('student-1', 'NSI' as any, 'Question');
    const output = await readStream(stream);

    // Assert
    expect(output).toContain('Bonjour');
    expect(output).toContain('élève');
    expect(output).toContain('!');
  });

  it('should call onComplete with full response after stream ends', async () => {
    // Arrange
    const onComplete = jest.fn();

    // Act
    const stream = await generateAriaStream(
      'student-1',
      'NSI' as any,
      'Question',
      [],
      async (full) => { onComplete(full); }
    );
    await readStream(stream);

    // Assert
    expect(onComplete).toHaveBeenCalledWith('Bonjour élève!');
  });

  it('should query knowledge base for streaming too', async () => {
    // Act
    const stream = await generateAriaStream('student-1', 'NSI' as any, 'Boucles');
    await readStream(stream);

    // Assert
    expect(prisma.pedagogicalContent.findMany).toHaveBeenCalled();
  });
});

// ─── saveAriaConversation ────────────────────────────────────────────────────

describe('saveAriaConversation', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('should create new conversation on first message', async () => {
    // Arrange
    (prisma.ariaConversation.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.ariaConversation.create as jest.Mock).mockResolvedValue({ id: 'conv-new' });
    (prisma.ariaMessage.create as jest.Mock).mockResolvedValue({ id: 'msg-1' });

    // Act
    const result = await saveAriaConversation(
      'student-1', 'MATHEMATIQUES' as any, 'Bonjour', 'Salut!'
    );

    // Assert
    expect(prisma.ariaConversation.create).toHaveBeenCalledTimes(1);
    expect(result.conversation.id).toBe('conv-new');
  });

  it('should append to existing conversation on follow-up', async () => {
    // Arrange
    (prisma.ariaConversation.findUnique as jest.Mock).mockResolvedValue({ id: 'conv-existing' });
    (prisma.ariaMessage.create as jest.Mock).mockResolvedValue({ id: 'msg-2' });

    // Act
    const result = await saveAriaConversation(
      'student-1', 'MATHEMATIQUES' as any, 'Suite', 'Réponse', 'conv-existing'
    );

    // Assert
    expect(prisma.ariaConversation.create).not.toHaveBeenCalled();
    expect(result.conversation.id).toBe('conv-existing');
  });

  it('should save both user message and assistant response', async () => {
    // Arrange
    (prisma.ariaConversation.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.ariaConversation.create as jest.Mock).mockResolvedValue({ id: 'conv-1' });
    (prisma.ariaMessage.create as jest.Mock).mockResolvedValue({ id: 'msg-1' });

    // Act
    await saveAriaConversation('student-1', 'NSI' as any, 'Question', 'Réponse');

    // Assert: 2 messages created (user + assistant)
    expect(prisma.ariaMessage.create).toHaveBeenCalledTimes(2);
    const calls = (prisma.ariaMessage.create as jest.Mock).mock.calls;
    expect(calls[0][0].data.role).toBe('user');
    expect(calls[1][0].data.role).toBe('assistant');
  });

  it('should truncate conversation title to 50 chars + ellipsis', async () => {
    // Arrange
    (prisma.ariaConversation.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.ariaConversation.create as jest.Mock).mockResolvedValue({ id: 'conv-1' });
    (prisma.ariaMessage.create as jest.Mock).mockResolvedValue({ id: 'msg-1' });
    const longMessage = 'A'.repeat(100);

    // Act
    await saveAriaConversation('student-1', 'NSI' as any, longMessage, 'Réponse');

    // Assert
    const createCall = (prisma.ariaConversation.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.title.length).toBeLessThanOrEqual(54); // 50 + '...'
    expect(createCall.data.title).toContain('...');
  });
});

// ─── recordAriaFeedback ──────────────────────────────────────────────────────

describe('recordAriaFeedback', () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it('should update message with positive feedback', async () => {
    // Arrange
    (prisma.ariaMessage.update as jest.Mock).mockResolvedValue({ id: 'msg-1', feedback: true });

    // Act
    const result = await recordAriaFeedback('msg-1', true);

    // Assert
    expect(prisma.ariaMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { feedback: true },
    });
    expect(result.feedback).toBe(true);
  });

  it('should update message with negative feedback', async () => {
    // Arrange
    (prisma.ariaMessage.update as jest.Mock).mockResolvedValue({ id: 'msg-1', feedback: false });

    // Act
    const result = await recordAriaFeedback('msg-1', false);

    // Assert
    expect(prisma.ariaMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { feedback: false },
    });
    expect(result.feedback).toBe(false);
  });
});

// ─── generateEmbedding ──────────────────────────────────────────────────────

describe('generateEmbedding', () => {
  it('should return empty array when OPENAI_API_KEY is ollama', async () => {
    // Arrange: env already has OPENAI_API_KEY=ollama or unset in test
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'ollama';

    // Act
    const embedding = await generateEmbedding('test text');

    // Assert
    expect(embedding).toEqual([]);

    // Cleanup
    process.env.OPENAI_API_KEY = originalKey;
  });

  it('should return empty array when OPENAI_API_KEY is not set', async () => {
    // Arrange
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    // Act
    const embedding = await generateEmbedding('test text');

    // Assert
    expect(embedding).toEqual([]);

    // Cleanup
    process.env.OPENAI_API_KEY = originalKey;
  });
});
