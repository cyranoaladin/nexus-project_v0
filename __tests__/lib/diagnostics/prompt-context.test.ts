/**
 * Tests for prompt-context.ts — chapter-aware prompt context pack builder
 */

import {
  resolveChaptersSelection,
  getNotYetSkillIds,
  getChapterLabels,
  buildPromptContextPack,
  renderPromptContext,
  buildChapterAwareRAGQueries,
} from '@/lib/diagnostics/prompt-context';
import type { DiagnosticDefinition, ChapterDefinition, ScoringV2Result } from '@/lib/diagnostics/types';
import type { BilanDiagnosticMathsData } from '@/lib/validations';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_CHAPTERS: ChapterDefinition[] = [
  { chapterId: 'CH1', chapterLabel: 'Suites', description: 'Suites arithmétiques', domainId: 'algebra', skills: ['S1', 'S2'] },
  { chapterId: 'CH2', chapterLabel: 'Dérivation', description: 'Nombre dérivé', domainId: 'analysis', skills: ['S3', 'S4'] },
  { chapterId: 'CH3', chapterLabel: 'Probas', description: 'Conditionnelles', domainId: 'prob', skills: ['S5'] },
  { chapterId: 'CH4', chapterLabel: 'Géométrie', description: 'Produit scalaire', domainId: 'geometry', skills: ['S6', 'S7'] },
];

const MOCK_DEFINITION: DiagnosticDefinition = {
  key: 'maths-premiere-p2',
  version: 'v1.3',
  label: 'Diagnostic Maths Première',
  track: 'maths',
  level: 'premiere',
  stage: 'pallier2',
  skills: {
    algebra: [
      { skillId: 'S1', label: 'Suites arith', domain: 'algebra' },
      { skillId: 'S2', label: 'Suites géo', domain: 'algebra' },
    ],
    analysis: [
      { skillId: 'S3', label: 'Dérivée', domain: 'analysis' },
      { skillId: 'S4', label: 'Variations', domain: 'analysis' },
    ],
    prob: [{ skillId: 'S5', label: 'Conditionnelles', domain: 'prob' }],
    geometry: [
      { skillId: 'S6', label: 'Produit scalaire', domain: 'geometry' },
      { skillId: 'S7', label: 'Al-Kashi', domain: 'geometry' },
    ],
  },
  chapters: MOCK_CHAPTERS,
  scoringPolicy: {
    domainWeights: { algebra: 0.3, analysis: 0.3, prob: 0.2, geometry: 0.2 },
    thresholds: { confirmed: { readiness: 60, risk: 55 }, conditional: { readiness: 48, risk: 70 } },
  },
  prompts: { version: 'v1', eleve: '', parents: '', nexus: '' },
  ragPolicy: { collections: ['maths_premiere'], maxQueries: 4, topK: 3 },
  examFormat: { duration: 120, calculatorAllowed: false, structure: '6pts auto + 14pts exercices', totalPoints: 20 },
  riskModel: { factors: ['stress', 'temps'] },
};

function makeMockData(overrides: Partial<BilanDiagnosticMathsData> = {}): BilanDiagnosticMathsData {
  return {
    version: 'v1.3',
    discipline: 'maths',
    level: 'premiere',
    definitionKey: 'maths-premiere-p2',
    identity: { firstName: 'Test', lastName: 'User', email: 'test@test.com', phone: '12345678' },
    schoolContext: { mathTrack: 'eds_maths_1ere' },
    performance: { mathAverage: '14' },
    chapters: {
      selected: ['CH1', 'CH2'],
      inProgress: ['CH3'],
      notYet: ['CH4'],
    },
    competencies: {
      algebra: [
        { skillId: 'S1', skillLabel: 'Suites arith', status: 'studied', mastery: 3, confidence: 2, friction: 1, errorTypes: [], evidence: '' },
        { skillId: 'S2', skillLabel: 'Suites géo', status: 'studied', mastery: 2, confidence: 2, friction: 1, errorTypes: ['calcul'], evidence: '' },
      ],
      analysis: [
        { skillId: 'S3', skillLabel: 'Dérivée', status: 'studied', mastery: 1, confidence: 1, friction: 2, errorTypes: ['methode'], evidence: '' },
        { skillId: 'S4', skillLabel: 'Variations', status: 'in_progress', mastery: 2, confidence: 1, friction: 1, errorTypes: [], evidence: '' },
      ],
    },
    openQuestions: {},
    examPrep: {
      miniTest: { score: 4, timeUsedMinutes: 12, completedInTime: true },
      selfRatings: { speedNoCalc: 2, calcReliability: 3, redaction: 2, justifications: 2, stress: 2 },
      signals: { hardestItems: [3, 5], verifiedAnswers: true, feeling: 'neutral' },
    },
    methodology: { learningStyle: 'practice', errorTypes: ['calcul', 'methode'] },
    ambition: { targetMention: 'bien' },
    freeText: {},
    ...overrides,
  } as BilanDiagnosticMathsData;
}

const MOCK_SCORING: ScoringV2Result = {
  masteryIndex: 55,
  coverageIndex: 60,
  examReadinessIndex: 65,
  readinessScore: 58,
  riskIndex: 42,
  recommendation: 'Pallier2_conditional',
  recommendationMessage: 'Pallier 2 possible avec accompagnement',
  justification: 'Test justification',
  upgradeConditions: ['Améliorer mastery'],
  domainScores: [
    { domain: 'algebra', score: 62, evaluatedCount: 2, totalCount: 2, notStudiedCount: 0, unknownCount: 0, gaps: [], dominantErrors: ['calcul'], priority: 'medium' },
    { domain: 'analysis', score: 37, evaluatedCount: 2, totalCount: 2, notStudiedCount: 0, unknownCount: 0, gaps: ['Dérivée'], dominantErrors: ['methode'], priority: 'high' },
    { domain: 'prob', score: 0, evaluatedCount: 0, totalCount: 1, notStudiedCount: 1, unknownCount: 0, gaps: [], dominantErrors: [], priority: 'critical' },
    { domain: 'geometry', score: 0, evaluatedCount: 0, totalCount: 2, notStudiedCount: 2, unknownCount: 0, gaps: [], dominantErrors: [], priority: 'critical' },
  ],
  alerts: [],
  dataQuality: { activeDomains: 2, evaluatedCompetencies: 4, notStudiedCompetencies: 3, unknownCompetencies: 0, lowConfidence: true, quality: 'partial', coherenceIssues: 0, miniTestFilled: true, criticalFieldsMissing: 0 },
  trustScore: 65,
  trustLevel: 'orange',
  topPriorities: [
    { skillLabel: 'Dérivée', domain: 'analysis', reason: 'Mastery 1/4', impact: 'Impact direct', exerciseType: 'Exercices ciblés' },
  ],
  quickWins: [],
  highRisk: [],
  inconsistencies: [],
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('resolveChaptersSelection', () => {
  it('computes notYet from definition chapters minus selected and inProgress', () => {
    const data = makeMockData();
    const result = resolveChaptersSelection(data, MOCK_DEFINITION);
    expect(result.selected).toEqual(['CH1', 'CH2']);
    expect(result.inProgress).toEqual(['CH3']);
    expect(result.notYet).toEqual(['CH4']);
  });

  it('returns all chapters as notYet when none selected', () => {
    const data = makeMockData({ chapters: {} as BilanDiagnosticMathsData['chapters'] });
    const result = resolveChaptersSelection(data, MOCK_DEFINITION);
    expect(result.selected).toEqual([]);
    expect(result.inProgress).toEqual([]);
    expect(result.notYet).toEqual(['CH1', 'CH2', 'CH3', 'CH4']);
  });

  it('handles null definition gracefully', () => {
    const data = makeMockData();
    const result = resolveChaptersSelection(data, null);
    expect(result.notYet).toEqual([]);
  });
});

describe('getNotYetSkillIds', () => {
  it('returns skill IDs from notYet chapters', () => {
    const selection = { selected: ['CH1'], inProgress: ['CH2'], notYet: ['CH3', 'CH4'] };
    const result = getNotYetSkillIds(selection, MOCK_CHAPTERS);
    expect(result).toEqual(new Set(['S5', 'S6', 'S7']));
  });

  it('returns empty set when no notYet chapters', () => {
    const selection = { selected: ['CH1', 'CH2', 'CH3', 'CH4'], inProgress: [], notYet: [] };
    const result = getNotYetSkillIds(selection, MOCK_CHAPTERS);
    expect(result.size).toBe(0);
  });
});

describe('getChapterLabels', () => {
  it('maps chapter IDs to labels', () => {
    const labels = getChapterLabels(['CH1', 'CH3'], MOCK_CHAPTERS);
    expect(labels).toEqual(['Suites', 'Probas']);
  });

  it('falls back to ID for unknown chapters', () => {
    const labels = getChapterLabels(['CH1', 'UNKNOWN'], MOCK_CHAPTERS);
    expect(labels).toEqual(['Suites', 'UNKNOWN']);
  });
});

describe('buildPromptContextPack', () => {
  it('builds a complete context pack', () => {
    const data = makeMockData();
    const pack = buildPromptContextPack(data, MOCK_SCORING, MOCK_DEFINITION, 'RAG context here');

    expect(pack.programme.discipline).toBe('maths');
    expect(pack.programme.level).toBe('premiere');
    expect(pack.programme.definitionKey).toBe('maths-premiere-p2');
    expect(pack.chaptersSeen).toEqual(['Suites', 'Dérivation']);
    expect(pack.chaptersInProgress).toEqual(['Probas']);
    expect(pack.chaptersNotYet).toEqual(['Géométrie']);
    expect(pack.scoring.readinessScore).toBe(58);
    expect(pack.weakestDomains.length).toBeGreaterThan(0);
    expect(pack.examFormat).not.toBeNull();
    expect(pack.examFormat?.duration).toBe(120);
    expect(pack.riskFactors).toEqual(['stress', 'temps']);
    expect(pack.ragContext).toBe('RAG context here');
  });

  it('handles null definition', () => {
    const data = makeMockData();
    const pack = buildPromptContextPack(data, MOCK_SCORING, null, '');
    // With null definition, selected IDs are returned as-is (no label mapping)
    expect(pack.chaptersSeen).toEqual(['CH1', 'CH2']);
    expect(pack.chaptersNotYet).toEqual([]);
    expect(pack.examFormat).toBeNull();
    expect(pack.riskFactors).toEqual([]);
  });
});

describe('renderPromptContext', () => {
  it('renders a non-empty string with key sections', () => {
    const data = makeMockData();
    const pack = buildPromptContextPack(data, MOCK_SCORING, MOCK_DEFINITION, '');
    const rendered = renderPromptContext(pack);

    expect(rendered).toContain('PROGRAMME: MATHS premiere');
    expect(rendered).toContain('CHAPITRES VUS');
    expect(rendered).toContain('Suites');
    expect(rendered).toContain('CHAPITRES NON VUS');
    expect(rendered).toContain('Géométrie');
    expect(rendered).toContain('CONSIGNE IMPORTANTE');
    expect(rendered).toContain('SCORES:');
    expect(rendered).toContain('FORMAT ÉPREUVE:');
    expect(rendered).toContain('120min');
  });
});

describe('buildChapterAwareRAGQueries', () => {
  it('builds queries from weakest seen chapters', () => {
    const data = makeMockData();
    const queries = buildChapterAwareRAGQueries(data, MOCK_SCORING, MOCK_DEFINITION);

    expect(queries.length).toBeGreaterThan(0);
    expect(queries.length).toBeLessThanOrEqual(4);
    // Should reference maths premiere
    expect(queries.some(q => q.includes('maths'))).toBe(true);
  });

  it('includes error type query when errors present', () => {
    const data = makeMockData();
    const queries = buildChapterAwareRAGQueries(data, MOCK_SCORING, MOCK_DEFINITION);
    expect(queries.some(q => q.includes('calcul') || q.includes('methode'))).toBe(true);
  });

  it('includes exam format query', () => {
    const data = makeMockData();
    const queries = buildChapterAwareRAGQueries(data, MOCK_SCORING, MOCK_DEFINITION);
    expect(queries.some(q => q.includes('épreuve') || q.includes('préparation'))).toBe(true);
  });

  it('handles null definition gracefully', () => {
    const data = makeMockData();
    const queries = buildChapterAwareRAGQueries(data, MOCK_SCORING, null);
    expect(queries.length).toBeGreaterThanOrEqual(0);
  });
});
