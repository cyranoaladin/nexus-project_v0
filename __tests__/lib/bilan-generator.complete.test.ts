/**
 * Bilan Generator — Complete Test Suite
 *
 * Tests: generateBilans (RAG + LLM pipeline with fallback)
 *
 * Source: lib/bilan-generator.ts
 */

jest.mock('@/lib/ollama-client', () => ({
  ollamaChat: jest.fn(),
}));

jest.mock('@/lib/rag-client', () => ({
  ragSearch: jest.fn().mockResolvedValue([]),
  buildRAGContext: jest.fn().mockReturnValue(''),
}));

jest.mock('@/lib/diagnostics/prompt-context', () => ({
  buildPromptContextPack: jest.fn().mockReturnValue({}),
  renderPromptContext: jest.fn().mockReturnValue('rendered context'),
  buildChapterAwareRAGQueries: jest.fn().mockReturnValue(['query1']),
}));

import { generateBilans } from '@/lib/bilan-generator';
import { ollamaChat } from '@/lib/ollama-client';
import { ragSearch, buildRAGContext } from '@/lib/rag-client';

const mockOllamaChat = ollamaChat as jest.MockedFunction<typeof ollamaChat>;
const mockRagSearch = ragSearch as jest.MockedFunction<typeof ragSearch>;
const mockBuildRAGContext = buildRAGContext as jest.MockedFunction<typeof buildRAGContext>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMinimalData(): any {
  return {
    identity: { firstName: 'Ahmed', lastName: 'Ben Ali', email: 'ahmed@test.com', phone: '99192829' },
    schoolContext: { establishment: 'Lycée Test', mathTrack: 'eds_maths_tle' },
    performance: { mathAverage: '14', generalAverage: '13', classRanking: '5/30' },
    chapters: {},
    competencies: {},
    openQuestions: { algebraUnderstanding: 'Je comprends les bases', hardestAnalysisChapter: 'Intégrales' },
    examPrep: {
      miniTest: { score: 4, timeUsedMinutes: 10, completedInTime: true },
      selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 2, justifications: 2, stress: 1 },
      signals: { hardestItems: [1, 3], verifiedAnswers: null },
      mainRisk: 'Gestion du temps',
    },
    methodology: { learningStyle: 'visuel', weeklyWork: '4h', maxConcentration: '1h', errorTypes: ['calcul'] },
    ambition: { targetMention: 'Bien', postBac: 'CPGE', pallier2Pace: 'oui' },
    freeText: { mustImprove: 'Intégrales', invisibleDifficulties: 'Stress', message: 'Motivé' },
  };
}

function makeMinimalScoring(): any {
  return {
    readinessScore: 65,
    riskIndex: 35,
    recommendation: 'Pallier2_confirmed',
    recommendationMessage: 'Profil compatible avec le Pallier 2 Excellence',
    domainScores: [
      { domain: 'algebra', score: 75, evaluatedCount: 3, totalCount: 4, gaps: [], dominantErrors: [], priority: 'low' },
      { domain: 'analysis', score: 50, evaluatedCount: 3, totalCount: 4, gaps: ['limites'], dominantErrors: ['calcul'], priority: 'medium' },
      { domain: 'geometry', score: 40, evaluatedCount: 2, totalCount: 3, gaps: ['vecteurs'], dominantErrors: [], priority: 'high' },
    ],
    alerts: [{ type: 'info', code: 'LOW_WORK_VOLUME', message: 'Volume de travail à augmenter' }],
    dataQuality: { activeDomains: 3, evaluatedCompetencies: 8, lowConfidence: false },
  };
}

// ─── generateBilans — LLM success ────────────────────────────────────────────

describe('generateBilans — LLM success', () => {
  it('should generate 3 bilans when LLM succeeds', async () => {
    mockOllamaChat
      .mockResolvedValueOnce('# Bilan Élève\n\nContenu détaillé du bilan élève avec plus de 50 caractères pour passer la validation.')
      .mockResolvedValueOnce('# Rapport Parents\n\nContenu détaillé du rapport parents avec plus de 50 caractères pour passer la validation.')
      .mockResolvedValueOnce('# Fiche Nexus\n\nContenu détaillé de la fiche Nexus avec plus de 50 caractères pour passer la validation.');

    const result = await generateBilans(makeMinimalData(), makeMinimalScoring());

    expect(result.eleve).toContain('Bilan Élève');
    expect(result.parents).toContain('Rapport Parents');
    expect(result.nexus).toContain('Fiche Nexus');
    expect(mockOllamaChat).toHaveBeenCalledTimes(3);
  });

  it('should call RAG search for pedagogical context', async () => {
    mockOllamaChat.mockResolvedValue('# Bilan\n\nContenu suffisamment long pour passer la validation de longueur minimale de 50 caractères.');

    await generateBilans(makeMinimalData(), makeMinimalScoring());

    expect(mockRagSearch).toHaveBeenCalled();
  });

  it('should call buildRAGContext with search results', async () => {
    mockRagSearch.mockResolvedValue([
      { id: 'h1', document: 'Les dérivées...', metadata: {}, distance: 0.1 },
    ]);
    mockBuildRAGContext.mockReturnValue('\n--- CONTEXTE ---\nLes dérivées...\n--- FIN ---\n');
    mockOllamaChat.mockResolvedValue('# Bilan\n\nContenu suffisamment long pour passer la validation de longueur minimale de 50 caractères.');

    await generateBilans(makeMinimalData(), makeMinimalScoring());

    expect(mockBuildRAGContext).toHaveBeenCalled();
  });
});

// ─── generateBilans — LLM fallback ──────────────────────────────────────────

describe('generateBilans — LLM fallback', () => {
  it('should use fallback bilans when LLM fails completely', async () => {
    mockOllamaChat.mockRejectedValue(new Error('Ollama timeout'));

    const result = await generateBilans(makeMinimalData(), makeMinimalScoring());

    // Fallback bilans should contain student name
    expect(result.eleve).toContain('Ahmed');
    expect(result.parents).toContain('Ahmed');
    expect(result.nexus).toContain('ReadinessScore');
  });

  it('should use fallback for individual audience when that LLM call fails', async () => {
    mockOllamaChat
      .mockResolvedValueOnce('# Bilan Élève\n\nContenu détaillé du bilan élève avec plus de 50 caractères pour passer la validation.')
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce('# Fiche Nexus\n\nContenu détaillé de la fiche Nexus avec plus de 50 caractères pour passer la validation.');

    const result = await generateBilans(makeMinimalData(), makeMinimalScoring());

    expect(result.eleve).toContain('Bilan Élève');
    expect(result.parents).toContain('Ahmed'); // fallback
    expect(result.nexus).toContain('Fiche Nexus');
  });

  it('should use fallback when LLM returns too short response', async () => {
    mockOllamaChat.mockResolvedValue('Short'); // < 50 chars triggers error

    const result = await generateBilans(makeMinimalData(), makeMinimalScoring());

    // All should be fallback since LLM response is too short
    expect(result.eleve).toContain('Ahmed');
    expect(result.parents).toContain('Ahmed');
  });
});

// ─── generateBilans — RAG resilience ─────────────────────────────────────────

describe('generateBilans — RAG resilience', () => {
  it('should proceed without RAG context when RAG fails', async () => {
    mockRagSearch.mockRejectedValue(new Error('RAG connection refused'));
    mockOllamaChat.mockResolvedValue('# Bilan\n\nContenu suffisamment long pour passer la validation de longueur minimale de 50 caractères.');

    const result = await generateBilans(makeMinimalData(), makeMinimalScoring());

    expect(result.eleve).toBeTruthy();
    expect(result.parents).toBeTruthy();
    expect(result.nexus).toBeTruthy();
  });
});

// ─── generateBilans — fallback content quality ───────────────────────────────

describe('generateBilans — fallback content quality', () => {
  beforeEach(() => {
    mockOllamaChat.mockRejectedValue(new Error('LLM unavailable'));
  });

  it('should include readiness score in eleve fallback', async () => {
    const result = await generateBilans(makeMinimalData(), makeMinimalScoring());
    expect(result.eleve).toContain('65/100');
  });

  it('should include recommendation in parents fallback', async () => {
    const result = await generateBilans(makeMinimalData(), makeMinimalScoring());
    expect(result.parents).toContain('Pallier 2 Excellence');
  });

  it('should include domain scores in nexus fallback', async () => {
    const result = await generateBilans(makeMinimalData(), makeMinimalScoring());
    expect(result.nexus).toContain('algebra');
    expect(result.nexus).toContain('analysis');
  });

  it('should include alerts in fallback bilans', async () => {
    const result = await generateBilans(makeMinimalData(), makeMinimalScoring());
    expect(result.nexus).toContain('Volume de travail');
  });

  it('should include verbatims in nexus fallback', async () => {
    const result = await generateBilans(makeMinimalData(), makeMinimalScoring());
    expect(result.nexus).toContain('Intégrales');
  });
});
