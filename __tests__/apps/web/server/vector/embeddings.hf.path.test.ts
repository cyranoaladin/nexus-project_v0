jest.mock('openai', () => ({ __esModule: true, default: class OpenAI {} }));

import { embedTexts } from '@/apps/web/server/vector/embeddings';

describe('embeddings - HuggingFace path', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    delete process.env.TEST_EMBEDDINGS_FAKE;
    process.env.EMBEDDING_PROVIDER = 'huggingface';
    process.env.HF_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
  });
  afterEach(() => { process.env = OLD_ENV; });

  it('returns vectors from mocked @xenova/transformers pipeline', async () => {
    // Mock dynamic import of @xenova/transformers
    jest.doMock('@xenova/transformers', () => ({
      __esModule: true,
      env: { allowQuantized: true },
      pipeline: async () => {
        // Return a function compatible with pipeline usage
        const fn: any = async (_texts: string[], _opts: any) => ({ tolist: () => [[0.1, 0.2], [0.3, 0.4]] });
        return fn;
      },
    }));

    const { embedTexts: run } = require('@/apps/web/server/vector/embeddings');
    const res = await run(['A', 'B']);
    expect(res).toEqual([[0.1, 0.2], [0.3, 0.4]]);
  });
});
