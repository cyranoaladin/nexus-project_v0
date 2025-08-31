describe('aria/services postRequest branch when response has no text()', () => {
  const originalFetch = global.fetch as any;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetModules();
  });

  it('logs and throws on !ok and no text(); then returns {} on ok with no json/text', async () => {
    // First call: !ok without text()
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 500 });
    const { rag_service } = await import('@/lib/aria/services');
    await expect(rag_service.ingest({ contenu: 'x', metadata: {} })).rejects.toThrow(/Erreur de communication/);

    // Second call: ok, but no json() nor text()
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true });
    const { rag_service: rag2 } = await import('@/lib/aria/services');
    const res = await rag2.ingest({ contenu: 'x', metadata: {} });
    expect(res).toEqual({});
  });
});
