import { streamChatCompletion } from '@/lib/aria/gateway';
import OpenAI from 'openai';

jest.mock('openai', () => {
  const mCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mCreate,
      },
    },
  }));
});

describe('ARIA Model Provider Gateway', () => {
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test';
    const openaiInstance = new (OpenAI as unknown as new () => {
      chat: { completions: { create: jest.Mock } };
    })();
    mockCreate = openaiInstance.chat.completions.create;
  });

  it('diffuse les chunks textuels émis par le modèle', async () => {
    async function* generateMockChunks() {
      yield { choices: [{ delta: { content: 'Étape 1 : ' } }] };
      yield { choices: [{ delta: { content: 'poser l équation.' } }] };
    }

    mockCreate.mockResolvedValueOnce(generateMockChunks());

    const chunks: string[] = [];
    for await (const chunk of streamChatCompletion([{ role: 'user', content: 'test' }])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Étape 1 : ', 'poser l équation.']);
  });

  it('gère l interruption par AbortSignal sans lever d erreur non gérée', async () => {
    const controller = new AbortController();

    async function* generateMockChunks() {
      yield { choices: [{ delta: { content: 'Début' } }] };
      controller.abort();
      yield { choices: [{ delta: { content: 'Ignoré' } }] };
    }

    mockCreate.mockResolvedValueOnce(generateMockChunks());

    const chunks: string[] = [];
    for await (const chunk of streamChatCompletion([{ role: 'user', content: 'test' }], {
      signal: controller.signal,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Début']);
  });

  it('sanitise les clés secrètes si une erreur est levée', async () => {
    mockCreate.mockRejectedValueOnce(
      new Error('API call failed with key sk-secret1234567890abcdef at /internal/path')
    );

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of streamChatCompletion([{ role: 'user', content: 'test' }])) {
        // noop
      }
    }).rejects.toThrow('[REDACTED]');
  });
});
