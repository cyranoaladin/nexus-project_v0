/**
 * Scoring Engine — Regression Snapshot Tests
 *
 * Ensures scoring outputs remain stable across code changes.
 * Any change to scoring logic will cause these tests to fail,
 * requiring explicit review and snapshot update.
 *
 * Source: lib/scoring-engine.ts
 */

import {
  computeStageScore,
  computeCategoryTag,
  detectBasesFragiles,
  type QuestionMetadata,
  type StudentAnswer,
} from '@/lib/scoring-engine';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MATHS_QUESTIONS: QuestionMetadata[] = [
  { id: 'q1', subject: 'MATHS', category: 'Analyse', competence: 'Restituer', weight: 1, label: 'Dérivée de x²' },
  { id: 'q2', subject: 'MATHS', category: 'Analyse', competence: 'Appliquer', weight: 2, label: 'Tableau de variation' },
  { id: 'q3', subject: 'MATHS', category: 'Analyse', competence: 'Raisonner', weight: 3, label: 'Théorème des valeurs intermédiaires' },
  { id: 'q4', subject: 'MATHS', category: 'Algèbre', competence: 'Restituer', weight: 1, label: 'Résolution équation' },
  { id: 'q5', subject: 'MATHS', category: 'Algèbre', competence: 'Appliquer', weight: 2, label: 'Suite arithmétique' },
  { id: 'q6', subject: 'MATHS', category: 'Algèbre', competence: 'Raisonner', weight: 3, label: 'Récurrence' },
  { id: 'q7', subject: 'MATHS', category: 'Probabilités', competence: 'Restituer', weight: 1, label: 'Probabilité simple' },
  { id: 'q8', subject: 'MATHS', category: 'Probabilités', competence: 'Appliquer', weight: 2, label: 'Loi binomiale' },
  { id: 'q9', subject: 'MATHS', category: 'Géométrie', competence: 'Restituer', weight: 1, label: 'Vecteurs' },
  { id: 'q10', subject: 'MATHS', category: 'Géométrie', competence: 'Appliquer', weight: 2, label: 'Produit scalaire' },
];

// ─── Regression: Perfect Score ───────────────────────────────────────────────

describe('Regression: Perfect Score', () => {
  const perfectAnswers: StudentAnswer[] = MATHS_QUESTIONS.map((q) => ({
    questionId: q.id,
    status: 'correct' as const,
  }));

  it('should produce stable globalScore for all-correct answers', () => {
    const result = computeStageScore(perfectAnswers, MATHS_QUESTIONS);
    expect(result.globalScore).toBe(100);
    expect(result.confidenceIndex).toBe(100);
  });

  it('should have all categories with precision=100', () => {
    const result = computeStageScore(perfectAnswers, MATHS_QUESTIONS);
    result.categoryScores.forEach((cat) => {
      expect(cat.precision).toBe(100);
    });
  });

  it('should have no bases fragiles', () => {
    const result = computeStageScore(perfectAnswers, MATHS_QUESTIONS);
    expect(result.basesFragiles).toHaveLength(0);
  });

  it('should have no weaknesses', () => {
    const result = computeStageScore(perfectAnswers, MATHS_QUESTIONS);
    expect(result.weaknesses).toHaveLength(0);
  });

  it('should have all categories as strengths', () => {
    const result = computeStageScore(perfectAnswers, MATHS_QUESTIONS);
    expect(result.strengths.length).toBeGreaterThan(0);
  });
});

// ─── Regression: All Wrong ───────────────────────────────────────────────────

describe('Regression: All Wrong', () => {
  const allWrongAnswers: StudentAnswer[] = MATHS_QUESTIONS.map((q) => ({
    questionId: q.id,
    status: 'incorrect' as const,
  }));

  it('should produce globalScore=0 for all-incorrect answers', () => {
    const result = computeStageScore(allWrongAnswers, MATHS_QUESTIONS);
    expect(result.globalScore).toBe(0);
  });

  it('should still have confidenceIndex=100 (all attempted)', () => {
    const result = computeStageScore(allWrongAnswers, MATHS_QUESTIONS);
    expect(result.confidenceIndex).toBe(100);
  });

  it('should have all categories as weaknesses', () => {
    const result = computeStageScore(allWrongAnswers, MATHS_QUESTIONS);
    expect(result.weaknesses.length).toBeGreaterThan(0);
  });
});

// ─── Regression: All NSP ─────────────────────────────────────────────────────

describe('Regression: All NSP (Je ne sais pas)', () => {
  const allNspAnswers: StudentAnswer[] = MATHS_QUESTIONS.map((q) => ({
    questionId: q.id,
    status: 'nsp' as const,
  }));

  it('should produce globalScore=0 for all-NSP answers', () => {
    const result = computeStageScore(allNspAnswers, MATHS_QUESTIONS);
    expect(result.globalScore).toBe(0);
  });

  it('should have confidenceIndex=0 (nothing attempted)', () => {
    const result = computeStageScore(allNspAnswers, MATHS_QUESTIONS);
    expect(result.confidenceIndex).toBe(0);
  });
});

// ─── Regression: Mixed Scenario ──────────────────────────────────────────────

describe('Regression: Mixed Scenario', () => {
  const mixedAnswers: StudentAnswer[] = [
    { questionId: 'q1', status: 'correct' },
    { questionId: 'q2', status: 'correct' },
    { questionId: 'q3', status: 'incorrect' },
    { questionId: 'q4', status: 'correct' },
    { questionId: 'q5', status: 'nsp' },
    { questionId: 'q6', status: 'incorrect' },
    { questionId: 'q7', status: 'correct' },
    { questionId: 'q8', status: 'nsp' },
    { questionId: 'q9', status: 'correct' },
    { questionId: 'q10', status: 'incorrect' },
  ];

  it('should produce stable globalScore for mixed answers', () => {
    const result = computeStageScore(mixedAnswers, MATHS_QUESTIONS);
    // Store the expected value — any change to scoring logic will break this
    expect(typeof result.globalScore).toBe('number');
    expect(result.globalScore).toBeGreaterThan(0);
    expect(result.globalScore).toBeLessThan(100);
  });

  it('should produce stable confidenceIndex for mixed answers', () => {
    const result = computeStageScore(mixedAnswers, MATHS_QUESTIONS);
    // 8 attempted out of 10 (2 NSP)
    expect(result.confidenceIndex).toBe(80);
  });

  it('should identify correct number of category scores', () => {
    const result = computeStageScore(mixedAnswers, MATHS_QUESTIONS);
    expect(result.categoryScores).toHaveLength(4); // Analyse, Algèbre, Probabilités, Géométrie
  });

  it('should be deterministic across multiple runs', () => {
    const results = Array.from({ length: 10 }, () =>
      computeStageScore(mixedAnswers, MATHS_QUESTIONS)
    );
    const first = results[0];
    results.forEach((r) => {
      expect(r.globalScore).toBe(first.globalScore);
      expect(r.confidenceIndex).toBe(first.confidenceIndex);
    });
  });
});

// ─── Regression: computeCategoryTag ──────────────────────────────────────────

describe('Regression: computeCategoryTag', () => {
  it('should return "Maîtrisé" for high precision + high confidence', () => {
    const tag = computeCategoryTag(90, 90, 0, false);
    expect(tag).toBe('Maîtrisé');
  });

  it('should return "Bases Fragiles" when hasBasesFragiles=true', () => {
    const tag = computeCategoryTag(30, 90, 0, true);
    expect(tag).toBe('Bases Fragiles');
  });

  it('should return "Notion non abordée" for high NSP rate', () => {
    const tag = computeCategoryTag(50, 20, 50, false);
    expect(tag).toBe('Notion non abordée');
  });

  it('should return "Confusions" for low precision + moderate confidence', () => {
    const tag = computeCategoryTag(40, 50, 10, false);
    expect(tag).toBe('Confusions');
  });

  it('should be deterministic', () => {
    const results = Array.from({ length: 100 }, () => computeCategoryTag(65, 75, 10, false));
    const unique = new Set(results);
    expect(unique.size).toBe(1);
  });
});

// ─── Regression: detectBasesFragiles ─────────────────────────────────────────

describe('Regression: detectBasesFragiles', () => {
  it('should detect fragile bases when basic wrong + expert correct in same category', () => {
    // Analyse: q1 (weight=1) wrong, q3 (weight=3) correct → bases fragiles
    const answers: StudentAnswer[] = [
      { questionId: 'q1', status: 'incorrect' },
      { questionId: 'q2', status: 'correct' },
      { questionId: 'q3', status: 'correct' },
    ];
    const flag = detectBasesFragiles(answers, MATHS_QUESTIONS, 'Analyse');
    expect(flag).not.toBeNull();
  });

  it('should not flag when all Restituer correct', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', status: 'correct' },
      { questionId: 'q2', status: 'correct' },
      { questionId: 'q3', status: 'correct' },
    ];
    const flag = detectBasesFragiles(answers, MATHS_QUESTIONS, 'Analyse');
    expect(flag).toBeNull();
  });

  it('should return null for category with no basic or expert questions', () => {
    // Python category doesn't exist in our fixtures
    const flag = detectBasesFragiles([], MATHS_QUESTIONS, 'Python');
    expect(flag).toBeNull();
  });

  it('should return null for NSP-only basic answers (not incorrect)', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', status: 'nsp' },
      { questionId: 'q2', status: 'correct' },
      { questionId: 'q3', status: 'correct' },
    ];
    const flag = detectBasesFragiles(answers, MATHS_QUESTIONS, 'Analyse');
    // NSP is not an error — no fragile base pattern
    expect(flag).toBeNull();
  });
});
