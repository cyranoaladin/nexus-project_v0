describe('ARIA services env branches', () => {
  const orig = {
    LLM_SERVICE_URL: process.env.LLM_SERVICE_URL,
    PDF_GENERATOR_SERVICE_URL: process.env.PDF_GENERATOR_SERVICE_URL,
    RAG_SERVICE_URL: process.env.RAG_SERVICE_URL,
  } as any;

  afterEach(() => {
    process.env.LLM_SERVICE_URL = orig.LLM_SERVICE_URL;
    process.env.PDF_GENERATOR_SERVICE_URL = orig.PDF_GENERATOR_SERVICE_URL;
    process.env.RAG_SERVICE_URL = orig.RAG_SERVICE_URL;
    jest.resetModules();
  });

  it('uses env-provided base URLs', async () => {
    process.env.LLM_SERVICE_URL = 'http://llm:9000';
    process.env.PDF_GENERATOR_SERVICE_URL = 'http://pdf:9001';
    process.env.RAG_SERVICE_URL = 'http://rag:9002';
    const { llm_service, pdf_generator_service, rag_service } = require('@/lib/aria/services');
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ response: 'ok', url: 'u', success: true }),
      });
    await llm_service.generate_response({} as any);
    await pdf_generator_service.generate_pdf({} as any);
    await rag_service.ingest({} as any);
    const urls = (global.fetch as any).mock.calls.map((c: any[]) => c[0]);
    expect(urls[0]).toMatch(/^http:\/\/llm:9000/);
    expect(urls[1]).toMatch(/^http:\/\/pdf:9001/);
    expect(urls[2]).toMatch(/^http:\/\/rag:9002/);
  });

  it('uses default base URLs when env not set', async () => {
    delete process.env.LLM_SERVICE_URL;
    delete process.env.PDF_GENERATOR_SERVICE_URL;
    delete process.env.RAG_SERVICE_URL;
    const { llm_service, pdf_generator_service, rag_service } = require('@/lib/aria/services');
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ response: 'ok', url: 'u', success: true }),
      });
    await llm_service.generate_response({} as any);
    await pdf_generator_service.generate_pdf({} as any);
    await rag_service.ingest({} as any);
    const urls = (global.fetch as any).mock.calls.map((c: any[]) => c[0]);
    expect(urls[0]).toMatch(/^http:\/\/localhost:8003/);
    expect(urls[1]).toMatch(/^http:\/\/localhost:8002/);
    expect(urls[2]).toMatch(/^http:\/\/localhost:8001/);
  });
});
