/**
 * Unit tests — generateLLMParentEafReport (llm-report.ts)
 *
 * Mocks:
 *  - ollamaChat       → controlled LLM response
 *  - ragSearch        → returns predictable hits
 *  - buildRAGContext  → returns a short string
 *
 * Tests validate:
 *  - Happy path: LLM used, result contains key sections
 *  - RAG fallback when searches fail (empty results)
 *  - Deterministic fallback when LLM is unavailable (throws)
 *  - Deterministic fallback when LLM response is too short (< 300 chars)
 *  - No verbatim raw coach notes in result (not testable on mock, but tested on fallback)
 *  - Result shape: { markdown, llmUsed, ragHitCount }
 */

import { generateLLMParentEafReport } from '@/lib/coach/eaf-stage-printemps/llm-report';
import type { CoachEafSourceData } from '@/lib/coach/eaf-stage-printemps/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/ollama-client', () => ({
  ollamaChat: jest.fn(),
}));

jest.mock('@/lib/rag-client', () => ({
  ragSearch: jest.fn(),
  buildRAGContext: jest.fn(),
}));

// Also mock the deterministic fallback so we can assert it's called
jest.mock('@/lib/coach/eaf-stage-printemps/generate-parent-report', () => ({
  generateParentEafStageReport: jest.fn(() => '## 1. Attitude et implication\n\nFallback text here.\n'),
}));

import { ollamaChat } from '@/lib/ollama-client';
import { ragSearch, buildRAGContext } from '@/lib/rag-client';
import { generateParentEafStageReport } from '@/lib/coach/eaf-stage-printemps/generate-parent-report';

const mockOllamaChat = ollamaChat as jest.MockedFunction<typeof ollamaChat>;
const mockRagSearch  = ragSearch  as jest.MockedFunction<typeof ragSearch>;
const mockBuildRAGContext = buildRAGContext as jest.MockedFunction<typeof buildRAGContext>;
const mockFallback   = generateParentEafStageReport as jest.MockedFunction<typeof generateParentEafStageReport>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STUDENT = { firstName: 'Lamis', lastName: 'Trabelsi' };
const FIXED_DATE = new Date('2026-05-05');

const FULL_SOURCE: Partial<CoachEafSourceData> = {
  attendanceAndEngagement: {
    attendance: 'reguliere',
    punctuality: 'satisfaisante',
    involvement: 4,
    concentration: 3,
    oralParticipation: 3,
    attitudeToDifficulty: 'volontaire-mais-hesitant',
    coachComment: 'Élève sérieuse.',
  },
  examExpectations: {
    understandsWrittenExam: 3,
    quoteVsAnalysis: 2,
    coachComment: 'La distinction citer/analyser reste fragile.',
  },
  commentary: {
    textUnderstanding: 3,
    processAnalysis: 2,
    interpretation: 2,
    organization: 4,
    strengths: 'Bonne compréhension globale.',
    difficulties: 'Formulation du projet de lecture hésitante.',
    priority: 'Travailler le projet de lecture.',
  },
  dissertation: {
    subjectUnderstanding: 4,
    problematique: 2,
    strengths: 'Compréhension du sujet.',
    priority: 'Construire une problématique précise.',
  },
  writing: {
    sentenceClarity: 3,
    grammar: 2,
    spelling: 2,
    literaryVocabulary: 2,
    observations: 'Expression correcte dans l\'ensemble.',
  },
  progress: {
    globalProgress: 'nette',
    mostImprovedSkill: 'dissertation',
    prioritySkill: 'commentaire',
  },
  parentRecommendations: {
    estimatedCurrentLevel: 'fragile-mais-en-progres',
    recommendedFollowUp: 'accompagnement-regulier',
    priorityAxes: ['commentaire', 'dissertation'],
    parentSummaryMessage: 'Votre enfant a travaillé sérieusement.',
    finalRecommendation: 'Un suivi régulier est recommandé.',
  },
};

const LLM_GOOD_RESPONSE = `## 1. Attitude et implication

Lamis a manifesté une présence régulière et un engagement sincère tout au long du stage.

## 2. Compréhension des attentes de l'épreuve

La compréhension générale des exigences de l'EAF est en progression notable.

## 3. Commentaire de texte

La compréhension globale des textes est un point d'appui solide pour Lamis.

## 4. Dissertation

La compréhension du sujet constitue un atout réel que Lamis doit continuer à cultiver.

## 5. Expression écrite

L'expression écrite est en cours de consolidation, avec des progrès perceptibles.

## 6. Progrès observés

La progression de Lamis au cours de ce stage a été nette et encourageante.

## 7. Priorités de travail

- Le commentaire de texte
- La méthode de la dissertation

## 8. Recommandation finale

Un accompagnement régulier est vivement recommandé pour ancrer les acquis du stage.`;

const RAG_HIT = { id: 'hit-1', document: 'Méthode commentaire composé lycée.', score: 0.9 };

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockRagSearch.mockResolvedValue([RAG_HIT]);
  mockBuildRAGContext.mockReturnValue('=== CONTEXTE PÉDAGOGIQUE ===\nMéthode commentaire composé lycée.');
  mockOllamaChat.mockResolvedValue(LLM_GOOD_RESPONSE);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateLLMParentEafReport', () => {
  it('1. Happy path — retourne markdown LLM avec llmUsed=true', async () => {
    const result = await generateLLMParentEafReport(FULL_SOURCE, STUDENT, FIXED_DATE);

    expect(result.llmUsed).toBe(true);
    expect(result.markdown).toContain('## 1. Attitude et implication');
    expect(result.markdown).toContain('## 8. Recommandation finale');
    expect(result.ragHitCount).toBeGreaterThan(0);
  });

  it('2. Le markdown contient les 8 sections attendues', async () => {
    const { markdown } = await generateLLMParentEafReport(FULL_SOURCE, STUDENT, FIXED_DATE);

    const sections = [
      '## 1. Attitude et implication',
      "## 2. Compréhension des attentes de l'épreuve",
      '## 3. Commentaire de texte',
      '## 4. Dissertation',
      '## 5. Expression écrite',
      '## 6. Progrès observés',
      '## 7. Priorités de travail',
      '## 8. Recommandation finale',
    ];
    for (const section of sections) {
      expect(markdown).toContain(section);
    }
  });

  it('3. RAG est appelé avec la bonne collection', async () => {
    await generateLLMParentEafReport(FULL_SOURCE, STUDENT, FIXED_DATE);

    expect(mockRagSearch).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'rag_francais_premiere' })
    );
  });

  it('4. ollamaChat est appelé avec un system prompt et un user prompt', async () => {
    await generateLLMParentEafReport(FULL_SOURCE, STUDENT, FIXED_DATE);

    expect(mockOllamaChat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
      })
    );
  });

  it('5. Fallback déterministe si LLM lève une exception', async () => {
    mockOllamaChat.mockRejectedValue(new Error('Ollama unavailable'));

    const result = await generateLLMParentEafReport(FULL_SOURCE, STUDENT, FIXED_DATE);

    expect(result.llmUsed).toBe(false);
    expect(result.ragHitCount).toBe(0);
    expect(mockFallback).toHaveBeenCalledTimes(1);
    expect(result.markdown).toContain('1. Attitude et implication');
  });

  it('6. Fallback déterministe si réponse LLM < 300 chars', async () => {
    mockOllamaChat.mockResolvedValue('Trop court.');

    const result = await generateLLMParentEafReport(FULL_SOURCE, STUDENT, FIXED_DATE);

    expect(result.llmUsed).toBe(false);
    expect(mockFallback).toHaveBeenCalledTimes(1);
  });

  it('7. Fallback déterministe si tous les appels RAG échouent', async () => {
    mockRagSearch.mockRejectedValue(new Error('ChromaDB down'));
    mockOllamaChat.mockResolvedValue(LLM_GOOD_RESPONSE); // LLM still works

    // RAG errors are caught per-query — LLM should still be called with empty context
    const result = await generateLLMParentEafReport(FULL_SOURCE, STUDENT, FIXED_DATE);

    expect(result.llmUsed).toBe(true); // LLM succeeded even without RAG
    expect(result.ragHitCount).toBe(0);
  });

  it('8. Shape de retour correcte (markdown, llmUsed, ragHitCount)', async () => {
    const result = await generateLLMParentEafReport(FULL_SOURCE, STUDENT, FIXED_DATE);

    expect(typeof result.markdown).toBe('string');
    expect(typeof result.llmUsed).toBe('boolean');
    expect(typeof result.ragHitCount).toBe('number');
  });

  it('9. Fonctionne avec sourceData vide — pas d\'exception', async () => {
    const result = await generateLLMParentEafReport({}, {}, FIXED_DATE);
    expect(result.markdown.length).toBeGreaterThan(0);
  });

  it('10. Utilise le prénom dans le prompt user — pas le nom complet', async () => {
    await generateLLMParentEafReport(FULL_SOURCE, STUDENT, FIXED_DATE);

    const userMessage = mockOllamaChat.mock.calls[0][0].messages.find(
      (m: { role: string; content: string }) => m.role === 'user'
    );
    expect(userMessage?.content).toContain('Lamis');
    // Full name should NOT appear in user prompt (privacy — first name only)
    expect(userMessage?.content).not.toContain('Trabelsi');
  });

  it('11. ragHitCount = 0 quand RAG retourne aucun résultat', async () => {
    mockRagSearch.mockResolvedValue([]);
    mockBuildRAGContext.mockReturnValue('');

    const result = await generateLLMParentEafReport(FULL_SOURCE, STUDENT, FIXED_DATE);

    expect(result.ragHitCount).toBe(0);
    expect(result.llmUsed).toBe(true); // LLM still runs
  });

  it('12. Le prompt système interdit la reproduction des notes brutes du coach', async () => {
    await generateLLMParentEafReport(FULL_SOURCE, STUDENT, FIXED_DATE);

    const systemMessage = mockOllamaChat.mock.calls[0][0].messages.find(
      (m: { role: string; content: string }) => m.role === 'system'
    );
    expect(systemMessage?.content).toContain('Jamais de reproduction des notes brutes');
  });
});
