import { http, HttpResponse } from 'msw';

const delayMs = 10;

export const handlers = [
  // PDF generator mock
  http.post('http://localhost:8002/generate', async () => {
    await new Promise((r) => setTimeout(r, delayMs));
    return HttpResponse.json(
      {
        message: 'ok',
        url: '/generated/mock.pdf',
      },
      { status: 200 }
    );
  }),

  // RAG ingest mock
  http.post('http://rag_service:8001/ingest', async () => {
    await new Promise((r) => setTimeout(r, delayMs));
    return HttpResponse.json({ success: true }, { status: 200 });
  }),

  // LLM chat mock
  http.post('http://localhost:8003/chat', async ({ request }) => {
    await new Promise((r) => setTimeout(r, delayMs));
    return HttpResponse.json(
      {
        response: 'Réponse mockée ARIA',
        contenu_latex: '\\textbf{Mock}',
        mock: true,
      },
      { status: 200 }
    );
  }),
];
