import { AriaOrchestrator } from '@/lib/aria/orchestrator';
import { prisma } from '@/lib/prisma';
import { llm_service, pdf_generator_service } from '@/lib/aria/services';
import { Subject } from '@prisma/client';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    ariaConversation: { findFirst: jest.fn(), create: jest.fn() },
    ariaMessage: { findMany: jest.fn(), createMany: jest.fn() },
  },
}));

jest.mock('@/lib/aria/services', () => ({
  llm_service: { generate_response: jest.fn() },
  pdf_generator_service: { generate_pdf: jest.fn() },
}));

global.fetch = jest.fn();

describe('E2E orchestrator extra branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: 's1',
      user: { firstName: 'Ada', lastName: 'Lovelace' },
    });
    (prisma.ariaConversation.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.ariaConversation.create as jest.Mock).mockResolvedValue({ id: 'conv1' });
    (prisma.ariaMessage.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.ariaMessage.createMany as jest.Mock).mockResolvedValue({ count: 2 });
  });

  it('ne génère pas de PDF quand la requête ne le demande pas (EXPLICATION)', async () => {
    (llm_service.generate_response as jest.Mock).mockResolvedValue({
      response: 'Réponse conversationnelle courte.',
    });

    const orch = new AriaOrchestrator('s1', 'p1');
    await orch.handleQuery("Explique-moi la dérivée d'une somme", 'MATH' as unknown as Subject);

    expect(pdf_generator_service.generate_pdf).not.toHaveBeenCalled();
  });

  it("ne déclenche pas l'ingestion RAG quand la réponse est courte (\u2264 30 mots)", async () => {
    (llm_service.generate_response as jest.Mock).mockResolvedValue({
      response: 'Réponse brève.', // \u2264 30 mots
    });

    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    const orch = new AriaOrchestrator('s1', 'p1');
    await orch.handleQuery('Question simple', 'MATH' as unknown as Subject);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('gère un échec de compilation LaTeX côté service PDF (via exception)', async () => {
    (llm_service.generate_response as jest.Mock).mockResolvedValue({
      response: 'Réponse longue '.repeat(40),
      contenu_latex: '\\section*{Sujet}\nDocument préparé pour Ada.',
    });

    (pdf_generator_service.generate_pdf as jest.Mock).mockRejectedValue(
      new Error('Compilation LaTeX échouée')
    );

    const orch = new AriaOrchestrator('s1', 'p1');
    await expect(
      orch.handleQuery('Je veux un document PDF de révision', 'MATH' as unknown as Subject)
    ).resolves.toHaveProperty('response');

    // Même si la génération PDF échoue, la réponse texte LLM est renvoyée et la conversation sauvegardée
    expect(prisma.ariaMessage.createMany).toHaveBeenCalled();
  });
});
