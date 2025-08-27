describe('aria/services postRequest parsing branches', () => {
  const originalFetch = global.fetch as unknown as typeof fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetModules();
  });

  it('falls back to text() then JSON.parse() then {}', async () => {
    const mockResponse = {
      ok: true,
      json: undefined as any,
      text: async () => 'not-json',
    } as unknown as Response;
    global.fetch = jest.fn(async () => mockResponse) as unknown as typeof fetch;

    const { rag_service } = await import('@/lib/aria/services');
    const res = await rag_service.ingest({ contenu: 'x', metadata: {} });
    expect(res).toEqual({});
  });

  it('returns {} when text() is empty', async () => {
    const mockResponse = {
      ok: true,
      json: undefined as any,
      text: async () => '',
    } as unknown as Response;
    global.fetch = jest.fn(async () => mockResponse) as unknown as typeof fetch;

    const { llm_service } = await import('@/lib/aria/services');
    // @ts-ignore
    const res = await llm_service.generate_response({ contexte_eleve: {}, requete_actuelle: 'x', requete_type: 'Q' });
    expect(res).toEqual({});
  });
});
