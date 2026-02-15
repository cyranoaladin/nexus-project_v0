/**
 * Tests for chapter-aware scoring features:
 * - coverageProgramme computation
 * - PROGRAM_NOT_COVERED alert
 * - ADVANCED_GAPS alert
 * - Backward compatibility (no chapters = no crash)
 */

import { computeScoringV2 } from '@/lib/diagnostics/score-diagnostic';
import type { ScoringPolicy, ChaptersSelection, ChapterDefinition } from '@/lib/diagnostics/types';
import type { BilanDiagnosticMathsData } from '@/lib/validations';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const POLICY: ScoringPolicy = {
  domainWeights: { algebra: 0.30, analysis: 0.30, prob: 0.20, python: 0.20 },
  thresholds: { confirmed: { readiness: 60, risk: 55 }, conditional: { readiness: 48, risk: 70 } },
};

const CHAPTERS: ChapterDefinition[] = [
  { chapterId: 'CH1', chapterLabel: 'Suites', description: '', domainId: 'algebra', skills: ['S1', 'S2'] },
  { chapterId: 'CH2', chapterLabel: 'Dérivation', description: '', domainId: 'analysis', skills: ['S3', 'S4'] },
  { chapterId: 'CH3', chapterLabel: 'Probas', description: '', domainId: 'prob', skills: ['S5'] },
  { chapterId: 'CH4', chapterLabel: 'Python', description: '', domainId: 'python', skills: ['S6'] },
  { chapterId: 'CH5', chapterLabel: 'Trigo', description: '', domainId: 'analysis', skills: ['S7'] },
  { chapterId: 'CH6', chapterLabel: 'Géo', description: '', domainId: 'algebra', skills: ['S8'] },
  { chapterId: 'CH7', chapterLabel: 'Expo', description: '', domainId: 'analysis', skills: ['S9'] },
  { chapterId: 'CH8', chapterLabel: 'Logique', description: '', domainId: 'algebra', skills: ['S10'] },
  { chapterId: 'CH9', chapterLabel: 'Stats', description: '', domainId: 'prob', skills: ['S11'] },
  { chapterId: 'CH10', chapterLabel: 'Algo', description: '', domainId: 'python', skills: ['S12'] },
];

function makeCompetencyItem(skillId: string, label: string, mastery: number, status = 'studied') {
  return { skillId, skillLabel: label, status, mastery, confidence: 2, friction: 1, errorTypes: [] as string[], evidence: '' };
}

function makeData(): BilanDiagnosticMathsData {
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
      prob: [
        makeCompetencyItem('S5', 'Conditionnelles', 2),
      ],
      python: [
        makeCompetencyItem('S6', 'Fonctions', 3),
      ],
    },
    openQuestions: {},
    examPrep: {
      miniTest: { score: 4, timeUsedMinutes: 12, completedInTime: true },
      selfRatings: { speedNoCalc: 2, calcReliability: 2, redaction: 2, justifications: 2, stress: 2 },
      signals: { hardestItems: [], verifiedAnswers: true, feeling: 'neutral' },
    },
    methodology: {},
    ambition: {},
    freeText: {},
  } as BilanDiagnosticMathsData;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('computeScoringV2 — backward compatibility (no chapters)', () => {
  it('returns undefined coverageProgramme when no chapters provided', () => {
    const data = makeData();
    const result = computeScoringV2(data, POLICY);
    expect(result.coverageProgramme).toBeUndefined();
  });

  it('does not add chapter alerts when no chapters provided', () => {
    const data = makeData();
    const result = computeScoringV2(data, POLICY);
    const chapterAlerts = result.alerts.filter(a => a.code === 'PROGRAM_NOT_COVERED' || a.code === 'ADVANCED_GAPS');
    expect(chapterAlerts).toHaveLength(0);
  });
});

describe('computeScoringV2 — coverageProgramme', () => {
  it('computes coverage when chapters provided', () => {
    const data = makeData();
    const selection: ChaptersSelection = {
      selected: ['CH1', 'CH2', 'CH3'],
      inProgress: ['CH4'],
      notYet: ['CH5', 'CH6', 'CH7', 'CH8', 'CH9', 'CH10'],
    };
    const result = computeScoringV2(data, POLICY, selection, CHAPTERS);

    expect(result.coverageProgramme).toBeDefined();
    expect(result.coverageProgramme!.totalChapters).toBe(10);
    expect(result.coverageProgramme!.seenChapters).toBe(3);
    expect(result.coverageProgramme!.inProgressChapters).toBe(1);
    expect(result.coverageProgramme!.seenChapterRatio).toBeCloseTo(0.4, 1);
  });

  it('computes evaluatedSkillRatio correctly', () => {
    const data = makeData();
    // CH1 has S1, S2 (both in competencies as studied)
    // CH2 has S3, S4 (both in competencies as studied)
    // CH3 has S5 (in competencies as studied)
    const selection: ChaptersSelection = {
      selected: ['CH1', 'CH2', 'CH3'],
      inProgress: [],
      notYet: ['CH4', 'CH5', 'CH6', 'CH7', 'CH8', 'CH9', 'CH10'],
    };
    const result = computeScoringV2(data, POLICY, selection, CHAPTERS);

    // 5 skills in seen chapters (S1,S2,S3,S4,S5), all evaluated
    expect(result.coverageProgramme!.evaluatedSkillRatio).toBe(1.0);
  });
});

describe('computeScoringV2 — PROGRAM_NOT_COVERED alert', () => {
  it('fires when less than 30% of chapters seen', () => {
    const data = makeData();
    // Only 2 out of 10 chapters = 20%
    const selection: ChaptersSelection = {
      selected: ['CH1'],
      inProgress: ['CH2'],
      notYet: ['CH3', 'CH4', 'CH5', 'CH6', 'CH7', 'CH8', 'CH9', 'CH10'],
    };
    const result = computeScoringV2(data, POLICY, selection, CHAPTERS);
    const alert = result.alerts.find(a => a.code === 'PROGRAM_NOT_COVERED');
    expect(alert).toBeDefined();
    expect(alert!.type).toBe('warning');
  });

  it('does NOT fire when 30%+ chapters seen', () => {
    const data = makeData();
    // 4 out of 10 = 40%
    const selection: ChaptersSelection = {
      selected: ['CH1', 'CH2', 'CH3'],
      inProgress: ['CH4'],
      notYet: ['CH5', 'CH6', 'CH7', 'CH8', 'CH9', 'CH10'],
    };
    const result = computeScoringV2(data, POLICY, selection, CHAPTERS);
    const alert = result.alerts.find(a => a.code === 'PROGRAM_NOT_COVERED');
    expect(alert).toBeUndefined();
  });
});

describe('computeScoringV2 — ADVANCED_GAPS alert', () => {
  it('fires when seen chapters have low mastery in their domain', () => {
    const data = makeData();
    // analysis domain has score < 40 (S3=1, S4=2 → mean=1.5/4=37.5%)
    // CH2 is in analysis and is seen
    const selection: ChaptersSelection = {
      selected: ['CH1', 'CH2', 'CH3', 'CH4'],
      inProgress: [],
      notYet: ['CH5', 'CH6', 'CH7', 'CH8', 'CH9', 'CH10'],
    };
    const result = computeScoringV2(data, POLICY, selection, CHAPTERS);
    const alert = result.alerts.find(a => a.code === 'ADVANCED_GAPS');
    expect(alert).toBeDefined();
    expect(alert!.message).toContain('analysis');
  });
});
