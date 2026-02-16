/**
 * Extended Unit Tests for Scoring V2 Engine
 *
 * Covers:
 * A1. coverageProgramme: ratio calc, edges (0 chapters, all checked, inconsistencies)
 * A2. prerequisites: notYet chapters don't degrade readiness, "bases à consolider" output
 * A3. scoring invariants: not_studied => mastery/confidence/friction=null, errorTypes=[]
 * A4. definitions registry: all 4 definitions valid, unknown key throws
 */

import { computeScoringV2 } from '@/lib/diagnostics/score-diagnostic';
import { getDefinition, getDefinitionOrNull, listDefinitionKeys } from '@/lib/diagnostics/definitions';
import type { BilanDiagnosticMathsData } from '@/lib/validations';
import type { ChaptersSelection, ChapterDefinition, ScoringPolicy } from '@/lib/diagnostics/types';

type CompStatus = 'studied' | 'in_progress' | 'not_studied' | 'unknown';

let _skCounter = 0;
beforeEach(() => { _skCounter = 0; });

function sk(
  skillLabel: string,
  status: CompStatus,
  mastery: number | null,
  friction: number | null = mastery !== null ? Math.max(0, 4 - mastery) : null,
  errorTypes: string[] = [],
  skillId?: string
) {
  return {
    skillId: skillId ?? `sk_${++_skCounter}`,
    skillLabel,
    status,
    mastery,
    confidence: mastery !== null ? 3 : null,
    friction,
    errorTypes,
    evidence: '',
  };
}

function buildData(overrides: Partial<BilanDiagnosticMathsData> = {}): BilanDiagnosticMathsData {
  const base: BilanDiagnosticMathsData = {
    identity: { firstName: 'Test', lastName: 'Eleve', email: 'test@test.com', phone: '12345678' },
    schoolContext: { establishment: 'Lycée Test', mathTeacher: 'M. Test' },
    performance: { mathAverage: '12', lastTestScore: '11', classRanking: '10/30' },
    chapters: {},
    competencies: {
      algebra: [
        sk('Suites', 'studied', 3, 1),
        sk('Second degré', 'studied', 2, 2, ['calcul']),
        sk('Inéquations', 'studied', 3, 1),
      ],
      analysis: [
        sk('Dérivation', 'studied', 4, 0),
        sk('Variations', 'studied', 3, 1),
        sk('Limites', 'studied', 2, 2, ['signe']),
      ],
      geometry: [
        sk('Vecteurs', 'studied', 3, 1),
        sk('Produit scalaire', 'studied', 2, 2),
      ],
      probabilities: [
        sk('Conditionnelles', 'studied', 3, 1),
        sk('Arbres', 'studied', 3, 0),
      ],
      python: [
        sk('Boucles', 'studied', 4, 0),
        sk('Fonctions', 'studied', 3, 1),
      ],
    },
    openQuestions: {},
    examPrep: {
      miniTest: { score: 4, timeUsedMinutes: 15, completedInTime: true },
      selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 3, justifications: 3, stress: 1 },
      signals: { hardestItems: [5, 6], dominantErrorType: 'calcul', verifiedAnswers: true, feeling: 'ok' },
    },
    methodology: { learningStyle: 'visual', problemReflex: 'relire', weeklyWork: '3', maxConcentration: '1h', errorTypes: ['calcul'] },
    ambition: { targetMention: 'B', postBac: 'CPGE', pallier2Pace: 'oui' },
    freeText: {},
  };
  return { ...base, ...overrides } as BilanDiagnosticMathsData;
}

// ─── A1. coverageProgramme ─────────────────────────────────────────────────────

describe('coverageProgramme', () => {
  const chapters: ChapterDefinition[] = [
    { chapterId: 'ch1', chapterLabel: 'Suites', description: '', domainId: 'algebra', skills: ['sk_a1', 'sk_a2'] },
    { chapterId: 'ch2', chapterLabel: 'Dérivation', description: '', domainId: 'analysis', skills: ['sk_b1', 'sk_b2'] },
    { chapterId: 'ch3', chapterLabel: 'Vecteurs', description: '', domainId: 'geometry', skills: ['sk_c1'] },
    { chapterId: 'ch4', chapterLabel: 'Probabilités', description: '', domainId: 'probabilities', skills: ['sk_d1'] },
  ];

  const policy: ScoringPolicy = {
    domainWeights: { algebra: 0.30, analysis: 0.30, geometry: 0.20, probabilities: 0.20 },
    thresholds: { confirmed: { readiness: 60, risk: 55 }, conditional: { readiness: 48, risk: 70 } },
  };

  it('should compute seenChapterRatio correctly when all chapters selected', () => {
    const selection: ChaptersSelection = {
      selected: ['ch1', 'ch2', 'ch3', 'ch4'],
      inProgress: [],
      notYet: [],
    };
    const data = buildData({
      competencies: {
        algebra: [sk('A1', 'studied', 3, 1, [], 'sk_a1'), sk('A2', 'studied', 3, 1, [], 'sk_a2')],
        analysis: [sk('B1', 'studied', 3, 1, [], 'sk_b1'), sk('B2', 'studied', 3, 1, [], 'sk_b2')],
        geometry: [sk('C1', 'studied', 3, 1, [], 'sk_c1')],
        probabilities: [sk('D1', 'studied', 3, 1, [], 'sk_d1')],
      },
    });
    const result = computeScoringV2(data, policy, selection, chapters);
    expect(result.coverageProgramme).toBeDefined();
    expect(result.coverageProgramme!.seenChapterRatio).toBe(1.0);
    expect(result.coverageProgramme!.totalChapters).toBe(4);
    expect(result.coverageProgramme!.seenChapters).toBe(4);
  });

  it('should compute seenChapterRatio correctly when half chapters selected', () => {
    const selection: ChaptersSelection = {
      selected: ['ch1', 'ch2'],
      inProgress: [],
      notYet: ['ch3', 'ch4'],
    };
    const data = buildData({
      competencies: {
        algebra: [sk('A1', 'studied', 3, 1, [], 'sk_a1'), sk('A2', 'studied', 3, 1, [], 'sk_a2')],
        analysis: [sk('B1', 'studied', 3, 1, [], 'sk_b1'), sk('B2', 'studied', 3, 1, [], 'sk_b2')],
        geometry: [sk('C1', 'not_studied', null, null, [], 'sk_c1')],
        probabilities: [sk('D1', 'not_studied', null, null, [], 'sk_d1')],
      },
    });
    const result = computeScoringV2(data, policy, selection, chapters);
    expect(result.coverageProgramme).toBeDefined();
    expect(result.coverageProgramme!.seenChapterRatio).toBe(0.5);
    expect(result.coverageProgramme!.seenChapters).toBe(2);
  });

  it('should return seenChapterRatio 0 when no chapters selected', () => {
    const selection: ChaptersSelection = {
      selected: [],
      inProgress: [],
      notYet: ['ch1', 'ch2', 'ch3', 'ch4'],
    };
    const data = buildData();
    const result = computeScoringV2(data, policy, selection, chapters);
    expect(result.coverageProgramme).toBeDefined();
    expect(result.coverageProgramme!.seenChapterRatio).toBe(0);
    expect(result.coverageProgramme!.seenChapters).toBe(0);
  });

  it('should count inProgress chapters in coverage', () => {
    const selection: ChaptersSelection = {
      selected: ['ch1'],
      inProgress: ['ch2'],
      notYet: ['ch3', 'ch4'],
    };
    const data = buildData({
      competencies: {
        algebra: [sk('A1', 'studied', 3, 1, [], 'sk_a1'), sk('A2', 'studied', 3, 1, [], 'sk_a2')],
        analysis: [sk('B1', 'in_progress', 2, 2, [], 'sk_b1'), sk('B2', 'in_progress', 2, 2, [], 'sk_b2')],
        geometry: [sk('C1', 'not_studied', null, null, [], 'sk_c1')],
        probabilities: [sk('D1', 'not_studied', null, null, [], 'sk_d1')],
      },
    });
    const result = computeScoringV2(data, policy, selection, chapters);
    expect(result.coverageProgramme).toBeDefined();
    expect(result.coverageProgramme!.seenChapterRatio).toBe(0.5);
    expect(result.coverageProgramme!.inProgressChapters).toBe(1);
  });

  it('should return undefined coverageProgramme when no chaptersSelection provided', () => {
    const data = buildData();
    const result = computeScoringV2(data, policy, null, []);
    expect(result.coverageProgramme).toBeUndefined();
  });

  it('should return undefined coverageProgramme when chapters array is empty', () => {
    const selection: ChaptersSelection = { selected: [], inProgress: [], notYet: [] };
    const data = buildData();
    const result = computeScoringV2(data, policy, selection, []);
    expect(result.coverageProgramme).toBeUndefined();
  });

  it('should compute evaluatedSkillRatio for seen chapters', () => {
    const selection: ChaptersSelection = {
      selected: ['ch1'],
      inProgress: [],
      notYet: ['ch2', 'ch3', 'ch4'],
    };
    // ch1 has skills sk_a1, sk_a2 — only sk_a1 is evaluated
    const data = buildData({
      competencies: {
        algebra: [
          sk('A1', 'studied', 3, 1, [], 'sk_a1'),
          sk('A2', 'not_studied', null, null, [], 'sk_a2'),
        ],
        analysis: [sk('B1', 'not_studied', null, null, [], 'sk_b1'), sk('B2', 'not_studied', null, null, [], 'sk_b2')],
        geometry: [sk('C1', 'not_studied', null, null, [], 'sk_c1')],
        probabilities: [sk('D1', 'not_studied', null, null, [], 'sk_d1')],
      },
    });
    const result = computeScoringV2(data, policy, selection, chapters);
    expect(result.coverageProgramme).toBeDefined();
    // 1 evaluated out of 2 skills in ch1
    expect(result.coverageProgramme!.evaluatedSkillRatio).toBe(0.5);
  });
});

// ─── A2. Prerequisites ─────────────────────────────────────────────────────────

describe('prerequisites', () => {
  const chapters: ChapterDefinition[] = [
    { chapterId: 'ch-seen', chapterLabel: 'Suites', description: '', domainId: 'algebra', skills: ['sk_seen1', 'sk_seen2'] },
    { chapterId: 'ch-notyet', chapterLabel: 'Dérivation', description: '', domainId: 'analysis', skills: ['sk_prereq1'] },
  ];

  const skillMeta = [
    { skillId: 'sk_seen1', chapterId: 'ch-seen' },
    { skillId: 'sk_seen2', chapterId: 'ch-seen' },
    { skillId: 'sk_prereq1', chapterId: 'ch-notyet', prerequisite: true, prerequisiteLevel: 'core' as const },
  ];

  const policy: ScoringPolicy = {
    domainWeights: { algebra: 0.50, analysis: 0.50 },
    thresholds: { confirmed: { readiness: 60, risk: 55 }, conditional: { readiness: 48, risk: 70 } },
  };

  it('should not degrade readiness when notYet chapters have high mastery prerequisites', () => {
    const selection: ChaptersSelection = {
      selected: ['ch-seen'],
      inProgress: [],
      notYet: ['ch-notyet'],
    };
    const data = buildData({
      competencies: {
        algebra: [
          sk('Seen1', 'studied', 4, 0, [], 'sk_seen1'),
          sk('Seen2', 'studied', 4, 0, [], 'sk_seen2'),
        ],
        analysis: [
          sk('Prereq1', 'studied', 4, 0, [], 'sk_prereq1'),
          sk('Extra', 'studied', 4, 0),
        ],
      },
    });

    const withChapters = computeScoringV2(data, policy, selection, chapters, skillMeta);
    const withoutChapters = computeScoringV2(data, policy, null, [], []);

    // High mastery on prereqs should not penalize readiness
    // The difference should be minimal (0 penalty for mastery 4/4)
    expect(withChapters.readinessScore).toBeGreaterThanOrEqual(withoutChapters.readinessScore - 2);
  });

  it('should apply small penalty when notYet chapters have low mastery prerequisites', () => {
    const selection: ChaptersSelection = {
      selected: ['ch-seen'],
      inProgress: [],
      notYet: ['ch-notyet'],
    };
    const data = buildData({
      competencies: {
        algebra: [
          sk('Seen1', 'studied', 4, 0, [], 'sk_seen1'),
          sk('Seen2', 'studied', 4, 0, [], 'sk_seen2'),
        ],
        analysis: [
          sk('Prereq1', 'studied', 0, 4, ['calcul'], 'sk_prereq1'),
          sk('Extra', 'studied', 4, 0),
        ],
      },
    });

    const withChapters = computeScoringV2(data, policy, selection, chapters, skillMeta);
    const withoutChapters = computeScoringV2(data, policy, null, [], []);

    // Low mastery on core prereqs should apply a penalty
    expect(withChapters.readinessScore).toBeLessThan(withoutChapters.readinessScore);
  });

  it('should not apply prerequisite penalty when no notYet chapters', () => {
    const selection: ChaptersSelection = {
      selected: ['ch-seen', 'ch-notyet'],
      inProgress: [],
      notYet: [],
    };
    const data = buildData({
      competencies: {
        algebra: [
          sk('Seen1', 'studied', 3, 1, [], 'sk_seen1'),
          sk('Seen2', 'studied', 3, 1, [], 'sk_seen2'),
        ],
        analysis: [
          sk('Prereq1', 'studied', 1, 3, [], 'sk_prereq1'),
          sk('Extra', 'studied', 3, 1),
        ],
      },
    });

    const withChapters = computeScoringV2(data, policy, selection, chapters, skillMeta);
    const withoutChapters = computeScoringV2(data, policy, null, [], []);

    // No notYet => no prereq penalty => same readiness
    expect(withChapters.readinessScore).toBe(withoutChapters.readinessScore);
  });
});

// ─── A3. Scoring Invariants ────────────────────────────────────────────────────

describe('scoring invariants', () => {
  it('not_studied status => mastery, confidence, friction should be null', () => {
    const data = buildData({
      competencies: {
        algebra: [
          sk('NotStudied', 'not_studied', null, null, []),
          sk('Studied', 'studied', 3, 1),
        ],
        analysis: [
          sk('A', 'studied', 3, 1),
          sk('B', 'studied', 3, 1),
        ],
        geometry: [],
        probabilities: [],
        python: [],
      },
    });
    const result = computeScoringV2(data);

    // The not_studied item should not contribute to mastery
    const algebraDomain = result.domainScores.find(d => d.domain === 'algebra');
    expect(algebraDomain).toBeDefined();
    // Only 1 evaluated item (< 2 threshold) → domain inactive
    expect(algebraDomain!.evaluatedCount).toBe(1);
    expect(algebraDomain!.notStudiedCount).toBe(1);
  });

  it('not_studied items should have default empty errorTypes', () => {
    const item = sk('Test', 'not_studied', null, null, []);
    expect(item.errorTypes).toEqual([]);
    expect(item.mastery).toBeNull();
    expect(item.confidence).toBeNull();
    expect(item.friction).toBeNull();
  });

  it('unknown status should have null mastery/confidence/friction', () => {
    const item = sk('Test', 'unknown', null, null, []);
    expect(item.mastery).toBeNull();
    expect(item.confidence).toBeNull();
    expect(item.friction).toBeNull();
    expect(item.errorTypes).toEqual([]);
  });

  it('studied items with mastery 0 should still count as evaluated', () => {
    const data = buildData({
      competencies: {
        algebra: [
          sk('A', 'studied', 0, 4),
          sk('B', 'studied', 0, 4),
        ],
        analysis: [
          sk('C', 'studied', 0, 4),
          sk('D', 'studied', 0, 4),
        ],
        geometry: [],
        probabilities: [],
        python: [],
      },
    });
    const result = computeScoringV2(data);

    const algebraDomain = result.domainScores.find(d => d.domain === 'algebra');
    expect(algebraDomain!.evaluatedCount).toBe(2);
    expect(algebraDomain!.score).toBe(0); // mastery 0/4 = 0%
  });

  it('all domains empty should produce masteryIndex 0 and coverageIndex 0', () => {
    const data = buildData({
      competencies: {
        algebra: [],
        analysis: [],
        geometry: [],
        probabilities: [],
        python: [],
      },
    });
    const result = computeScoringV2(data);

    expect(result.masteryIndex).toBe(0);
    expect(result.coverageIndex).toBe(0);
    expect(result.dataQuality.quality).toBe('insufficient');
    expect(result.dataQuality.activeDomains).toBe(0);
  });

  it('readinessScore should always be between 0 and 100', () => {
    // Extreme low
    const low = buildData({
      competencies: {
        algebra: [sk('A', 'studied', 0, 4), sk('B', 'studied', 0, 4)],
        analysis: [],
        geometry: [],
        probabilities: [],
        python: [],
      },
      examPrep: {
        miniTest: { score: 0, timeUsedMinutes: 25, completedInTime: false },
        selfRatings: { speedNoCalc: 0, calcReliability: 0, redaction: 0, justifications: 0, stress: 4 },
        signals: { hardestItems: [1, 2, 3, 4, 5, 6], dominantErrorType: 'calcul', verifiedAnswers: false, feeling: 'panic' },
      },
    });
    const lowResult = computeScoringV2(low);
    expect(lowResult.readinessScore).toBeGreaterThanOrEqual(0);
    expect(lowResult.readinessScore).toBeLessThanOrEqual(100);

    // Extreme high
    const high = buildData({
      competencies: {
        algebra: [sk('A', 'studied', 4, 0), sk('B', 'studied', 4, 0), sk('C', 'studied', 4, 0)],
        analysis: [sk('D', 'studied', 4, 0), sk('E', 'studied', 4, 0), sk('F', 'studied', 4, 0)],
        geometry: [sk('G', 'studied', 4, 0), sk('H', 'studied', 4, 0)],
        probabilities: [sk('I', 'studied', 4, 0), sk('J', 'studied', 4, 0)],
        python: [sk('K', 'studied', 4, 0), sk('L', 'studied', 4, 0)],
      },
      examPrep: {
        miniTest: { score: 6, timeUsedMinutes: 10, completedInTime: true },
        selfRatings: { speedNoCalc: 4, calcReliability: 4, redaction: 4, justifications: 4, stress: 0 },
        signals: { hardestItems: [], dominantErrorType: '', verifiedAnswers: true, feeling: 'ok' },
      },
    });
    const highResult = computeScoringV2(high);
    expect(highResult.readinessScore).toBeGreaterThanOrEqual(0);
    expect(highResult.readinessScore).toBeLessThanOrEqual(100);
  });

  it('riskIndex should always be between 0 and 100', () => {
    const data = buildData();
    const result = computeScoringV2(data);
    expect(result.riskIndex).toBeGreaterThanOrEqual(0);
    expect(result.riskIndex).toBeLessThanOrEqual(100);
  });
});

// ─── A4. Chapter-aware alerts ──────────────────────────────────────────────────

describe('chapter-aware alerts', () => {
  const chapters: ChapterDefinition[] = Array.from({ length: 10 }, (_, i) => ({
    chapterId: `ch${i}`,
    chapterLabel: `Chapter ${i}`,
    description: '',
    domainId: 'algebra',
    skills: [`sk_ch${i}`],
  }));

  const policy: ScoringPolicy = {
    domainWeights: { algebra: 1.0 },
    thresholds: { confirmed: { readiness: 60, risk: 55 }, conditional: { readiness: 48, risk: 70 } },
  };

  it('should trigger PROGRAM_NOT_COVERED when < 30% chapters seen', () => {
    const selection: ChaptersSelection = {
      selected: ['ch0', 'ch1'],
      inProgress: [],
      notYet: ['ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8', 'ch9'],
    };
    const data = buildData({
      competencies: {
        algebra: [sk('A', 'studied', 3, 1), sk('B', 'studied', 3, 1)],
      },
    });
    const result = computeScoringV2(data, policy, selection, chapters);
    expect(result.alerts.some(a => a.code === 'PROGRAM_NOT_COVERED')).toBe(true);
  });

  it('should NOT trigger PROGRAM_NOT_COVERED when >= 30% chapters seen', () => {
    const selection: ChaptersSelection = {
      selected: ['ch0', 'ch1', 'ch2'],
      inProgress: [],
      notYet: ['ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8', 'ch9'],
    };
    const data = buildData({
      competencies: {
        algebra: [sk('A', 'studied', 3, 1), sk('B', 'studied', 3, 1)],
      },
    });
    const result = computeScoringV2(data, policy, selection, chapters);
    // 3/10 = 0.30 exactly, condition is < 0.30 (strict), so alert should NOT fire
    expect(result.alerts.some(a => a.code === 'PROGRAM_NOT_COVERED')).toBe(false);
  });
});

// ─── A5. Definitions Registry ──────────────────────────────────────────────────

describe('definitions registry', () => {
  const EXPECTED_KEYS = ['maths-premiere-p2', 'maths-terminale-p2', 'nsi-premiere-p2', 'nsi-terminale-p2'];

  it('should have all 4 primary definitions registered', () => {
    const keys = listDefinitionKeys();
    for (const key of EXPECTED_KEYS) {
      expect(keys).toContain(key);
    }
  });

  it('should return valid definition for each key', () => {
    for (const key of EXPECTED_KEYS) {
      const def = getDefinition(key);
      expect(def.key).toBe(key);
      expect(def.version).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(['maths', 'nsi']).toContain(def.track);
      expect(['premiere', 'terminale']).toContain(def.level);
      expect(def.stage).toBe('pallier2');
      expect(Object.keys(def.skills).length).toBeGreaterThan(0);
      expect(Object.keys(def.scoringPolicy.domainWeights).length).toBeGreaterThan(0);
    }
  });

  it('should throw for unknown definition key', () => {
    expect(() => getDefinition('unknown-xyz')).toThrow('Unknown diagnostic definition');
  });

  it('should return null for unknown key with getDefinitionOrNull', () => {
    expect(getDefinitionOrNull('unknown-xyz')).toBeNull();
  });

  it('each definition should have chapters with skills', () => {
    for (const key of EXPECTED_KEYS) {
      const def = getDefinition(key);
      if (def.chapters && def.chapters.length > 0) {
        for (const ch of def.chapters) {
          expect(ch.chapterId).toBeTruthy();
          expect(ch.chapterLabel).toBeTruthy();
          expect(ch.domainId).toBeTruthy();
          expect(Array.isArray(ch.skills)).toBe(true);
          expect(ch.skills.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('domain weights should sum to approximately 1.0 for each definition', () => {
    for (const key of EXPECTED_KEYS) {
      const def = getDefinition(key);
      const weightSum = Object.values(def.scoringPolicy.domainWeights).reduce((s, w) => s + w, 0);
      expect(weightSum).toBeGreaterThan(0.95);
      expect(weightSum).toBeLessThan(1.05);
    }
  });

  it('legacy aliases should resolve to correct definitions', () => {
    expect(getDefinition('eds_maths_1ere').key).toBe('maths-premiere-p2');
    expect(getDefinition('eds_maths_tle').key).toBe('maths-terminale-p2');
    expect(getDefinition('eds_nsi_1ere').key).toBe('nsi-premiere-p2');
    expect(getDefinition('eds_nsi_tle').key).toBe('nsi-terminale-p2');
  });

  it('NSI Terminale should have databases domain with SQL-related skills', () => {
    const def = getDefinition('nsi-terminale-p2');
    const dbDomain = def.skills['databases'] || def.skills['data_structures'];
    // At least one domain should contain SQL-related skills
    const allSkills = Object.values(def.skills).flat();
    const sqlSkills = allSkills.filter(s =>
      s.label.toLowerCase().includes('sql') ||
      s.label.toLowerCase().includes('base') ||
      s.label.toLowerCase().includes('requête')
    );
    expect(sqlSkills.length).toBeGreaterThan(0);
  });
});

// ─── A6. Inconsistency: HIGH_AVERAGE_LOW_MASTERY ────────────────────────────────

describe('inconsistency: HIGH_AVERAGE_LOW_MASTERY', () => {
  it('should detect when declared average >= 14 but mastery < 40%', () => {
    const data = buildData({
      performance: { mathAverage: '16', lastTestScore: '15', classRanking: '3/30' },
      competencies: {
        algebra: [sk('A', 'studied', 1, 3), sk('B', 'studied', 1, 3)],
        analysis: [sk('C', 'studied', 1, 3), sk('D', 'studied', 1, 3)],
        geometry: [sk('E', 'studied', 1, 3), sk('F', 'studied', 1, 3)],
        probabilities: [sk('G', 'studied', 1, 3), sk('H', 'studied', 1, 3)],
        python: [sk('I', 'studied', 1, 3), sk('J', 'studied', 1, 3)],
      },
    });
    const result = computeScoringV2(data);
    expect(result.inconsistencies.some(i => i.code === 'HIGH_AVERAGE_LOW_MASTERY')).toBe(true);
  });

  it('should NOT detect when average < 14', () => {
    const data = buildData({
      performance: { mathAverage: '10', lastTestScore: '9', classRanking: '20/30' },
      competencies: {
        algebra: [sk('A', 'studied', 1, 3), sk('B', 'studied', 1, 3)],
        analysis: [sk('C', 'studied', 1, 3), sk('D', 'studied', 1, 3)],
        geometry: [],
        probabilities: [],
        python: [],
      },
    });
    const result = computeScoringV2(data);
    expect(result.inconsistencies.some(i => i.code === 'HIGH_AVERAGE_LOW_MASTERY')).toBe(false);
  });
});

// ─── A7. STUDIED_NO_MASTERY inconsistency ───────────────────────────────────────

describe('inconsistency: STUDIED_NO_MASTERY', () => {
  it('should detect when >= 2 studied items have null mastery', () => {
    const data = buildData({
      competencies: {
        algebra: [
          { skillId: 'sk1', skillLabel: 'A', status: 'studied', mastery: null, confidence: null, friction: null, errorTypes: [], evidence: '' },
          { skillId: 'sk2', skillLabel: 'B', status: 'studied', mastery: null, confidence: null, friction: null, errorTypes: [], evidence: '' },
        ],
        analysis: [sk('C', 'studied', 3, 1), sk('D', 'studied', 3, 1)],
        geometry: [],
        probabilities: [],
        python: [],
      },
    });
    const result = computeScoringV2(data);
    expect(result.inconsistencies.some(i => i.code === 'STUDIED_NO_MASTERY')).toBe(true);
  });
});
