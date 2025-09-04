import { NextRequest } from 'next/server';

// Mocks used across tests
const vectorRows = [{ id: '1', docId: 'd1', subject: 'NSI', level: 'terminale', chunk: 'Hello', meta: {} }];

describe('API /api/rag/search', () => {
  const OLD = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD };
  });
  afterEach(() => { process.env = OLD; });

  test('E2E stub branch returns provider stub and docType inference', async () => {
    process.env.E2E = '1';
    const { GET } = require('@/app/api/rag/search/route');
    const req = new NextRequest('http://localhost/api/rag/search?q=image+test');
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.provider).toBe('stub');
    expect(json.hits[0].meta.docType).toBe('ocr');
  });

  test('vector provider path uses embedTexts + $queryRawUnsafe', async () => {
    jest.doMock('@/apps/web/server/vector/embeddings', () => ({ embedTexts: jest.fn(async (_q: string[]) => [[0.1, 0.2]]) }));
    jest.doMock('@/lib/prisma', () => ({ prisma: { $queryRawUnsafe: jest.fn(async () => vectorRows) } }));
    const { GET } = require('@/app/api/rag/search/route');
    const req = new NextRequest('http://localhost/api/rag/search?q=hello&subject=NSI&level=terminale&k=3');
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.provider).toBe('vector');
    expect(json.hits.length).toBe(1);
  });

  test('fallback to text provider when vector search fails', async () => {
    jest.doMock('@/apps/web/server/vector/embeddings', () => ({ embedTexts: jest.fn(async () => { throw new Error('no vector'); }) }));
    jest.doMock('@/lib/prisma', () => ({ prisma: { knowledgeAsset: { findMany: jest.fn(async () => vectorRows) } } }));
    const { GET } = require('@/app/api/rag/search/route');
    const req = new NextRequest('http://localhost/api/rag/search?q=world');
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.provider).toBe('text');
  });
});
