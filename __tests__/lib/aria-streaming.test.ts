const mockStreamChunks = [
  { choices: [{ delta: { content: 'Bonjour' } }] },
  { choices: [{ delta: { content: ' monde' } }] },
];
if (!globalThis.ReadableStream) {
  // Polyfill for JSDOM test environment
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (globalThis as any).ReadableStream = require('stream/web').ReadableStream;
}

jest.mock('openai', () => ({
  __esModule: true,
  ...(() => {
    const create = jest.fn();
    return {
      __mockCreate: create,
      default: class FakeOpenAI {
        chat = { completions: { create } };
        constructor() {}
      },
    };
  })(),
}));

jest.mock('@/lib/rag-client', () => ({
  ragSearch: jest.fn().mockResolvedValue({ status: 'empty', durationMs: 1, hits: [] }),
  buildRAGContext: jest.fn().mockReturnValue(''),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    pedagogicalContent: { findMany: jest.fn() },
  },
}));

import { generateAriaResponseStream } from '@/lib/aria-streaming';
import { prisma } from '@/lib/prisma';
import { ragSearch } from '@/lib/rag-client';

const mockOpenAICreate = jest.requireMock('openai').__mockCreate as jest.Mock;

async function readStream(stream: ReadableStream) {
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

describe('aria streaming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAICreate.mockImplementation(async function* () {
      for (const chunk of mockStreamChunks) yield chunk;
    });
  });

  it('streams content and done sentinel', async () => {
    (prisma.pedagogicalContent.findMany as jest.Mock).mockResolvedValue([
      { title: 'Leçon', content: 'Contenu', tags: '' },
    ]);

    const stream = await generateAriaResponseStream(
      'student-1',
      'MATHEMATIQUES' as any,
      'Question test',
      []
    );

    const output = await readStream(stream);
    expect(output).toContain('Bonjour');
    expect(output).toContain('monde');
    expect(output).toContain('[DONE]');
    expect(output).toContain('Cette réponse ne s’appuie sur aucune source du corpus Nexus.');
  });

  it('returns an explicit unavailability message without calling the model on RAG failure', async () => {
    (ragSearch as jest.Mock).mockResolvedValueOnce({
      status: 'error',
      durationMs: 9,
      hits: [],
      error: { code: 'TIMEOUT' },
    });

    const stream = await generateAriaResponseStream(
      'student-1',
      'MATHEMATIQUES' as any,
      'Question test',
      []
    );

    const output = await readStream(stream);
    expect(output).toContain('La base documentaire est momentanément indisponible.');
    expect(output).not.toContain('Bonjour');
    expect(mockOpenAICreate).not.toHaveBeenCalled();
  });
});
