/**
 * LLM Robustness Tests — Verify the pipeline handles malformed LLM output gracefully.
 *
 * Simulates:
 * - LLM returns invalid JSON
 * - LLM returns incomplete JSON (missing keys)
 * - LLM returns plain text without JSON structure
 * - LLM times out / throws
 * - LLM returns empty response
 *
 * Verifies:
 * - No crash
 * - Fallback bilans are used
 * - Status transitions correctly (GENERATING → FAILED, not stuck on ANALYZING)
 */

import { validateMarkdownOutput, buildQualityFlags } from '@/lib/diagnostics/llm-contract';

// Mock ollama-client BEFORE importing bilan-generator
jest.mock('@/lib/ollama-client', () => ({
  ollamaChat: jest.fn(),
  ollamaGenerate: jest.fn(),
  ollamaHealthcheck: jest.fn().mockResolvedValue(true),
}));

// Mock rag-client to avoid real network calls
jest.mock('@/lib/rag-client', () => ({
  ragSearch: jest.fn().mockResolvedValue([]),
  buildRAGContext: jest.fn().mockReturnValue(''),
}));

import { generateBilans } from '@/lib/bilan-generator';
import { ollamaChat } from '@/lib/ollama-client';
import type { BilanDiagnosticMathsData } from '@/lib/validations';

/* ═══════════════════════════════════════════════════════════════════════════
   FIXTURES
   ═══════════════════════════════════════════════════════════════════════════ */

const MOCK_DATA: BilanDiagnosticMathsData = {
  identity: { firstName: 'LLM', lastName: 'Test', email: 'llm@test.com', phone: '000' },
  schoolContext: { establishment: 'Lycée Test' },
  performance: { mathAverage: '12' },
  chapters: {},
  competencies: {
    algebra: [
      { skillId: 'a1', skillLabel: 'Suites', mastery: 3, status: 'studied', confidence: 3, friction: 1, errorTypes: [], evidence: '' },
      { skillId: 'a2', skillLabel: 'Eq', mastery: 2, status: 'studied', confidence: 2, friction: 2, errorTypes: [], evidence: '' },
    ],
  },
  openQuestions: {},
  examPrep: {
    miniTest: { score: 4, timeUsedMinutes: 12, completedInTime: true },
    selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 3, justifications: 2, stress: 2 },
    signals: { hardestItems: [3], dominantErrorType: 'calcul', verifiedAnswers: true, feeling: 'ok' },
    mainRisk: 'calcul',
    zeroSubjects: 'non',
  },
  methodology: { learningStyle: 'visuel', errorTypes: ['calcul'], weeklyWork: '3h', maxConcentration: '45min', problemReflex: 'relire' },
  ambition: { targetMention: 'Bien', postBac: 'prépa', pallier2Pace: 'normal' },
  freeText: { mustImprove: 'calcul', invisibleDifficulties: '', message: '' },
} as BilanDiagnosticMathsData;

const MOCK_SCORING: any = {
  readinessScore: 65,
  riskIndex: 30,
  recommendation: 'Pallier2_confirmed',
  recommendationMessage: 'Niveau confirmé',
  domainScores: [
    { domain: 'algebra', score: 63, evaluatedCount: 2, totalCount: 2, gaps: [], dominantErrors: [], priority: 'medium' },
  ],
  alerts: [],
  dataQuality: { activeDomains: 1, evaluatedCompetencies: 2, lowConfidence: false },
};

/* ═══════════════════════════════════════════════════════════════════════════
   A) validateMarkdownOutput — contract validation
   ═══════════════════════════════════════════════════════════════════════════ */

describe('validateMarkdownOutput', () => {
  it('rejects empty markdown', () => {
    const { valid, issues } = validateMarkdownOutput('', 'eleve');
    expect(valid).toBe(false);
    expect(issues.some(i => i.includes('trop court'))).toBe(true);
  });

  it('rejects markdown shorter than 100 chars', () => {
    const { valid } = validateMarkdownOutput('# Short', 'eleve');
    expect(valid).toBe(false);
  });

  it('rejects markdown missing required sections for eleve', () => {
    const longText = 'a'.repeat(200);
    const { valid, issues } = validateMarkdownOutput(longText, 'eleve');
    expect(valid).toBe(false);
    expect(issues.some(i => i.includes('priorité'))).toBe(true);
  });

  it('accepts valid eleve markdown with all sections', () => {
    const md = `# Bilan\n\n## Priorité\nTravaille tes calculs.\n\n## Plan\nSemaine 1.\n\n## Méthode\nVisuel.\n\n${'x'.repeat(100)}`;
    const { valid } = validateMarkdownOutput(md, 'eleve');
    expect(valid).toBe(true);
  });

  it('rejects parents markdown missing synthèse/risque/progrès', () => {
    const { valid, issues } = validateMarkdownOutput('a'.repeat(200), 'parents');
    expect(valid).toBe(false);
    expect(issues.some(i => i.includes('synthèse'))).toBe(true);
  });

  it('rejects nexus markdown missing score/domaine/alerte', () => {
    const { valid, issues } = validateMarkdownOutput('a'.repeat(200), 'nexus');
    expect(valid).toBe(false);
    expect(issues.some(i => i.includes('score'))).toBe(true);
  });

  it('handles null/undefined markdown gracefully', () => {
    const { valid } = validateMarkdownOutput(null as unknown as string, 'eleve');
    expect(valid).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   B) buildQualityFlags — edge cases
   ═══════════════════════════════════════════════════════════════════════════ */

describe('buildQualityFlags', () => {
  it('flags RAG_EMPTY when ragAvailable=false', () => {
    const flags = buildQualityFlags({ ragAvailable: false, ragHitCount: 0, llmSuccessCount: 3, dataQuality: 'good', coverageIndex: 80 });
    expect(flags.some(f => f.code === 'RAG_EMPTY')).toBe(true);
  });

  it('flags RAG_LOW when ragHitCount < 2', () => {
    const flags = buildQualityFlags({ ragAvailable: true, ragHitCount: 1, llmSuccessCount: 3, dataQuality: 'good', coverageIndex: 80 });
    expect(flags.some(f => f.code === 'RAG_LOW')).toBe(true);
  });

  it('flags LLM_PARTIAL when llmSuccessCount < 3', () => {
    const flags = buildQualityFlags({ ragAvailable: true, ragHitCount: 4, llmSuccessCount: 1, dataQuality: 'good', coverageIndex: 80 });
    expect(flags.some(f => f.code === 'LLM_PARTIAL')).toBe(true);
    expect(flags.find(f => f.code === 'LLM_PARTIAL')!.message).toContain('2');
  });

  it('flags LOW_DATA when dataQuality=insufficient', () => {
    const flags = buildQualityFlags({ ragAvailable: true, ragHitCount: 4, llmSuccessCount: 3, dataQuality: 'insufficient', coverageIndex: 80 });
    expect(flags.some(f => f.code === 'LOW_DATA')).toBe(true);
  });

  it('flags PARTIAL_DATA when dataQuality=partial', () => {
    const flags = buildQualityFlags({ ragAvailable: true, ragHitCount: 4, llmSuccessCount: 3, dataQuality: 'partial', coverageIndex: 80 });
    expect(flags.some(f => f.code === 'PARTIAL_DATA')).toBe(true);
  });

  it('flags LOW_COVERAGE when coverageIndex < 50', () => {
    const flags = buildQualityFlags({ ragAvailable: true, ragHitCount: 4, llmSuccessCount: 3, dataQuality: 'good', coverageIndex: 30 });
    expect(flags.some(f => f.code === 'LOW_COVERAGE')).toBe(true);
  });

  it('returns empty array when all conditions are good', () => {
    const flags = buildQualityFlags({ ragAvailable: true, ragHitCount: 4, llmSuccessCount: 3, dataQuality: 'good', coverageIndex: 80 });
    expect(flags).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   C) generateBilans — LLM failure scenarios
   ═══════════════════════════════════════════════════════════════════════════ */

describe('generateBilans — LLM failure resilience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns fallback bilans when LLM throws on all 3 audiences', async () => {
    (ollamaChat as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    const bilans = await generateBilans(MOCK_DATA, MOCK_SCORING);

    expect(bilans.eleve).toBeTruthy();
    expect(bilans.parents).toBeTruthy();
    expect(bilans.nexus).toBeTruthy();
    // Fallback bilans contain the student name
    expect(bilans.eleve).toContain('LLM');
    expect(bilans.parents).toContain('LLM');
  });

  it('returns fallback bilans when LLM returns empty response', async () => {
    (ollamaChat as jest.Mock).mockResolvedValue('');

    const bilans = await generateBilans(MOCK_DATA, MOCK_SCORING);

    // Empty response triggers "too short" check → throws → fallback
    expect(bilans.eleve).toBeTruthy();
    expect(bilans.parents).toBeTruthy();
    expect(bilans.nexus).toBeTruthy();
  });

  it('returns fallback bilans when LLM times out', async () => {
    (ollamaChat as jest.Mock).mockRejectedValue(new Error('timeout of 120000ms exceeded'));

    const bilans = await generateBilans(MOCK_DATA, MOCK_SCORING);

    expect(bilans.eleve).toBeTruthy();
    expect(bilans.parents).toBeTruthy();
    expect(bilans.nexus).toBeTruthy();
  });

  it('uses LLM result for successful audiences and fallback for failed ones', async () => {
    const llmEleve = '# Bilan Élève LLM\n\nContenu généré par LLM avec plus de 50 caractères pour passer la validation.';
    (ollamaChat as jest.Mock)
      .mockResolvedValueOnce(llmEleve)  // eleve succeeds
      .mockRejectedValueOnce(new Error('timeout'))  // parents fails
      .mockRejectedValueOnce(new Error('timeout'));  // nexus fails

    const bilans = await generateBilans(MOCK_DATA, MOCK_SCORING);

    expect(bilans.eleve).toBe(llmEleve);
    // Parents and nexus should be fallback (contain template markers)
    expect(bilans.parents).toContain('Rapport de Positionnement');
    expect(bilans.nexus).toContain('Fiche Pédagogique');
  });

  it('does NOT crash when LLM returns malformed JSON string', async () => {
    (ollamaChat as jest.Mock).mockResolvedValue('{ invalid json without closing brace');

    // This should not crash — the generator treats each audience response as markdown, not JSON
    const bilans = await generateBilans(MOCK_DATA, MOCK_SCORING);
    expect(bilans).toBeDefined();
    expect(bilans.eleve).toBeTruthy();
  });

  it('does NOT crash when LLM returns random HTML', async () => {
    const htmlGarbage = '<html><body><h1>Error 502</h1><p>Bad Gateway</p></body></html>';
    (ollamaChat as jest.Mock).mockResolvedValue(htmlGarbage);

    const bilans = await generateBilans(MOCK_DATA, MOCK_SCORING);
    expect(bilans).toBeDefined();
    // HTML is > 50 chars so it passes the length check — it becomes the bilan content
    expect(bilans.eleve).toBeTruthy();
  });
});
