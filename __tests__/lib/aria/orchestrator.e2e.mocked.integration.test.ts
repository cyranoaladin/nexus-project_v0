import { AriaOrchestrator } from '@/lib/aria/orchestrator';
import { prisma } from '@/lib/prisma';
import { llm_service, pdf_generator_service } from '@/lib/aria/services';
import { Subject } from '@prisma/client';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    ariaConversation: { findFirst: jest.fn(), create: jest.fn() },
    ariaMessage: { findMany: jest.fn(), createMany: jest.fn() },
    session: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/aria/services', () => ({
  llm_service: { generate_response: jest.fn() },
  pdf_generator_service: { generate_pdf: jest.fn() },
}));

global.fetch = jest.fn();

describe('E2E orchestrator flow (mocked HTTP interactions)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', user: { firstName: 'Ada', lastName: 'Lovelace' } });
    (prisma.ariaConversation.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.ariaConversation.create as jest.Mock).mockResolvedValue({ id: 'conv1' });
    (prisma.ariaMessage.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.ariaMessage.createMany as jest.Mock).mockResolvedValue({ count: 2 });

    (llm_service.generate_response as jest.Mock).mockResolvedValue({
      response: 'Réponse très détaillée dépassant largement le seuil de qualité pour ingestion RAG. '.repeat(10),
      contenu_latex: '\\section*{Sujet}\nDocument préparé pour Ada.',
    });

    ;(pdf_generator_service.generate_pdf as jest.Mock).mockResolvedValue({ url: '/pdfs/fiche.pdf' });
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true });
  });

  it('should call LLM with full context, generate PDF with correct student name, and trigger RAG ingestion', async () => {
    const orch = new AriaOrchestrator('s1', 'p1');
    const res = await orch.handleQuery('Je veux un document PDF de révision en maths', 'MATH' as unknown as Subject);

    // LLM appelé avec contexte
    expect(llm_service.generate_response).toHaveBeenCalled();
    const llmArg = (llm_service.generate_response as jest.Mock).mock.calls[0][0];
    expect(llmArg.contexte_eleve.profile.user.firstName).toBe('Ada');

    // PDF généré avec nom_eleve
    expect(pdf_generator_service.generate_pdf).toHaveBeenCalled();
    const pdfArg = (pdf_generator_service.generate_pdf as jest.Mock).mock.calls[0][0];
    expect(pdfArg.nom_eleve).toBe('Ada Lovelace');

    // RAG ingestion appelée
    expect(global.fetch).toHaveBeenCalled();
    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(String(url)).toMatch(/\/ingest$/);

    // Réponse finale contient l’URL du document
    expect(res.documentUrl).toBe('/pdfs/fiche.pdf');
  });
});
