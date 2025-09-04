jest.mock('openai', () => {
  return {
    __esModule: true,
    default: class OpenAI {
      embeddings = {
        create: async ({ input, dimensions }: any) => ({
          data: (input as string[]).map(() => ({ embedding: Array.from({ length: dimensions }, (_, i) => i) }))
        })
      };
    }
  };
});

import { embedTexts } from '@/apps/web/server/vector/embeddings';

describe('apps/web/server/vector/embeddings (OpenAI path)', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.TEST_EMBEDDINGS_FAKE;
    process.env.EMBEDDING_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.VECTOR_DIM = '3';
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  test('embedTexts delegates to OpenAI embeddings with target dimensions', async () => {
    const texts = ['Hello', 'World'];
    const vectors = await embedTexts(texts);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toEqual([0, 1, 2]);
    expect(vectors[1]).toEqual([0, 1, 2]);
  });
});
