import { llm_service, pdf_generator_service, rag_service } from '@/lib/aria/services';

describe('lib/aria/services', () => {
  const originalFetch = global.fetch as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('llm_service.generate_response returns JSON on 200', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ response: 'ok' }) });
    const res = await llm_service.generate_response({
      contexte_eleve: {},
      requete_actuelle: 'q',
      requete_type: 't',
    } as any);
    expect(res.response).toBe('ok');
  });

  it('pdf_generator_service.generate_pdf handles non-OK by throwing (wrapped error)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'err' });
    await expect(
      pdf_generator_service.generate_pdf({
        contenu: 'x',
        type_document: 'TD',
        matiere: 'NSI',
        nom_fichier: 'f',
        nom_eleve: 'n',
      } as any)
    ).rejects.toThrow(/Erreur de communication avec un service interne/);
  });

  it('rag_service.ingest throws on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    await expect(rag_service.ingest({ contenu: 'abc', metadata: {} })).rejects.toThrow(
      /Erreur de communication/
    );
  });
});
