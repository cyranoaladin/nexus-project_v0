import { expect } from '@jest/globals';

// This integration test exercises the real PDF microservice to generate
// a PDF and verifies that the returned URL serves a valid PDF file.
// It requires the dev infra to be running locally (docker compose):
// - pdf_generator_service on http://localhost:8002
// - no network mocks

jest.setTimeout(60000);

describe('PDF Generator Service integration', () => {
  // Force local PDF service for this integration test to avoid container DNS in host env
  const baseUrl = 'http://localhost:8002';

  it('generates a PDF and serves it with application/pdf content-type', async () => {
    // 1) Health check
    const health = await fetch(`${baseUrl}/health`).catch(() => null);
    if (!health || !health.ok) {
      throw new Error(`PDF service is not healthy at ${baseUrl}/health`);
    }

    // 2) Request PDF generation
    const nomFichier = `jest_pdf_${Date.now()}`;
    const payload = {
      contenu:
        'Points clés de révision:\n- Définition des polynômes\n- Dérivées\n- Racines et tableau de signes',
      type_document: 'fiche_revision',
      matiere: 'Mathematiques',
      nom_fichier: nomFichier,
      nom_eleve: 'Test Élève',
      footer_brand: 'ARIA',
      footer_show_date: true,
      footer_extra: 'Test intégration PDF',
    };

    const genRes = await fetch(`${baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const genJson = (await genRes.json()) as { url?: string; message?: string };
    expect(genRes.ok).toBe(true);
    expect(typeof genJson.url).toBe('string');
    if (!genJson.url) throw new Error('No URL returned by PDF generator');

    // 3) Fetch the PDF file
    const pdfRes = await fetch(genJson.url);
    expect(pdfRes.ok).toBe(true);

    const ctype = pdfRes.headers.get('content-type') || '';
    expect(ctype.includes('application/pdf')).toBe(true);

    const ab = await pdfRes.arrayBuffer();
    const buf = Buffer.from(ab);

    // Basic sanity: starts with %PDF and size > 5KB
    expect(buf.length).toBeGreaterThan(5 * 1024);
    const header = buf.subarray(0, 4).toString('ascii');
    expect(header).toBe('%PDF');
  });
});
