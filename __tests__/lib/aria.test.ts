const mockStreamChunks = [
  { choices: [{ delta: { content: 'Salut' } }] },
  { choices: [{ delta: { content: ' ARIA' } }] },
];

if (!globalThis.ReadableStream) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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
          return { choices: [{ message: { content: 'Réponse ARIA' } }] };
        },
      },
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
  },
}));

import {
  generateAriaResponse,
  generateAriaStream,
  recordAriaFeedback,
  saveAriaConversation,
} from '@/lib/aria';
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

describe('aria', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates ARIA response', async () => {
    (prisma.pedagogicalContent.findMany as jest.Mock).mockResolvedValue([]);
    const result = await generateAriaResponse(
      'student-1',
      'MATHEMATIQUES' as any,
      'Question'
    );
    expect(result).toBe('Réponse ARIA');
  });

  it('streams response and calls onComplete', async () => {
    (prisma.pedagogicalContent.findMany as jest.Mock).mockResolvedValue([]);
    const onComplete = jest.fn();
    const stream = await generateAriaStream(
      'student-1',
      'NSI' as any,
      'Question',
      [],
      async (full) => {
        onComplete(full);
      }
    );
    const output = await readStream(stream);
    expect(output).toContain('Salut ARIA');
    expect(onComplete).toHaveBeenCalledWith('Salut ARIA');
  });

  it('saves conversation and messages', async () => {
    (prisma.ariaConversation.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.ariaConversation.create as jest.Mock).mockResolvedValue({ id: 'conv-1' });
    (prisma.ariaMessage.create as jest.Mock).mockResolvedValue({ id: 'msg-2' });

    const result = await saveAriaConversation(
      'student-1',
      'NSI' as any,
      'Bonjour',
      'Réponse'
    );

    expect(prisma.ariaMessage.create).toHaveBeenCalledTimes(2);
    expect(result.conversation.id).toBe('conv-1');
  });

  it('records feedback', async () => {
    (prisma.ariaMessage.update as jest.Mock).mockResolvedValue({ id: 'msg-1' });
    const res = await recordAriaFeedback('msg-1', true);
    expect(res).toEqual({ id: 'msg-1' });
  });
});
