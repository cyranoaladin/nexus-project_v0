jest.mock('@/lib/rag-client', () => ({
  ragSearch: jest.fn(),
}));

import { buildAriaRetrievalPlan, executeAriaRetrieval } from '@/lib/aria/rag';
import { ragSearch, type RAGSearchHit } from '@/lib/rag-client';

const mockRagSearch = ragSearch as jest.MockedFunction<typeof ragSearch>;

describe('ARIA RAG Retrieval Contract & Execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Construction du plan de recherche explicite', () => {
    it('construit un plan de recherche strict pour Maths Première', () => {
      const plan = buildAriaRetrievalPlan('eds-maths-premiere');
      expect(plan).not.toBeNull();
      expect(plan?.courseKey).toBe('eds-maths-premiere');
      expect(plan?.gradeLevel).toBe('PREMIERE');
      expect(plan?.academicTrack).toBe('EDS_GENERALE');
      expect(plan?.collection).toBe('rag_nexus_maths_premiere_generale_production');
      expect(plan?.filters).toEqual({ niveau: 'premiere', voie: 'generale', matiere: 'maths' });
    });

    it('construit un plan de recherche strict pour Maths Terminale', () => {
      const plan = buildAriaRetrievalPlan('eds-maths-terminale');
      expect(plan).not.toBeNull();
      expect(plan?.courseKey).toBe('eds-maths-terminale');
      expect(plan?.gradeLevel).toBe('TERMINALE');
      expect(plan?.collection).toBe('rag_nexus_maths_terminale_generale_production');
    });

    it('refuse tout plan documentaire pour les enseignements STMG sans corpus', () => {
      expect(buildAriaRetrievalPlan('stmg-sgn-premiere')).toBeNull();
      expect(buildAriaRetrievalPlan('stmg-management-premiere')).toBeNull();
      expect(buildAriaRetrievalPlan('stmg-droit-eco-premiere')).toBeNull();
    });

    it('retourne null pour un cours inconnu', () => {
      expect(buildAriaRetrievalPlan('cours-inexistant')).toBeNull();
    });
  });

  describe('Exécution de la recherche et typage des états', () => {
    it('retourne NOT_CONFIGURED si le plan est null', async () => {
      const result = await executeAriaRetrieval(null, 'comment dériver');
      expect(result.status).toBe('NOT_CONFIGURED');
    });

    it('retourne NO_RESULTS si la requête est vide', async () => {
      const plan = buildAriaRetrievalPlan('eds-maths-premiere')!;
      const result = await executeAriaRetrieval(plan, '   ');
      expect(result.status).toBe('NO_RESULTS');
      expect(mockRagSearch).not.toHaveBeenCalled();
    });

    it('retourne SUCCESS avec citations structurées lors d une réponse positive', async () => {
      const plan = buildAriaRetrievalPlan('eds-maths-premiere')!;
      mockRagSearch.mockResolvedValueOnce([
        {
          id: 'doc-1',
          document: 'Théorème de dérivation des fonctions composées.',
          metadata: {
            title: 'Chapitre 3 : Dérivation',
            filename: 'maths-1ere-ch3.pdf',
            section: '3.2',
            provenance: 'OFFICIEL_MEN',
          },
          distance: 0.15,
        } as unknown as RAGSearchHit,
      ]);

      const result = await executeAriaRetrieval(plan, 'formule dérivée composée');
      expect(result.status).toBe('SUCCESS');
      if (result.status === 'SUCCESS') {
        expect(result.hits).toHaveLength(1);
        const hit = result.hits[0];
        expect(hit.sourceTitle).toBe('Chapitre 3 : Dérivation');
        expect(hit.sourceLocation).toBe('3.2');
        expect(hit.courseKey).toBe('eds-maths-premiere');
        expect(hit.snippet).toContain('fonctions composées');
      }
    });

    it('retourne RUNTIME_UNAVAILABLE en cas d erreur réseau ou d indisponibilité du serveur', async () => {
      const plan = buildAriaRetrievalPlan('eds-maths-terminale')!;
      mockRagSearch.mockRejectedValueOnce(new Error('Connection refused to RAG ingestor'));

      const result = await executeAriaRetrieval(plan, 'continuité et limites');
      expect(result.status).toBe('RUNTIME_UNAVAILABLE');
      if (result.status === 'RUNTIME_UNAVAILABLE') {
        expect(result.error).toContain('Connection refused');
      }
    });
  });
});
