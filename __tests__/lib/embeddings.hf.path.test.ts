import { jest } from '@jest/globals';

// moduleNameMapper will map @xenova/transformers to a test mock
const mockToList = jest.fn(() => [[0.1, 0.2, 0.3]]);

// Our mock module will export a pipeline that returns a function with tolist
jest.doMock('@xenova/transformers', () => ({
  env: { allowQuantized: true },
  pipeline: async (_task: string, _model: string) => async (_texts: string[], _opts: any) => ({ tolist: mockToList }),
}), { virtual: true });

describe('apps/web/server/vector/embeddings - HuggingFace path', () => {
  const OLD = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD };
    delete process.env.TEST_EMBEDDINGS_FAKE;
    process.env.EMBEDDING_PROVIDER = 'huggingface';
    process.env.HF_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
  });
  afterEach(() => { process.env = OLD; });

  test('embedTexts delegates to HF pipeline and returns tolist vectors', async () => {
    const { embedTexts } = await import('@/apps/web/server/vector/embeddings');
    const out = await embedTexts(['hello']);
    expect(mockToList).toHaveBeenCalled();
    // Le pipeline coerce/pad à VECTOR_DIM (3072). On vérifie le préfixe et la longueur.
    expect(Array.isArray(out[0])).toBe(true);
    expect(out[0].slice(0, 3)).toEqual([0.1, 0.2, 0.3]);
    expect(out[0].length).toBe(Number(process.env.VECTOR_DIM || 3072));
  });
});
