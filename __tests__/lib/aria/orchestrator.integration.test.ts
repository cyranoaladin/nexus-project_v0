import { AriaOrchestrator } from '@/lib/aria/orchestrator';
import { llm_service } from '@/lib/aria/services';
import { prisma } from '@/lib/prisma';

// Mock the entire prisma module
jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn() },
    ariaConversation: { findFirst: jest.fn(), create: jest.fn() },
    ariaMessage: { findMany: jest.fn(), create: jest.fn(), createMany: jest.fn() },
    assessment: { findMany: jest.fn() },
    mastery: { findMany: jest.fn() },
    document: { findMany: jest.fn() },
    subscription: { findMany: jest.fn() },
  },
}));

// Mock the llm_service
jest.mock('@/lib/aria/services', () => ({
  llm_service: {
    generate_response: jest.fn(),
  },
}));

// Mock global fetch for RAG service tests
global.fetch = jest.fn();

describe('AriaOrchestrator Integration Tests', () => {
  let orchestrator: AriaOrchestrator;
  const studentId = 'test-student-id';
  const parentId = 'test-parent-id';
  const query = 'Bonjour ARIA !';

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    orchestrator = new AriaOrchestrator(studentId, parentId);

    // Provide default mock implementations to avoid undefined errors
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: studentId,
      user: { firstName: 'Test' },
    });
    (prisma.ariaConversation.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.ariaMessage.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.ariaMessage.create as jest.Mock).mockResolvedValue({ id: 'm1' });
    (prisma.ariaConversation.create as jest.Mock).mockResolvedValue({ id: 'c1' });
    (prisma.assessment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.mastery.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.subscription.findMany as jest.Mock).mockResolvedValue([]);
    (llm_service.generate_response as jest.Mock).mockResolvedValue({ response: 'Bonjour!' });
  });

  // Tâche 1: Test de la "Mémoire à Long Terme"
  it("devrait appeler toutes les fonctions Prisma nécessaires pour construire le contexte complet de l'élève", async () => {
    await orchestrator.handleQuery(query);

    // Verify that each Prisma function was called once to build the context
    expect(prisma.student.findUnique).toHaveBeenCalledWith({
      where: { id: studentId },
      include: {
        user: true,
        parent: { include: { user: true } },
      },
    });
    expect(prisma.student.findUnique).toHaveBeenCalledTimes(1);

    expect(prisma.ariaMessage.findMany).toHaveBeenCalledWith({
      where: { conversation: { studentId } },
      orderBy: { createdAt: 'asc' },
    });
    expect(prisma.ariaMessage.findMany).toHaveBeenCalledTimes(1);
    // Appels complémentaires (assessments, mastery, documents, subscriptions)
    expect(prisma.assessment.findMany).toHaveBeenCalledWith({ where: { studentId } });
    expect(prisma.mastery.findMany).toHaveBeenCalledWith({ where: { studentId } });
    expect(prisma.document.findMany).toHaveBeenCalledWith({ where: { studentId } });
    // subscription et autres via any-cast dans orchestrator
    expect(prisma.subscription.findMany).toHaveBeenCalledWith({ where: { studentId } });
  });

  // Tâche 4: Test de la Boucle d'Auto-Amélioration du RAG
  it('devrait déclencher une ingestion RAG après une réponse de haute qualité', async () => {
    // Mock the LLM to return a high-quality (long) response
    const highQualityResponse =
      'Ceci est une explication très détaillée de plus de cent cinquante mots qui est conçue pour être de haute qualité et donc ingérée par le service RAG. Elle contient suffisamment de substance pour être considérée comme une nouvelle connaissance. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    (llm_service.generate_response as jest.Mock).mockResolvedValue({
      response: highQualityResponse,
    });

    // Mock fetch to verify the call to the RAG service
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await orchestrator.handleQuery(query as any);

    // Vérifie l'appel à /ingest du RAG service
    expect(global.fetch).toHaveBeenCalled();
    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toBe('http://rag_service:8001/ingest');

    // Vérifier que l'orchestrateur a bien persisté des messages
    expect(prisma.ariaMessage.createMany).toHaveBeenCalledTimes(1);
  });

  // Décisionnelle: STANDARD quand <= 1 faiblesse
  it('devrait construire des decision_hints en mode STANDARD avec <= 1 faiblesse', async () => {
    (prisma.mastery.findMany as jest.Mock).mockResolvedValue([
      { concept: 'Dérivées', score: 0.4 },
      { concept: 'Limites', score: 0.9 },
    ]);

    await orchestrator.handleQuery(query as any);

    expect(llm_service.generate_response).toHaveBeenCalledTimes(1);
    const callArg = (llm_service.generate_response as jest.Mock).mock.calls[0][0];
    const hints = callArg.contexte_eleve.decision_hints;
    expect(hints.interventionMode).toBe('STANDARD');
    expect(hints.requireStepByStep).toBe(false);
    expect(hints.focusConcepts).toEqual(['Dérivées']);
  });

  // Décisionnelle: REMEDIATION_GUIDEE quand >= 2 faiblesses
  it('devrait construire des decision_hints en mode REMEDIATION_GUIDEE avec >= 2 faiblesses', async () => {
    (prisma.mastery.findMany as jest.Mock).mockResolvedValue([
      { concept: 'Dérivées', score: 0.4 },
      { concept: 'Limites', score: 0.3 },
      { concept: 'Intégrales', score: 0.2 },
      { concept: 'Equations', score: 0.9 },
    ]);

    await orchestrator.handleQuery(query as any);

    expect(llm_service.generate_response).toHaveBeenCalledTimes(1);
    const callArg = (llm_service.generate_response as jest.Mock).mock.calls[0][0];
    const hints = callArg.contexte_eleve.decision_hints;
    expect(hints.interventionMode).toBe('REMEDIATION_GUIDEE');
    expect(hints.requireStepByStep).toBe(true);
    expect(hints.focusConcepts).toEqual(['Dérivées', 'Limites', 'Intégrales']);
  });
});
