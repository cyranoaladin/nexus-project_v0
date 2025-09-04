import { jest } from '@jest/globals';

describe('Embeddings hybrid provider', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.EMBEDDING_PROVIDER;
    process.env.TEST_EMBEDDINGS_FAKE = '1';
  });

  test('uses OpenAI by default (fake mode in tests)', async () => {
    process.env.TEST_EMBEDDINGS_FAKE = '1';
    const { embedTexts } = await import('@/apps/web/server/vector/embeddings');
    const out = await embedTexts(['a', 'b']);
    expect(out.length).toBe(2);
    // Par défaut FAKE = MiniLM dim 384, sauf si VECTOR_DIM override
    const expectedDim = Number(process.env.VECTOR_DIM || 384);
    expect(out[0].length).toBe(expectedDim);
  });

  test('uses HuggingFace when EMBEDDING_PROVIDER=huggingface (fake mode)', async () => {
    process.env.TEST_EMBEDDINGS_FAKE = '1';
    process.env.EMBEDDING_PROVIDER = 'huggingface';
    process.env.HF_EMBEDDING_MODEL = 'intfloat/e5-large-v2';
    const { embedTexts } = await import('@/apps/web/server/vector/embeddings');
    const out = await embedTexts(['x']);
    expect(out.length).toBe(1);
    const expectedDim = Number(process.env.VECTOR_DIM || 384);
    expect(out[0].length).toBe(expectedDim);
  });
});
