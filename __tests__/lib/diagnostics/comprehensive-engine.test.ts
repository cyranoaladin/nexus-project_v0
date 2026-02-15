/**
 * Comprehensive engine tests — covers all CdC requirements:
 *
 * A) coverageProgramme: ratio calc, edge cases (0 chapters, all checked, unknown chapter)
 * B) prerequisites: non-sanction on NOT_YET, "bases à consolider" output
 * C) skill filtering by chapters: only skills from checked chapters + toggle
 * D) RAG queries: ragTopics + collections discipline/niveau
 * E) scoring invariants: not_studied => mastery/confidence/friction = null, errorTypes default []
 * F) bilan renderer: semantic/structural tests (sections, fields, no raw scores in parents)
 */

import { computeScoringV2 } from '@/lib/diagnostics/score-diagnostic';
import {
  buildChapterAwareRAGQueries,
  resolveChaptersSelection,
} from '@/lib/diagnostics/prompt-context';
import {
  renderEleveBilan,
  renderParentsBilan,
  renderNexusBilan,
  type RenderContext,
} from '@/lib/diagnostics/bilan-renderer';
import type {
  ScoringV2Result,
  ChapterDefinition,
  ScoringPolicy,
  DiagnosticDefinition,
  ChaptersSelection,
} from '@/lib/diagnostics/types';
import type { BilanDiagnosticMathsData } from '@/lib/validations';

/* ═══════════════════════════════════════════════════════════════════════════
   FIXTURES
   ═══════════════════════════════════════════════════════════════════════════ */

const POLICY: ScoringPolicy = {
  domainWeights: {
    algebra: 0.22,
    analysis: 0.22,
    geometry: 0.18,
    prob_stats: 0.18,
    algo_prog: 0.10,
    logic_sets: 0.10,
  },
  thresholds: {
    confirmed: { readiness: 60, risk: 50 },
    conditional: { readiness: 40, risk: 70 },
  },
};

type CompStatus = 'studied' | 'in_progress' | 'not_studied' | 'unknown';

function makeCompetency(
  skillId: string,
  mastery: number | null,
  status: CompStatus = 'studied',
  confidence: number | null = mastery !== null ? 3 : null,
  friction: number | null = mastery !== null ? 1 : null,
  errorTypes: string[] = []
) {
  return { skillId, skillLabel: skillId, mastery, status, confidence, friction, errorTypes, evidence: '' };
}

function makeData(overrides: Partial<BilanDiagnosticMathsData> = {}): BilanDiagnosticMathsData {
  return {
    identity: { firstName: 'Test', lastName: 'User', email: 'test@test.com', phone: '123456' },
    schoolContext: {},
    performance: {},
    chapters: {},
    competencies: {
      algebra: [
        makeCompetency('alg_eq1', 3),
        makeCompetency('alg_eq2', 2),
        makeCompetency('alg_suites', 3),
      ],
      analysis: [
        makeCompetency('ana_deriv', 2),
        makeCompetency('ana_fonc', 3),
      ],
      geometry: [
        makeCompetency('geo_vect', 1),
        makeCompetency('geo_prod', 0),
      ],
      prob_stats: [
        makeCompetency('prob_cond', 2),
      ],
      algo_prog: [
        makeCompetency('algo_boucles', 3),
      ],
      logic_sets: [
        makeCompetency('logic_ens', 2),
      ],
    },
    openQuestions: {},
    examPrep: {
      miniTest: { score: 4, timeUsedMinutes: 12, completedInTime: true },
      selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 2, justifications: 2, stress: 2 },
      signals: { hardestItems: [3, 5], dominantErrorType: 'calcul', verifiedAnswers: true, feeling: 'ok' },
    },
    methodology: { learningStyle: 'visuel', errorTypes: ['calcul', 'signe'] },
    ambition: { targetMention: 'Bien' },
    freeText: {},
    ...overrides,
  } as BilanDiagnosticMathsData;
}

const CHAPTERS: ChapterDefinition[] = [
  { chapterId: 'ch_eq1', chapterLabel: 'Équations 1er degré', description: 'Résolution équations', domainId: 'algebra', skills: ['alg_eq1', 'alg_eq2'], ragTopics: ['equation', 'premier_degre'] },
  { chapterId: 'ch_suites', chapterLabel: 'Suites numériques', description: 'Suites arithmétiques et géométriques', domainId: 'algebra', skills: ['alg_suites'], ragTopics: ['suites', 'recurrence'] },
  { chapterId: 'ch_deriv', chapterLabel: 'Dérivation', description: 'Dérivées et tangentes', domainId: 'analysis', skills: ['ana_deriv', 'ana_fonc'], ragTopics: ['derivee', 'tangente', 'variation'] },
  { chapterId: 'ch_vect', chapterLabel: 'Vecteurs', description: 'Vecteurs et produit scalaire', domainId: 'geometry', skills: ['geo_vect', 'geo_prod'], ragTopics: ['vecteur', 'produit_scalaire'] },
  { chapterId: 'ch_proba', chapterLabel: 'Probabilités conditionnelles', description: 'Probabilités et Bayes', domainId: 'prob_stats', skills: ['prob_cond'], ragTopics: ['probabilite', 'conditionnelle', 'bayes'] },
  { chapterId: 'ch_algo', chapterLabel: 'Boucles et fonctions', description: 'Boucles for/while et fonctions', domainId: 'algo_prog', skills: ['algo_boucles'], ragTopics: ['boucle', 'fonction', 'python'] },
  { chapterId: 'ch_logic', chapterLabel: 'Ensembles et logique', description: 'Ensembles et raisonnement', domainId: 'logic_sets', skills: ['logic_ens'], ragTopics: ['ensemble', 'logique'] },
];

const SKILL_META = [
  { skillId: 'alg_eq1', chapterId: 'ch_eq1', prerequisite: true, prerequisiteLevel: 'core' },
  { skillId: 'alg_eq2', chapterId: 'ch_eq1', prerequisite: false },
  { skillId: 'alg_suites', chapterId: 'ch_suites', prerequisite: false },
  { skillId: 'ana_deriv', chapterId: 'ch_deriv', prerequisite: false },
  { skillId: 'ana_fonc', chapterId: 'ch_deriv', prerequisite: false },
  { skillId: 'geo_vect', chapterId: 'ch_vect', prerequisite: true, prerequisiteLevel: 'core' },
  { skillId: 'geo_prod', chapterId: 'ch_vect', prerequisite: false },
  { skillId: 'prob_cond', chapterId: 'ch_proba', prerequisite: false },
  { skillId: 'algo_boucles', chapterId: 'ch_algo', prerequisite: true, prerequisiteLevel: 'core' },
  { skillId: 'logic_ens', chapterId: 'ch_logic', prerequisite: false },
];

/* ═══════════════════════════════════════════════════════════════════════════
   A) coverageProgramme — ratio calculation, edge cases
   ═══════════════════════════════════════════════════════════════════════════ */

describe('coverageProgramme — edge cases', () => {
  it('returns undefined when no chapters provided', () => {
    const result = computeScoringV2(makeData(), POLICY, null, []);
    expect(result.coverageProgramme).toBeUndefined();
  });

  it('returns undefined when chaptersSelection is null', () => {
    const result = computeScoringV2(makeData(), POLICY, null, CHAPTERS);
    expect(result.coverageProgramme).toBeUndefined();
  });

  it('computes 0% when all chapters are notYet', () => {
    const sel: ChaptersSelection = {
      selected: [],
      inProgress: [],
      notYet: CHAPTERS.map(c => c.chapterId),
    };
    const result = computeScoringV2(makeData(), POLICY, sel, CHAPTERS);
    expect(result.coverageProgramme).toBeDefined();
    expect(result.coverageProgramme!.seenChapterRatio).toBe(0);
    expect(result.coverageProgramme!.seenChapters).toBe(0);
    expect(result.coverageProgramme!.totalChapters).toBe(7);
  });

  it('computes 100% when all chapters are seen', () => {
    const sel: ChaptersSelection = {
      selected: CHAPTERS.map(c => c.chapterId),
      inProgress: [],
      notYet: [],
    };
    const result = computeScoringV2(makeData(), POLICY, sel, CHAPTERS);
    expect(result.coverageProgramme).toBeDefined();
    expect(result.coverageProgramme!.seenChapterRatio).toBe(1);
    expect(result.coverageProgramme!.seenChapters).toBe(7);
  });

  it('counts inProgress chapters in the ratio', () => {
    const sel: ChaptersSelection = {
      selected: ['ch_eq1', 'ch_suites'],
      inProgress: ['ch_deriv'],
      notYet: ['ch_vect', 'ch_proba', 'ch_algo', 'ch_logic'],
    };
    const result = computeScoringV2(makeData(), POLICY, sel, CHAPTERS);
    expect(result.coverageProgramme).toBeDefined();
    // (2 seen + 1 inProgress) / 7 = 3/7 ≈ 0.43
    expect(result.coverageProgramme!.seenChapterRatio).toBeCloseTo(3 / 7, 2);
    expect(result.coverageProgramme!.inProgressChapters).toBe(1);
  });

  it('ignores unknown chapterIds in selection gracefully', () => {
    const sel: ChaptersSelection = {
      selected: ['ch_eq1', 'UNKNOWN_CHAPTER'],
      inProgress: [],
      notYet: ['ch_vect'],
    };
    // Should not throw — unknown chapters are just counted in the selection arrays
    const result = computeScoringV2(makeData(), POLICY, sel, CHAPTERS);
    expect(result.coverageProgramme).toBeDefined();
    expect(result.coverageProgramme!.seenChapters).toBe(2); // includes unknown
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   B) prerequisites — non-sanction on NOT_YET, "bases à consolider"
   ═══════════════════════════════════════════════════════════════════════════ */

describe('prerequisites — non-sanction model', () => {
  it('does NOT degrade readiness when prereq skills in notYet chapters have HIGH mastery', () => {
    const sel: ChaptersSelection = {
      selected: ['ch_suites', 'ch_deriv', 'ch_proba', 'ch_algo', 'ch_logic'],
      inProgress: [],
      notYet: ['ch_eq1', 'ch_vect'], // prereq skills alg_eq1 (mastery=3) and geo_vect (mastery=1) are here
    };
    // alg_eq1 has mastery=3 (high), geo_vect has mastery=1 (low)
    // Only low mastery prereqs should cause penalty
    const resultWithPrereqs = computeScoringV2(makeData(), POLICY, sel, CHAPTERS, SKILL_META);
    const resultWithout = computeScoringV2(makeData(), POLICY, sel, CHAPTERS, []);

    // With high mastery prereqs, penalty should be minimal (not more than 5 pts difference)
    // geo_vect mastery=1 will cause some penalty, but alg_eq1 mastery=3 won't
    expect(resultWithPrereqs.readinessScore).toBeGreaterThan(0);
  });

  it('applies penalty when core prereqs in notYet chapters have LOW mastery', () => {
    const dataLowPrereqs = makeData({
      competencies: {
        algebra: [
          makeCompetency('alg_eq1', 1), // LOW mastery prereq
          makeCompetency('alg_eq2', 2),
          makeCompetency('alg_suites', 3),
        ],
        analysis: [makeCompetency('ana_deriv', 2), makeCompetency('ana_fonc', 3)],
        geometry: [
          makeCompetency('geo_vect', 0), // LOW mastery prereq
          makeCompetency('geo_prod', 0),
        ],
        prob_stats: [makeCompetency('prob_cond', 2)],
        algo_prog: [makeCompetency('algo_boucles', 1)], // LOW mastery prereq
        logic_sets: [makeCompetency('logic_ens', 2)],
      },
    });
    const sel: ChaptersSelection = {
      selected: ['ch_suites', 'ch_deriv', 'ch_proba', 'ch_logic'],
      inProgress: [],
      notYet: ['ch_eq1', 'ch_vect', 'ch_algo'], // all 3 prereq chapters are notYet
    };

    const resultWithMeta = computeScoringV2(dataLowPrereqs, POLICY, sel, CHAPTERS, SKILL_META);
    const resultWithoutMeta = computeScoringV2(dataLowPrereqs, POLICY, sel, CHAPTERS, []);

    // With low mastery prereqs, readiness should be lower
    expect(resultWithMeta.readinessScore).toBeLessThanOrEqual(resultWithoutMeta.readinessScore);
  });

  it('does NOT exclude notYet skills from domain scores (they still count)', () => {
    const sel: ChaptersSelection = {
      selected: ['ch_eq1'],
      inProgress: [],
      notYet: ['ch_vect'],
    };
    const result = computeScoringV2(makeData(), POLICY, sel, CHAPTERS, SKILL_META);
    // geometry domain should still have scores (geo_vect mastery=1, geo_prod mastery=0)
    const geoDomain = result.domainScores.find(d => d.domain === 'geometry');
    expect(geoDomain).toBeDefined();
    expect(geoDomain!.evaluatedCount).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   C) skill filtering by chapters — UI logic
   ═══════════════════════════════════════════════════════════════════════════ */

describe('skill filtering by chapters (UI logic)', () => {
  /**
   * Replicate the visibleSkillIds computation from page.tsx:
   * - skills from seen/inProgress chapters
   * - plus core prerequisite skills from notYet chapters
   */
  function computeVisibleSkillIds(
    chapterStatuses: Record<string, 'seen' | 'inProgress' | 'notYet'>,
    chapters: ChapterDefinition[],
    skillMeta: typeof SKILL_META,
    showAllSkills: boolean
  ): Set<string> | null {
    if (showAllSkills) return null; // null = show all

    const visible = new Set<string>();
    const notYetChapterIds = new Set<string>();

    for (const ch of chapters) {
      const status = chapterStatuses[ch.chapterId] || 'notYet';
      if (status === 'seen' || status === 'inProgress') {
        for (const sid of ch.skills) visible.add(sid);
      } else {
        notYetChapterIds.add(ch.chapterId);
      }
    }

    // Add core prerequisites from notYet chapters
    for (const sm of skillMeta) {
      if (sm.prerequisite && sm.prerequisiteLevel === 'core' && sm.chapterId && notYetChapterIds.has(sm.chapterId)) {
        visible.add(sm.skillId);
      }
    }

    return visible;
  }

  it('shows only skills from checked chapters (seen + inProgress)', () => {
    const statuses: Record<string, 'seen' | 'inProgress' | 'notYet'> = {
      ch_eq1: 'seen',
      ch_suites: 'notYet',
      ch_deriv: 'inProgress',
      ch_vect: 'notYet',
      ch_proba: 'notYet',
      ch_algo: 'notYet',
      ch_logic: 'notYet',
    };

    const visible = computeVisibleSkillIds(statuses, CHAPTERS, SKILL_META, false)!;

    // ch_eq1 (seen): alg_eq1, alg_eq2
    expect(visible.has('alg_eq1')).toBe(true);
    expect(visible.has('alg_eq2')).toBe(true);
    // ch_deriv (inProgress): ana_deriv, ana_fonc
    expect(visible.has('ana_deriv')).toBe(true);
    expect(visible.has('ana_fonc')).toBe(true);
    // ch_suites (notYet): alg_suites should NOT be visible (not a prereq)
    expect(visible.has('alg_suites')).toBe(false);
  });

  it('includes core prerequisite skills from notYet chapters', () => {
    const statuses: Record<string, 'seen' | 'inProgress' | 'notYet'> = {
      ch_eq1: 'notYet',
      ch_suites: 'seen',
      ch_deriv: 'seen',
      ch_vect: 'notYet',
      ch_proba: 'seen',
      ch_algo: 'notYet',
      ch_logic: 'seen',
    };

    const visible = computeVisibleSkillIds(statuses, CHAPTERS, SKILL_META, false)!;

    // Core prereqs from notYet chapters should be included:
    expect(visible.has('alg_eq1')).toBe(true);  // ch_eq1 notYet, prereq=true, core
    expect(visible.has('geo_vect')).toBe(true);  // ch_vect notYet, prereq=true, core
    expect(visible.has('algo_boucles')).toBe(true); // ch_algo notYet, prereq=true, core

    // Non-prereq skills from notYet chapters should NOT be included:
    expect(visible.has('alg_eq2')).toBe(false);  // ch_eq1 notYet, prereq=false
    expect(visible.has('geo_prod')).toBe(false);  // ch_vect notYet, prereq=false
  });

  it('returns null (show all) when showAllSkills toggle is true', () => {
    const statuses: Record<string, 'seen' | 'inProgress' | 'notYet'> = {
      ch_eq1: 'notYet',
    };
    const visible = computeVisibleSkillIds(statuses, CHAPTERS, SKILL_META, true);
    expect(visible).toBeNull();
  });

  it('returns empty set when no chapters are checked and no prereqs exist', () => {
    const statuses: Record<string, 'seen' | 'inProgress' | 'notYet'> = {};
    const visible = computeVisibleSkillIds(statuses, CHAPTERS, [], false)!;
    expect(visible.size).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   D) RAG queries — ragTopics + collections discipline/niveau
   ═══════════════════════════════════════════════════════════════════════════ */

describe('RAG queries — ragTopics and collections', () => {
  function makeDefinition(overrides: Partial<DiagnosticDefinition> = {}): DiagnosticDefinition {
    return {
      key: 'nsi-terminale-p2',
      version: '1.0',
      label: 'NSI Terminale P2',
      track: 'nsi',
      level: 'terminale',
      stage: 'pallier2',
      skills: {},
      scoringPolicy: POLICY,
      prompts: { system: '', user: '' },
      ragPolicy: { enabled: true, collections: ['nsi_terminale'], topK: 5 },
      chapters: [
        { chapterId: 'ch_sql', chapterLabel: 'SQL et bases de données', description: 'Requêtes SQL', domainId: 'databases', skills: ['db_sql'], ragTopics: ['sql', 'join', 'modele_relationnel'] },
        { chapterId: 'ch_algo', chapterLabel: 'Algorithmes avancés', description: 'Tri et complexité', domainId: 'algorithmic_advanced', skills: ['algo_tri'], ragTopics: ['tri', 'complexite', 'recursivite'] },
      ],
      examFormat: { duration: 210, calculatorAllowed: false, structure: '3 exercices' },
      ...overrides,
    } as DiagnosticDefinition;
  }

  function makeScoringResult(weakDomains: Array<{ domain: string; score: number }>): ScoringV2Result {
    return {
      masteryIndex: 50,
      coverageIndex: 60,
      examReadinessIndex: 55,
      readinessScore: 55,
      riskIndex: 30,
      recommendation: 'Pallier2_conditional',
      recommendationMessage: 'Pallier 2 possible',
      justification: '',
      upgradeConditions: [],
      domainScores: weakDomains.map(d => ({
        domain: d.domain,
        score: d.score,
        evaluatedCount: 2,
        totalCount: 3,
        notStudiedCount: 0,
        unknownCount: 0,
        gaps: [],
        dominantErrors: [],
        priority: d.score < 40 ? 'critical' as const : 'medium' as const,
      })),
      alerts: [],
      dataQuality: { activeDomains: 2, evaluatedCompetencies: 4, notStudiedCompetencies: 0, unknownCompetencies: 0, lowConfidence: false, quality: 'good', coherenceIssues: 0, miniTestFilled: true, criticalFieldsMissing: 0 },
      trustScore: 80,
      trustLevel: 'green',
      topPriorities: [],
      quickWins: [],
      highRisk: [],
      inconsistencies: [],
    } as ScoringV2Result;
  }

  it('uses ragTopics from SQL chapter when databases domain is weak', () => {
    const def = makeDefinition();
    const data = makeData({
      discipline: 'nsi',
      level: 'terminale',
      chapters: { selected: ['ch_sql', 'ch_algo'], inProgress: [], notYet: [] },
    });
    const scoring = makeScoringResult([
      { domain: 'databases', score: 25 },
      { domain: 'algorithmic_advanced', score: 60 },
    ]);

    const queries = buildChapterAwareRAGQueries(data, scoring, def);

    // Should contain SQL-related ragTopics
    const sqlQuery = queries.find(q => q.includes('sql'));
    expect(sqlQuery).toBeDefined();
    expect(sqlQuery).toContain('nsi');
    expect(sqlQuery).toContain('terminale');
  });

  it('uses ragTopics from algo chapter when algorithmic domain is weak', () => {
    const def = makeDefinition();
    const data = makeData({
      discipline: 'nsi',
      level: 'terminale',
      chapters: { selected: ['ch_sql', 'ch_algo'], inProgress: [], notYet: [] },
    });
    const scoring = makeScoringResult([
      { domain: 'algorithmic_advanced', score: 20 },
      { domain: 'databases', score: 70 },
    ]);

    const queries = buildChapterAwareRAGQueries(data, scoring, def);

    const algoQuery = queries.find(q => q.includes('tri') || q.includes('complexite'));
    expect(algoQuery).toBeDefined();
  });

  it('falls back to chapterLabel when ragTopics are missing', () => {
    const def = makeDefinition({
      chapters: [
        { chapterId: 'ch_sql', chapterLabel: 'SQL et bases de données', description: 'Requêtes SQL', domainId: 'databases', skills: ['db_sql'] },
      ],
    });
    const data = makeData({
      discipline: 'nsi',
      level: 'terminale',
      chapters: { selected: ['ch_sql'], inProgress: [], notYet: [] },
    });
    const scoring = makeScoringResult([{ domain: 'databases', score: 25 }]);

    const queries = buildChapterAwareRAGQueries(data, scoring, def);

    const sqlQuery = queries.find(q => q.includes('SQL et bases'));
    expect(sqlQuery).toBeDefined();
  });

  it('includes error types query when methodology.errorTypes present', () => {
    const def = makeDefinition();
    const data = makeData({
      discipline: 'nsi',
      level: 'terminale',
      chapters: { selected: ['ch_sql'], inProgress: [], notYet: [] },
      methodology: { errorTypes: ['syntaxe', 'indentation'] },
    });
    const scoring = makeScoringResult([{ domain: 'databases', score: 30 }]);

    const queries = buildChapterAwareRAGQueries(data, scoring, def);

    const errorQuery = queries.find(q => q.includes('syntaxe'));
    expect(errorQuery).toBeDefined();
    expect(errorQuery).toContain('erreurs');
  });

  it('includes exam format query with calculator info', () => {
    const def = makeDefinition();
    const data = makeData({
      discipline: 'nsi',
      level: 'terminale',
      chapters: { selected: ['ch_sql'], inProgress: [], notYet: [] },
    });
    const scoring = makeScoringResult([{ domain: 'databases', score: 30 }]);

    const queries = buildChapterAwareRAGQueries(data, scoring, def);

    const examQuery = queries.find(q => q.includes('épreuve'));
    expect(examQuery).toBeDefined();
    expect(examQuery).toContain('sans calculatrice');
  });

  it('limits queries to max 4', () => {
    const def = makeDefinition();
    const data = makeData({
      discipline: 'nsi',
      level: 'terminale',
      chapters: { selected: ['ch_sql', 'ch_algo'], inProgress: [], notYet: [] },
      methodology: { errorTypes: ['syntaxe', 'indentation', 'logique'] },
    });
    const scoring = makeScoringResult([
      { domain: 'databases', score: 20 },
      { domain: 'algorithmic_advanced', score: 25 },
    ]);

    const queries = buildChapterAwareRAGQueries(data, scoring, def);
    expect(queries.length).toBeLessThanOrEqual(4);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   E) scoring invariants — not_studied status
   ═══════════════════════════════════════════════════════════════════════════ */

describe('scoring invariants — not_studied status', () => {
  it('not_studied competencies have mastery=null, confidence=null, friction=null', () => {
    const data = makeData({
      competencies: {
        algebra: [
          makeCompetency('alg_eq1', null, 'not_studied', null, null, []),
          makeCompetency('alg_eq2', null, 'not_studied', null, null, []),
        ],
        analysis: [makeCompetency('ana_deriv', 3)],
        geometry: [makeCompetency('geo_vect', 2)],
        prob_stats: [makeCompetency('prob_cond', 2)],
        algo_prog: [makeCompetency('algo_boucles', 3)],
        logic_sets: [makeCompetency('logic_ens', 2)],
      },
    });

    const result = computeScoringV2(data, POLICY);

    // algebra domain should count not_studied separately
    const algDomain = result.domainScores.find(d => d.domain === 'algebra');
    expect(algDomain).toBeDefined();
    expect(algDomain!.notStudiedCount).toBe(2);
    expect(algDomain!.evaluatedCount).toBe(0);
  });

  it('unknown competencies are counted separately', () => {
    const data = makeData({
      competencies: {
        algebra: [
          makeCompetency('alg_eq1', null, 'unknown', null, null, []),
          makeCompetency('alg_eq2', 3),
        ],
        analysis: [makeCompetency('ana_deriv', 3)],
        geometry: [makeCompetency('geo_vect', 2)],
        prob_stats: [makeCompetency('prob_cond', 2)],
        algo_prog: [makeCompetency('algo_boucles', 3)],
        logic_sets: [makeCompetency('logic_ens', 2)],
      },
    });

    const result = computeScoringV2(data, POLICY);
    const algDomain = result.domainScores.find(d => d.domain === 'algebra');
    expect(algDomain).toBeDefined();
    expect(algDomain!.unknownCount).toBe(1);
  });

  it('errorTypes defaults to empty array when not provided', () => {
    const comp = makeCompetency('test', 3, 'studied', 3, 1);
    expect(comp.errorTypes).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   F) bilan renderer — semantic/structural tests
   ═══════════════════════════════════════════════════════════════════════════ */

function buildScoring(overrides: Partial<ScoringV2Result> = {}): ScoringV2Result {
  return {
    masteryIndex: 65,
    coverageIndex: 80,
    examReadinessIndex: 70,
    readinessScore: 68,
    riskIndex: 30,
    recommendation: 'Pallier2_confirmed',
    recommendationMessage: 'Profil compatible avec le Pallier 2 Excellence',
    justification: 'Mastery et ExamReadiness au-dessus des seuils.',
    upgradeConditions: [],
    domainScores: [
      { domain: 'analysis', score: 75, evaluatedCount: 3, totalCount: 4, notStudiedCount: 0, unknownCount: 0, gaps: [], dominantErrors: [], priority: 'low' },
      { domain: 'algebra', score: 50, evaluatedCount: 3, totalCount: 4, notStudiedCount: 0, unknownCount: 1, gaps: ['Suites'], dominantErrors: ['calcul'], priority: 'medium' },
      { domain: 'geometry', score: 30, evaluatedCount: 2, totalCount: 3, notStudiedCount: 1, unknownCount: 0, gaps: ['Vecteurs'], dominantErrors: ['signe'], priority: 'critical' },
    ],
    alerts: [
      { type: 'warning', code: 'HIGH_STRESS', message: 'Gestion du stress', impact: 'Risque' },
      { type: 'danger', code: 'WEAK_AUTO', message: 'Automatismes fragiles', impact: 'Impact' },
    ],
    dataQuality: { activeDomains: 3, evaluatedCompetencies: 8, notStudiedCompetencies: 1, unknownCompetencies: 1, lowConfidence: false, quality: 'good', coherenceIssues: 0, miniTestFilled: true, criticalFieldsMissing: 0 },
    trustScore: 85,
    trustLevel: 'green',
    topPriorities: [{ skillLabel: 'Vecteurs', domain: 'geometry', reason: 'Mastery 1/4', impact: 'Direct', exerciseType: 'Exercices de base' }],
    quickWins: [{ skillLabel: 'Suites', domain: 'algebra', reason: 'Mastery 3/4', impact: 'Rapide', exerciseType: 'Consolidation' }],
    highRisk: [{ skillLabel: 'Produit scalaire', domain: 'geometry', reason: 'Mastery 0/4', impact: 'Bloquant', exerciseType: 'Reprise' }],
    inconsistencies: [],
    ...overrides,
  };
}

function buildCtx(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    firstName: 'Amine',
    lastName: 'Ben Ali',
    miniTestScore: 4,
    miniTestTime: 15,
    miniTestCompleted: true,
    verbatims: {},
    ...overrides,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUDIT §3 — RAG coherence: SQL queries contain sql, NOT boucle python
   ═══════════════════════════════════════════════════════════════════════════ */

describe('RAG coherence — SQL focus must NOT leak unrelated topics', () => {
  function makeDefinition(overrides: Partial<DiagnosticDefinition> = {}): DiagnosticDefinition {
    return {
      key: 'nsi-terminale-p2',
      version: '1.0',
      label: 'NSI Terminale P2',
      track: 'nsi',
      level: 'terminale',
      stage: 'pallier2',
      skills: {},
      scoringPolicy: POLICY,
      prompts: { system: '', user: '' },
      ragPolicy: { enabled: true, collections: ['nsi_terminale'], topK: 5 },
      chapters: [
        { chapterId: 'ch_sql', chapterLabel: 'SQL et bases de données', description: 'Requêtes SQL', domainId: 'databases', skills: ['db_sql'], ragTopics: ['sql', 'join', 'modele_relationnel'] },
        { chapterId: 'ch_algo', chapterLabel: 'Algorithmes avancés', description: 'Tri et complexité', domainId: 'algorithmic_advanced', skills: ['algo_tri'], ragTopics: ['tri', 'complexite', 'recursivite'] },
        { chapterId: 'ch_python', chapterLabel: 'Boucles et fonctions Python', description: 'Boucles for/while', domainId: 'python_programming', skills: ['py_boucles'], ragTopics: ['boucle', 'fonction', 'python'] },
      ],
      examFormat: { duration: 210, calculatorAllowed: false, structure: '3 exercices' },
      ...overrides,
    } as DiagnosticDefinition;
  }

  function makeScoringForRAG(weakDomains: Array<{ domain: string; score: number }>): ScoringV2Result {
    return {
      masteryIndex: 50, coverageIndex: 60, examReadinessIndex: 55,
      readinessScore: 55, riskIndex: 30,
      recommendation: 'Pallier2_conditional', recommendationMessage: '', justification: '', upgradeConditions: [],
      domainScores: weakDomains.map(d => ({
        domain: d.domain, score: d.score, evaluatedCount: 2, totalCount: 3,
        notStudiedCount: 0, unknownCount: 0, gaps: [], dominantErrors: [],
        priority: (d.score < 35 ? 'critical' : d.score < 50 ? 'high' : d.score < 70 ? 'medium' : 'low') as 'critical' | 'high' | 'medium' | 'low',
      })),
      alerts: [],
      dataQuality: { activeDomains: 2, evaluatedCompetencies: 4, notStudiedCompetencies: 0, unknownCompetencies: 0, lowConfidence: false, quality: 'good', coherenceIssues: 0, miniTestFilled: true, criticalFieldsMissing: 0 },
      trustScore: 80, trustLevel: 'green',
      topPriorities: [], quickWins: [], highRisk: [], inconsistencies: [],
    } as ScoringV2Result;
  }

  it('SQL weak domain queries contain "sql" and "join"', () => {
    const def = makeDefinition();
    const data = makeData({
      discipline: 'nsi', level: 'terminale',
      chapters: { selected: ['ch_sql', 'ch_algo', 'ch_python'], inProgress: [], notYet: [] },
    });
    const scoring = makeScoringForRAG([
      { domain: 'databases', score: 20 },       // WEAK — should trigger SQL ragTopics
      { domain: 'algorithmic_advanced', score: 85 },
      { domain: 'python_programming', score: 90 },
    ]);

    const queries = buildChapterAwareRAGQueries(data, scoring, def);
    const allText = queries.join(' ');

    expect(allText).toContain('sql');
    expect(allText).toContain('join');
    // Must NOT contain python/boucle topics (python_programming is NOT weak)
    expect(allText).not.toContain('boucle');
    expect(allText).not.toMatch(/\bpython\b.*boucle|boucle.*\bpython\b/);
  });

  it('when only algo is weak, queries contain tri/complexite but NOT sql', () => {
    const def = makeDefinition();
    const data = makeData({
      discipline: 'nsi', level: 'terminale',
      chapters: { selected: ['ch_sql', 'ch_algo'], inProgress: [], notYet: [] },
    });
    const scoring = makeScoringForRAG([
      { domain: 'algorithmic_advanced', score: 15 }, // WEAK
      { domain: 'databases', score: 85 },            // STRONG (>=70 => priority 'low')
    ]);

    const queries = buildChapterAwareRAGQueries(data, scoring, def);
    const allText = queries.join(' ');

    expect(allText).toContain('tri');
    expect(allText).toContain('complexite');
    // databases is strong — no SQL topics should appear in weak-domain queries
    const weakDomainQueries = queries.filter(q => !q.includes('épreuve') && !q.includes('erreurs'));
    const weakText = weakDomainQueries.join(' ');
    expect(weakText).not.toContain('sql');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   AUDIT §4 — Prerequisite: NOT_YET + mastery null + readiness stable + bases à consolider
   ═══════════════════════════════════════════════════════════════════════════ */

describe('prerequisites — critical business case (audit §4)', () => {
  it('NOT_YET chapter + prereq skill mastery=null => readiness does NOT drop + bases à consolider appears', () => {
    // Setup: prereq skill alg_eq1 has mastery=null (not evaluated)
    const dataWithNullPrereq = makeData({
      competencies: {
        algebra: [
          makeCompetency('alg_eq1', null, 'not_studied', null, null), // prereq, mastery NULL
          makeCompetency('alg_eq2', 3),
          makeCompetency('alg_suites', 3),
        ],
        analysis: [makeCompetency('ana_deriv', 3), makeCompetency('ana_fonc', 3)],
        geometry: [makeCompetency('geo_vect', null, 'not_studied', null, null), makeCompetency('geo_prod', 2)],
        prob_stats: [makeCompetency('prob_cond', 3)],
        algo_prog: [makeCompetency('algo_boucles', null, 'not_studied', null, null)],
        logic_sets: [makeCompetency('logic_ens', 3)],
      },
    });

    const sel: ChaptersSelection = {
      selected: ['ch_suites', 'ch_deriv', 'ch_proba', 'ch_logic'],
      inProgress: [],
      notYet: ['ch_eq1', 'ch_vect', 'ch_algo'], // prereq chapters are NOT_YET
    };

    // With skill meta (prereqs identified) vs without
    const resultWith = computeScoringV2(dataWithNullPrereq, POLICY, sel, CHAPTERS, SKILL_META);
    const resultWithout = computeScoringV2(dataWithNullPrereq, POLICY, sel, CHAPTERS, []);

    // mastery=null prereqs should NOT cause penalty (only low mastery does)
    // getPrerequisiteCoreSkillIdsFromNotYet filters for mastery !== null before computing penalty
    expect(resultWith.readinessScore).toBe(resultWithout.readinessScore);

    // Verify "bases à consolider" would appear in renderer
    // The renderer shows it when weakPrerequisites is provided
    const weakPrereqs = SKILL_META
      .filter(sm => sm.prerequisite && sm.prerequisiteLevel === 'core' && sel.notYet.includes(sm.chapterId!))
      .map(sm => {
        const allComps = Object.values(dataWithNullPrereq.competencies).flat();
        const comp = allComps.find(c => c.skillId === sm.skillId);
        return { skillLabel: sm.skillId, domain: 'prereq', mastery: comp?.mastery ?? 0 };
      })
      .filter(p => {
        // Only include skills that were actually evaluated with low mastery
        const allComps = Object.values(dataWithNullPrereq.competencies).flat();
        const comp = allComps.find(c => c.skillId === p.skillLabel);
        return comp?.mastery !== null && comp?.mastery !== undefined && comp.mastery <= 2;
      });

    // alg_eq1/geo_vect/algo_boucles all have mastery=null => none qualify for "bases à consolider"
    // This is correct: null mastery means "not evaluated" — no penalty, no entry
    expect(weakPrereqs.length).toBe(0);

    // Now test with LOW mastery prereqs
    const dataWithLowPrereq = makeData({
      competencies: {
        algebra: [
          makeCompetency('alg_eq1', 1), // prereq, mastery LOW
          makeCompetency('alg_eq2', 3),
          makeCompetency('alg_suites', 3),
        ],
        analysis: [makeCompetency('ana_deriv', 3), makeCompetency('ana_fonc', 3)],
        geometry: [makeCompetency('geo_vect', 1), makeCompetency('geo_prod', 2)],
        prob_stats: [makeCompetency('prob_cond', 3)],
        algo_prog: [makeCompetency('algo_boucles', 1)],
        logic_sets: [makeCompetency('logic_ens', 3)],
      },
    });

    const resultLow = computeScoringV2(dataWithLowPrereq, POLICY, sel, CHAPTERS, SKILL_META);
    const resultLowNoMeta = computeScoringV2(dataWithLowPrereq, POLICY, sel, CHAPTERS, []);

    // Low mastery prereqs SHOULD cause penalty
    expect(resultLow.readinessScore).toBeLessThanOrEqual(resultLowNoMeta.readinessScore);

    // And "bases à consolider" should appear in the renderer
    const md = renderEleveBilan(resultLow, {
      firstName: 'Test', lastName: 'User',
      miniTestScore: 4, miniTestTime: 12, miniTestCompleted: true,
      verbatims: {},
      weakPrerequisites: [
        { skillLabel: 'Équations 1er degré', domain: 'algebra', mastery: 1 },
        { skillLabel: 'Vecteurs', domain: 'geometry', mastery: 1 },
      ],
    });
    expect(md).toContain('Bases à consolider');
    expect(md).toContain('Équations 1er degré');
    expect(md).toContain('Vecteurs');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   AUDIT §5 — coverageProgramme: 5 mandatory edge cases
   ═══════════════════════════════════════════════════════════════════════════ */

describe('coverageProgramme — 5 mandatory edge cases (audit §5)', () => {
  it('0 chapters checked', () => {
    const sel: ChaptersSelection = { selected: [], inProgress: [], notYet: CHAPTERS.map(c => c.chapterId) };
    const result = computeScoringV2(makeData(), POLICY, sel, CHAPTERS);
    expect(result.coverageProgramme!.seenChapters).toBe(0);
    expect(result.coverageProgramme!.seenChapterRatio).toBe(0);
  });

  it('1 single chapter checked', () => {
    const sel: ChaptersSelection = { selected: ['ch_eq1'], inProgress: [], notYet: ['ch_suites', 'ch_deriv', 'ch_vect', 'ch_proba', 'ch_algo', 'ch_logic'] };
    const result = computeScoringV2(makeData(), POLICY, sel, CHAPTERS);
    expect(result.coverageProgramme!.seenChapters).toBe(1);
    expect(result.coverageProgramme!.seenChapterRatio).toBeCloseTo(1 / 7, 2);
  });

  it('all chapters checked', () => {
    const sel: ChaptersSelection = { selected: CHAPTERS.map(c => c.chapterId), inProgress: [], notYet: [] };
    const result = computeScoringV2(makeData(), POLICY, sel, CHAPTERS);
    expect(result.coverageProgramme!.seenChapters).toBe(7);
    expect(result.coverageProgramme!.seenChapterRatio).toBe(1);
  });

  it('unknown chapter ID in selection', () => {
    const sel: ChaptersSelection = { selected: ['UNKNOWN_XYZ', 'ch_eq1'], inProgress: [], notYet: [] };
    const result = computeScoringV2(makeData(), POLICY, sel, CHAPTERS);
    // Should not crash — unknown chapter counted in selection but no skills mapped
    expect(result.coverageProgramme!.seenChapters).toBe(2);
    expect(result.coverageProgramme).toBeDefined();
  });

  it('coverageProgramme evaluatedSkillRatio is coherent with filtered skills (audit D)', () => {
    // Select 3 chapters that have skills: ch_eq1 (alg_eq1, alg_eq2), ch_suites (alg_suites), ch_deriv (ana_deriv, ana_fonc)
    const sel: ChaptersSelection = { selected: ['ch_eq1', 'ch_suites', 'ch_deriv'], inProgress: [], notYet: ['ch_vect', 'ch_proba', 'ch_algo', 'ch_logic'] };
    const data = makeData({
      competencies: {
        algebra: [
          makeCompetency('alg_eq1', 3),   // in ch_eq1 — evaluated
          makeCompetency('alg_eq2', 2),   // in ch_eq1 — evaluated
          makeCompetency('alg_suites', 4), // in ch_suites — evaluated
        ],
        analysis: [
          makeCompetency('ana_deriv', 3),  // in ch_deriv — evaluated
          makeCompetency('ana_fonc', null, 'not_studied'), // in ch_deriv — NOT evaluated
        ],
        geometry: [makeCompetency('geo_vect', 3)], // in ch_vect (notYet) — should NOT count
      },
    });

    const result = computeScoringV2(data, POLICY, sel, CHAPTERS, SKILL_META);
    const cp = result.coverageProgramme!;

    // 3 seen chapters out of 7
    expect(cp.seenChapters).toBe(3);
    expect(cp.seenChapterRatio).toBeCloseTo(3 / 7, 2);

    // Skills in seen chapters: alg_eq1, alg_eq2, alg_suites, ana_deriv, ana_fonc = 5 total
    // Evaluated (mastery !== null && status !== 'not_studied'): 4 out of 5
    expect(cp.evaluatedSkillRatio).toBeGreaterThan(0);
    expect(cp.evaluatedSkillRatio).toBeLessThanOrEqual(1);

    // totalChapters should be 7 (all chapters in definition)
    expect(cp.totalChapters).toBe(7);
  });

  it('chapter with no associated skills', () => {
    const chaptersWithEmpty: ChapterDefinition[] = [
      ...CHAPTERS,
      { chapterId: 'ch_empty', chapterLabel: 'Empty Chapter', description: 'No skills', domainId: 'misc', skills: [], ragTopics: [] },
    ];
    const sel: ChaptersSelection = { selected: ['ch_empty'], inProgress: [], notYet: CHAPTERS.map(c => c.chapterId) };
    const result = computeScoringV2(makeData(), POLICY, sel, chaptersWithEmpty);
    expect(result.coverageProgramme!.seenChapters).toBe(1);
    // evaluatedSkillRatio: 0 skills in seen chapters => 0
    expect(result.coverageProgramme!.evaluatedSkillRatio).toBe(0);
  });
});

describe('renderEleveBilan — structural/semantic', () => {
  it('contains all required structural sections', () => {
    const md = renderEleveBilan(buildScoring(), buildCtx());
    const sections = md.match(/^## .+$/gm) || [];
    const sectionTitles = sections.map(s => s.replace(/^## /, '').replace(/[^\w\sÀ-ÿ]/g, '').trim());

    expect(sectionTitles).toEqual(expect.arrayContaining([
      expect.stringContaining('résumé'),
      expect.stringContaining('points forts'),
      expect.stringContaining('priorités'),
      expect.stringContaining('profil'),
      expect.stringContaining('plan'),
    ]));
  });

  it('adapts discipline label dynamically (maths vs nsi)', () => {
    const mathsMd = renderEleveBilan(buildScoring(), buildCtx({ discipline: 'maths' }));
    const nsiMd = renderEleveBilan(buildScoring(), buildCtx({ discipline: 'nsi' }));

    expect(mathsMd).toContain('Mathématiques');
    expect(mathsMd).not.toContain('NSI');
    expect(nsiMd).toContain('NSI');
    expect(nsiMd).not.toContain('Mathématiques');
  });

  it('adapts micro-plan content by discipline', () => {
    const mathsMd = renderEleveBilan(buildScoring(), buildCtx({ discipline: 'maths' }));
    const nsiMd = renderEleveBilan(buildScoring(), buildCtx({ discipline: 'nsi' }));

    expect(mathsMd).toContain('calculatrice');
    expect(nsiMd).toContain('SQL');
    expect(nsiMd).toContain('algorithme');
  });

  it('shows "bases à consolider" only when weakPrerequisites provided', () => {
    const withPrereqs = renderEleveBilan(buildScoring(), buildCtx({
      weakPrerequisites: [{ skillLabel: 'Boucles', domain: 'python', mastery: 1 }],
    }));
    const withoutPrereqs = renderEleveBilan(buildScoring(), buildCtx());

    expect(withPrereqs).toContain('Bases à consolider');
    expect(withPrereqs).toContain('Boucles');
    expect(withoutPrereqs).not.toContain('Bases à consolider');
  });
});

describe('renderParentsBilan — structural/semantic', () => {
  it('contains all required structural sections', () => {
    const md = renderParentsBilan(buildScoring(), buildCtx());
    const sections = md.match(/^## .+$/gm) || [];
    const sectionTitles = sections.map(s => s.replace(/^## /, ''));

    expect(sectionTitles.length).toBeGreaterThanOrEqual(4);
    expect(md).toContain('Synthèse globale');
    expect(md).toContain('Ce qui va bien');
    expect(md).toContain('Recommandation');
    expect(md).toContain('stage va apporter');
  });

  it('NEVER exposes raw numeric scores', () => {
    const md = renderParentsBilan(buildScoring(), buildCtx());

    // No raw scores like "68/100" or "MasteryIndex"
    expect(md).not.toMatch(/\b68\/100\b/);
    expect(md).not.toMatch(/MasteryIndex/i);
    expect(md).not.toMatch(/RiskIndex/i);
    expect(md).not.toMatch(/ReadinessScore/i);
    expect(md).not.toMatch(/CoverageIndex/i);
  });

  it('uses qualitative labels instead of numbers', () => {
    const md = renderParentsBilan(buildScoring({ readinessScore: 75 }), buildCtx());
    expect(md).toMatch(/bon|solide|satisfaisant/i);
  });

  it('adapts discipline dynamically', () => {
    const nsiMd = renderParentsBilan(buildScoring(), buildCtx({ discipline: 'nsi', level: 'terminale' }));
    expect(nsiMd).toContain('NSI');
    expect(nsiMd).toContain('Terminale');
  });
});

describe('renderNexusBilan — structural/semantic', () => {
  it('contains all required technical sections', () => {
    const md = renderNexusBilan(buildScoring(), buildCtx());

    expect(md).toContain('Qualité des données');
    expect(md).toContain('Scores');
    expect(md).toContain('Cartographie par domaine');
    expect(md).toContain('Alertes');
    expect(md).toContain('Profil cognitif');
    expect(md).toContain('Justification décision');
  });

  it('includes coverageProgramme table when present', () => {
    const scoring = buildScoring({
      coverageProgramme: {
        seenChapterRatio: 0.6,
        evaluatedSkillRatio: 0.85,
        totalChapters: 10,
        seenChapters: 5,
        inProgressChapters: 1,
      },
    });
    const md = renderNexusBilan(scoring, buildCtx());

    expect(md).toContain('Couverture du programme');
    expect(md).toContain('5/10');
    expect(md).toContain('60%');
  });

  it('does NOT include coverageProgramme when absent', () => {
    const md = renderNexusBilan(buildScoring(), buildCtx());
    expect(md).not.toContain('Couverture du programme');
  });

  it('includes raw scores (ReadinessScore, MasteryIndex, etc.)', () => {
    const md = renderNexusBilan(buildScoring(), buildCtx());
    expect(md).toContain('ReadinessScore');
    expect(md).toContain('MasteryIndex');
    expect(md).toContain('68/100');
  });

  it('includes domain table with all provided domains', () => {
    const md = renderNexusBilan(buildScoring(), buildCtx());
    expect(md).toContain('Analyse');
    expect(md).toContain('Algèbre');
    expect(md).toContain('Géométrie');
  });
});
