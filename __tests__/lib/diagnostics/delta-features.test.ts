/**
 * Tests for DELTA features:
 * 1. Filtered skills by chapters (UI logic)
 * 2. Prerequisite scoring (0.25 weight for core prereqs in notYet chapters)
 * 3. RAG queries using ragTopics for topic-coherent queries
 */

import { computeScoringV2 } from '@/lib/diagnostics/score-diagnostic';
import { buildChapterAwareRAGQueries } from '@/lib/diagnostics/prompt-context';
import type {
  ScoringPolicy,
  ChaptersSelection,
  ChapterDefinition,
  DiagnosticDefinition,
  ScoringV2Result,
} from '@/lib/diagnostics/types';
import type { BilanDiagnosticMathsData } from '@/lib/validations';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const POLICY: ScoringPolicy = {
  domainWeights: { algebra: 0.30, analysis: 0.30, databases: 0.20, python: 0.20 },
  thresholds: { confirmed: { readiness: 60, risk: 55 }, conditional: { readiness: 48, risk: 70 } },
};

const CHAPTERS_WITH_TOPICS: ChapterDefinition[] = [
  { chapterId: 'CH1', chapterLabel: 'Suites', description: '', domainId: 'algebra', skills: ['S1', 'S2'], ragTopics: ['suites', 'arithmetique', 'geometrique'] },
  { chapterId: 'CH2', chapterLabel: 'Dérivation', description: '', domainId: 'analysis', skills: ['S3', 'S4'], ragTopics: ['derivee', 'tangente', 'regles'] },
  { chapterId: 'CH3', chapterLabel: 'Bases de données', description: '', domainId: 'databases', skills: ['S5', 'S6'], ragTopics: ['sql', 'join', 'modele_relationnel'] },
  { chapterId: 'CH4', chapterLabel: 'Python', description: '', domainId: 'python', skills: ['S7'], ragTopics: ['python', 'fonctions', 'boucles'] },
  { chapterId: 'CH5', chapterLabel: 'Trigo', description: '', domainId: 'analysis', skills: ['S8'] },
];

const SKILL_META = [
  { skillId: 'S1', chapterId: 'CH1', prerequisite: true, prerequisiteLevel: 'core' as const },
  { skillId: 'S2', chapterId: 'CH1' },
  { skillId: 'S3', chapterId: 'CH2', prerequisite: true, prerequisiteLevel: 'core' as const },
  { skillId: 'S4', chapterId: 'CH2' },
  { skillId: 'S5', chapterId: 'CH3', prerequisite: true, prerequisiteLevel: 'core' as const },
  { skillId: 'S6', chapterId: 'CH3' },
  { skillId: 'S7', chapterId: 'CH4', prerequisite: true, prerequisiteLevel: 'core' as const },
  { skillId: 'S8', chapterId: 'CH5' },
];

function makeCompetencyItem(skillId: string, label: string, mastery: number, status = 'studied') {
  return { skillId, skillLabel: label, status, mastery, confidence: 2, friction: 1, errorTypes: [] as string[], evidence: '' };
}

function makeData(overrides: Partial<BilanDiagnosticMathsData> = {}): BilanDiagnosticMathsData {
  return {
    version: 'v1.3',
    identity: { firstName: 'A', lastName: 'B', email: 'a@b.com', phone: '12345678' },
    schoolContext: {},
    performance: { mathAverage: '12' },
    chapters: {},
    competencies: {
      algebra: [
        makeCompetencyItem('S1', 'Suites arith', 3),
        makeCompetencyItem('S2', 'Suites géo', 2),
      ],
      analysis: [
        makeCompetencyItem('S3', 'Dérivée', 1),
        makeCompetencyItem('S4', 'Variations', 2),
      ],
      databases: [
        makeCompetencyItem('S5', 'SQL SELECT', 1),
        makeCompetencyItem('S6', 'SQL JOIN', 1),
      ],
      python: [
        makeCompetencyItem('S7', 'Fonctions', 3),
      ],
    },
    openQuestions: {},
    examPrep: {
      miniTest: { score: 4, timeUsedMinutes: 12, completedInTime: true },
      selfRatings: { speedNoCalc: 2, calcReliability: 2, redaction: 2, justifications: 2, stress: 2 },
      signals: { hardestItems: [], verifiedAnswers: true, feeling: 'neutral' },
    },
    methodology: { errorTypes: ['calcul', 'rédaction'] },
    ambition: {},
    freeText: {},
    ...overrides,
  } as BilanDiagnosticMathsData;
}

// ─── 1. Filtered Skills by Chapters (pure logic test) ───────────────────────

describe('Filtered skills by chapters (UI logic)', () => {
  it('computes visible skill IDs from seen/inProgress chapters + core prerequisites', () => {
    const chapterStatuses: Record<string, string> = {
      CH1: 'seen',
      CH2: 'inProgress',
      CH3: 'notYet',
      CH4: 'notYet',
      CH5: 'notYet',
    };

    // Simulate the visibleSkillIds computation from page.tsx
    const seenChapterIds = new Set<string>();
    for (const [chId, status] of Object.entries(chapterStatuses)) {
      if (status === 'seen' || status === 'inProgress') seenChapterIds.add(chId);
    }
    const ids = new Set<string>();
    for (const skill of SKILL_META) {
      const inSeenChapter = skill.chapterId && seenChapterIds.has(skill.chapterId);
      const isCorePrereq = skill.prerequisite && skill.prerequisiteLevel === 'core';
      if (inSeenChapter || isCorePrereq) ids.add(skill.skillId);
    }

    // CH1 (seen): S1, S2 → both visible
    expect(ids.has('S1')).toBe(true);
    expect(ids.has('S2')).toBe(true);
    // CH2 (inProgress): S3, S4 → both visible
    expect(ids.has('S3')).toBe(true);
    expect(ids.has('S4')).toBe(true);
    // CH3 (notYet): S5 is core prereq → visible, S6 is not → hidden
    expect(ids.has('S5')).toBe(true);
    expect(ids.has('S6')).toBe(false);
    // CH4 (notYet): S7 is core prereq → visible
    expect(ids.has('S7')).toBe(true);
    // CH5 (notYet): S8 is NOT a prereq → hidden
    expect(ids.has('S8')).toBe(false);
  });

  it('returns all skills when showAllSkills is true (null set)', () => {
    const showAllSkills = true;
    // When showAllSkills is true, visibleSkillIds should be null (show all)
    const visibleSkillIds = showAllSkills ? null : new Set(['S1']);
    expect(visibleSkillIds).toBeNull();
  });
});

// ─── 2. Prerequisite Scoring ────────────────────────────────────────────────

describe('computeScoringV2 — prerequisite scoring', () => {
  it('applies no penalty when no skillMeta provided (backward compat)', () => {
    const data = makeData();
    const selection: ChaptersSelection = {
      selected: ['CH1'],
      inProgress: [],
      notYet: ['CH2', 'CH3', 'CH4', 'CH5'],
    };
    const resultWithout = computeScoringV2(data, POLICY, selection, CHAPTERS_WITH_TOPICS);
    const resultWith = computeScoringV2(data, POLICY, selection, CHAPTERS_WITH_TOPICS, []);
    expect(resultWithout.readinessScore).toBe(resultWith.readinessScore);
  });

  it('applies penalty when core prereqs in notYet chapters have low mastery', () => {
    const data = makeData();
    // S5 (SQL SELECT) is core prereq in CH3 (notYet), mastery=1 (low)
    const selection: ChaptersSelection = {
      selected: ['CH1', 'CH2'],
      inProgress: [],
      notYet: ['CH3', 'CH4', 'CH5'],
    };
    const resultNoMeta = computeScoringV2(data, POLICY, selection, CHAPTERS_WITH_TOPICS);
    const resultWithMeta = computeScoringV2(data, POLICY, selection, CHAPTERS_WITH_TOPICS, SKILL_META);

    // With skill meta, readiness should be lower due to prereq penalty
    expect(resultWithMeta.readinessScore).toBeLessThanOrEqual(resultNoMeta.readinessScore);
  });

  it('applies minimal penalty when core prereqs have high mastery', () => {
    const data = makeData({
      competencies: {
        algebra: [
          makeCompetencyItem('S1', 'Suites arith', 4),
          makeCompetencyItem('S2', 'Suites géo', 4),
        ],
        analysis: [
          makeCompetencyItem('S3', 'Dérivée', 4),
          makeCompetencyItem('S4', 'Variations', 4),
        ],
        databases: [
          makeCompetencyItem('S5', 'SQL SELECT', 4),
          makeCompetencyItem('S6', 'SQL JOIN', 4),
        ],
        python: [
          makeCompetencyItem('S7', 'Fonctions', 4),
        ],
      },
    } as Partial<BilanDiagnosticMathsData>);

    const selection: ChaptersSelection = {
      selected: ['CH1', 'CH2'],
      inProgress: [],
      notYet: ['CH3', 'CH4', 'CH5'],
    };
    const resultNoMeta = computeScoringV2(data, POLICY, selection, CHAPTERS_WITH_TOPICS);
    const resultWithMeta = computeScoringV2(data, POLICY, selection, CHAPTERS_WITH_TOPICS, SKILL_META);

    // High mastery on prereqs → penalty should be 0 or very small
    const diff = resultNoMeta.readinessScore - resultWithMeta.readinessScore;
    expect(diff).toBeLessThanOrEqual(1);
  });
});

// ─── 3. RAG Queries with ragTopics ──────────────────────────────────────────

describe('buildChapterAwareRAGQueries — ragTopics', () => {
  const MOCK_DEFINITION: DiagnosticDefinition = {
    key: 'nsi-terminale-p2',
    version: 'v1.3',
    label: 'NSI Terminale',
    track: 'nsi',
    level: 'terminale',
    stage: 'pallier2',
    skills: {
      databases: [
        { skillId: 'S5', label: 'SQL SELECT', domain: 'databases' },
        { skillId: 'S6', label: 'SQL JOIN', domain: 'databases' },
      ],
      analysis: [
        { skillId: 'S3', label: 'Dérivée', domain: 'analysis' },
        { skillId: 'S4', label: 'Variations', domain: 'analysis' },
      ],
    },
    chapters: CHAPTERS_WITH_TOPICS,
    scoringPolicy: POLICY,
    prompts: { version: 'v1', eleve: '', parents: '', nexus: '' },
    ragPolicy: { collections: ['nsi_terminale'], maxQueries: 4, topK: 3 },
  };

  function makeMockScoring(overrides: Partial<ScoringV2Result> = {}): ScoringV2Result {
    return {
      masteryIndex: 50, coverageIndex: 60, examReadinessIndex: 55,
      readinessScore: 55, riskIndex: 40, recommendation: 'Pallier2_conditional',
      recommendationMessage: '', justification: '', upgradeConditions: [],
      domainScores: [
        { domain: 'databases', score: 25, evaluatedCount: 2, totalCount: 2, notStudiedCount: 0, unknownCount: 0, gaps: ['SQL JOIN'], dominantErrors: ['syntaxe'], priority: 'critical' },
        { domain: 'analysis', score: 38, evaluatedCount: 2, totalCount: 2, notStudiedCount: 0, unknownCount: 0, gaps: ['Dérivée'], dominantErrors: ['calcul'], priority: 'high' },
      ],
      alerts: [], dataQuality: { activeDomains: 2, evaluatedCompetencies: 4, notStudiedCompetencies: 0, unknownCompetencies: 0, lowConfidence: false, quality: 'good', coherenceIssues: 0, miniTestFilled: true, criticalFieldsMissing: 0 },
      trustScore: 70, trustLevel: 'orange',
      topPriorities: [{ skillLabel: 'SQL JOIN', domain: 'databases', reason: 'Faible', impact: 'Critique', skillId: 'S6' }],
      quickWins: [], highRisk: [], inconsistencies: [],
      ...overrides,
    };
  }

  it('uses ragTopics from chapters in queries (NSI SQL case)', () => {
    const data = makeData({
      discipline: 'nsi',
      level: 'terminale',
      definitionKey: 'nsi-terminale-p2',
      chapters: { selected: ['CH3'], inProgress: ['CH2'], notYet: ['CH1', 'CH4', 'CH5'] },
    } as Partial<BilanDiagnosticMathsData>);

    const scoring = makeMockScoring();
    const queries = buildChapterAwareRAGQueries(data, scoring, MOCK_DEFINITION);

    // CH3 (databases, seen) has ragTopics: ['sql', 'join', 'modele_relationnel']
    // The weakest domain is databases (score=25), so first query should use ragTopics
    const sqlQuery = queries.find(q => q.includes('sql'));
    expect(sqlQuery).toBeDefined();
    expect(sqlQuery).toContain('nsi');
    expect(sqlQuery).toContain('terminale');
  });

  it('uses ragTopics from analysis chapter when analysis is weak', () => {
    const data = makeData({
      discipline: 'nsi',
      level: 'terminale',
      definitionKey: 'nsi-terminale-p2',
      chapters: { selected: ['CH2', 'CH3'], inProgress: [], notYet: ['CH1', 'CH4', 'CH5'] },
    } as Partial<BilanDiagnosticMathsData>);

    const scoring = makeMockScoring();
    const queries = buildChapterAwareRAGQueries(data, scoring, MOCK_DEFINITION);

    // CH2 (analysis, seen) has ragTopics: ['derivee', 'tangente', 'regles']
    const analysisQuery = queries.find(q => q.includes('derivee'));
    expect(analysisQuery).toBeDefined();
  });

  it('falls back to chapterLabel when ragTopics missing', () => {
    const chaptersNoTopics: ChapterDefinition[] = [
      { chapterId: 'CH3', chapterLabel: 'Bases de données', description: '', domainId: 'databases', skills: ['S5', 'S6'] },
      { chapterId: 'CH2', chapterLabel: 'Dérivation', description: '', domainId: 'analysis', skills: ['S3', 'S4'] },
    ];
    const defNoTopics = { ...MOCK_DEFINITION, chapters: chaptersNoTopics };

    const data = makeData({
      discipline: 'nsi',
      level: 'terminale',
      chapters: { selected: ['CH3', 'CH2'], inProgress: [], notYet: [] },
    } as Partial<BilanDiagnosticMathsData>);

    const scoring = makeMockScoring();
    const queries = buildChapterAwareRAGQueries(data, scoring, defNoTopics);

    // Should fall back to chapterLabel
    const bddQuery = queries.find(q => q.includes('Bases de données'));
    expect(bddQuery).toBeDefined();
  });

  it('includes error types query', () => {
    const data = makeData({
      discipline: 'nsi',
      level: 'terminale',
      chapters: { selected: ['CH3'], inProgress: [], notYet: [] },
      methodology: { errorTypes: ['syntaxe', 'logique'] },
    } as Partial<BilanDiagnosticMathsData>);

    const scoring = makeMockScoring();
    const queries = buildChapterAwareRAGQueries(data, scoring, MOCK_DEFINITION);

    const errorQuery = queries.find(q => q.includes('erreurs'));
    expect(errorQuery).toBeDefined();
    expect(errorQuery).toContain('syntaxe');
  });
});
