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
  default: class FakeOpenAI {
    chat = {
      completions: {
        async *create() {
          for (const chunk of mockStreamChunks) {
            yield chunk;
          }
        },
      },
    };
    constructor() {}
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    pedagogicalContent: { findMany: jest.fn() },
  },
}));

import { generateAriaResponseStream } from '@/lib/aria-streaming';
import { prisma } from '@/lib/prisma';

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
  });
});
