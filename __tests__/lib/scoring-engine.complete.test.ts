/**
 * Scoring Engine V3 — Complete Test Suite
 *
 * Extends existing scoring-engine.test.ts with missing edge cases:
 * - Weight-based scoring (W1/W2/W3)
 * - NSP handling edge cases
 * - Empty/unknown inputs
 * - Determinism
 * - Domain separation (Maths vs NSI)
 * - Confidence thresholds
 * - Diagnostic text generation
 */

import {
  computeStageScore,
  computeCategoryTag,
  detectBasesFragiles,
  computeNSIErrors,
  generateLucidityText,
  type QuestionMetadata,
  type StudentAnswer,
  type StageScoringResult,
} from '@/lib/scoring-engine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMathsQuestions(): QuestionMetadata[] {
  return [
    // Analyse (3 questions: weight 1, 2, 3)
    { id: 'A1', subject: 'MATHS', category: 'Analyse', competence: 'Restituer', weight: 1, label: 'Dérivée de x²' },
    { id: 'A2', subject: 'MATHS', category: 'Analyse', competence: 'Appliquer', weight: 2, label: 'Tableau de variation' },
    { id: 'A3', subject: 'MATHS', category: 'Analyse', competence: 'Raisonner', weight: 3, label: 'TVI' },
    // Algèbre (3 questions)
    { id: 'B1', subject: 'MATHS', category: 'Algèbre', competence: 'Restituer', weight: 1, label: 'Équation 1er degré' },
    { id: 'B2', subject: 'MATHS', category: 'Algèbre', competence: 'Appliquer', weight: 2, label: 'Suites arithmétiques' },
    { id: 'B3', subject: 'MATHS', category: 'Algèbre', competence: 'Raisonner', weight: 3, label: 'Récurrence' },
    // Probabilités (2 questions)
    { id: 'P1', subject: 'MATHS', category: 'Probabilités', competence: 'Restituer', weight: 1, label: 'Probabilité simple' },
    { id: 'P2', subject: 'MATHS', category: 'Probabilités', competence: 'Appliquer', weight: 2, label: 'Loi binomiale' },
  ];
}

function buildNSIQuestions(): QuestionMetadata[] {
  return [
    { id: 'N1', subject: 'NSI', category: 'Programmation', competence: 'Restituer', weight: 1, nsiErrorType: 'syntax', label: 'Syntaxe Python' },
    { id: 'N2', subject: 'NSI', category: 'Programmation', competence: 'Appliquer', weight: 2, nsiErrorType: 'logic', label: 'Boucle for' },
    { id: 'N3', subject: 'NSI', category: 'Algorithmique', competence: 'Raisonner', weight: 3, nsiErrorType: 'logic', label: 'Récursivité' },
    { id: 'N4', subject: 'NSI', category: 'Données', competence: 'Appliquer', weight: 2, nsiErrorType: 'conceptual', label: 'SQL SELECT' },
  ];
}

function allCorrectAnswers(questions: QuestionMetadata[]): StudentAnswer[] {
  return questions.map((q) => ({ questionId: q.id, status: 'correct' as const }));
}

function allNSPAnswers(questions: QuestionMetadata[]): StudentAnswer[] {
  return questions.map((q) => ({ questionId: q.id, status: 'nsp' as const }));
}

function allIncorrectAnswers(questions: QuestionMetadata[]): StudentAnswer[] {
  return questions.map((q) => ({ questionId: q.id, status: 'incorrect' as const }));
}

// ─── Weight-Based Scoring (W1/W2/W3) ────────────────────────────────────────

describe('Weight-Based Scoring (W1/W2/W3)', () => {
  const questions = buildMathsQuestions();

  it('should apply W1=1 weight to basic (Restituer) questions', () => {
    // Arrange: only answer weight=1 questions correctly
    const answers: StudentAnswer[] = [
      { questionId: 'A1', status: 'correct' }, // weight=1
      { questionId: 'A2', status: 'nsp' },     // weight=2
      { questionId: 'A3', status: 'nsp' },     // weight=3
      { questionId: 'B1', status: 'correct' }, // weight=1
      { questionId: 'B2', status: 'nsp' },
      { questionId: 'B3', status: 'nsp' },
      { questionId: 'P1', status: 'correct' }, // weight=1
      { questionId: 'P2', status: 'nsp' },
    ];

    // Act
    const result = computeStageScore(answers, questions);

    // Assert: total weighted max = 1+2+3 + 1+2+3 + 1+2 = 15
    // weighted score = 1+1+1 = 3
    // globalScore = 3/15 * 100 = 20
    expect(result.globalScore).toBe(20);
  });

  it('should apply W2=2 weight to intermediate (Appliquer) questions', () => {
    // Arrange: only answer weight=2 questions correctly
    const answers: StudentAnswer[] = [
      { questionId: 'A1', status: 'nsp' },
      { questionId: 'A2', status: 'correct' }, // weight=2
      { questionId: 'A3', status: 'nsp' },
      { questionId: 'B1', status: 'nsp' },
      { questionId: 'B2', status: 'correct' }, // weight=2
      { questionId: 'B3', status: 'nsp' },
      { questionId: 'P1', status: 'nsp' },
      { questionId: 'P2', status: 'correct' }, // weight=2
    ];

    // Act
    const result = computeStageScore(answers, questions);

    // Assert: weighted score = 2+2+2 = 6, max = 15
    // globalScore = 6/15 * 100 = 40
    expect(result.globalScore).toBe(40);
  });

  it('should apply W3=3 weight to expert (Raisonner) questions', () => {
    // Arrange: only answer weight=3 questions correctly
    const answers: StudentAnswer[] = [
      { questionId: 'A1', status: 'nsp' },
      { questionId: 'A2', status: 'nsp' },
      { questionId: 'A3', status: 'correct' }, // weight=3
      { questionId: 'B1', status: 'nsp' },
      { questionId: 'B2', status: 'nsp' },
      { questionId: 'B3', status: 'correct' }, // weight=3
      { questionId: 'P1', status: 'nsp' },
      { questionId: 'P2', status: 'nsp' },
    ];

    // Act
    const result = computeStageScore(answers, questions);

    // Assert: weighted score = 3+3 = 6, max = 15
    // globalScore = 6/15 * 100 = 40
    expect(result.globalScore).toBe(40);
  });

  it('should return score=100 when all answers are correct at max weight', () => {
    // Arrange
    const answers = allCorrectAnswers(questions);

    // Act
    const result = computeStageScore(answers, questions);

    // Assert
    expect(result.globalScore).toBe(100);
    expect(result.totalCorrect).toBe(questions.length);
  });
});

// ─── NSP Edge Cases ──────────────────────────────────────────────────────────

describe('NSP (Ne Sait Pas) Edge Cases', () => {
  const questions = buildMathsQuestions();

  it('should treat NSP answers as 0 points without penalization', () => {
    // Arrange: mix of correct and NSP
    const answers: StudentAnswer[] = [
      { questionId: 'A1', status: 'correct' },
      { questionId: 'A2', status: 'nsp' },
      { questionId: 'A3', status: 'nsp' },
      { questionId: 'B1', status: 'nsp' },
      { questionId: 'B2', status: 'nsp' },
      { questionId: 'B3', status: 'nsp' },
      { questionId: 'P1', status: 'nsp' },
      { questionId: 'P2', status: 'nsp' },
    ];

    // Act
    const result = computeStageScore(answers, questions);

    // Assert: score should be > 0 (not penalized for NSP)
    expect(result.globalScore).toBeGreaterThan(0);
    expect(result.totalNSP).toBe(7);
    expect(result.totalAttempted).toBe(1);
  });

  it('should count NSP in coverage but not in score', () => {
    // Arrange
    const answers = allNSPAnswers(questions);

    // Act
    const result = computeStageScore(answers, questions);

    // Assert
    expect(result.totalNSP).toBe(questions.length);
    expect(result.totalAttempted).toBe(0);
    expect(result.confidenceIndex).toBe(0);
    expect(result.globalScore).toBe(0);
  });

  it('should return score=0 when all answers are NSP', () => {
    // Arrange
    const answers = allNSPAnswers(questions);

    // Act
    const result = computeStageScore(answers, questions);

    // Assert
    expect(result.globalScore).toBe(0);
    expect(result.precisionIndex).toBe(0);
    expect(result.totalNSP).toBe(8);
  });
});

// ─── Empty / Unknown Inputs ──────────────────────────────────────────────────

describe('Empty and Unknown Inputs', () => {
  const questions = buildMathsQuestions();

  it('should handle empty answers array gracefully', () => {
    // Arrange / Act
    const result = computeStageScore([], questions);

    // Assert: all NSP (no answers = treated as NSP)
    expect(result.globalScore).toBe(0);
    expect(result.totalNSP).toBe(questions.length);
    expect(result.totalAttempted).toBe(0);
    expect(result.totalQuestions).toBe(questions.length);
  });

  it('should handle empty questions array gracefully', () => {
    // Arrange / Act
    const result = computeStageScore([], []);

    // Assert
    expect(result.globalScore).toBe(0);
    expect(result.confidenceIndex).toBe(0);
    expect(result.totalQuestions).toBe(0);
    expect(result.categoryScores).toHaveLength(0);
    expect(result.radarData).toHaveLength(0);
  });

  it('should handle answers with unknown questionIds', () => {
    // Arrange
    const answers: StudentAnswer[] = [
      { questionId: 'UNKNOWN_1', status: 'correct' },
      { questionId: 'UNKNOWN_2', status: 'incorrect' },
    ];

    // Act: should not crash
    const result = computeStageScore(answers, questions);

    // Assert: unknown answers are simply ignored
    expect(result.totalQuestions).toBe(questions.length);
    expect(result.totalNSP).toBe(questions.length); // all questions unanswered
  });
});

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('Determinism', () => {
  const questions = buildMathsQuestions();

  it('should produce consistent results with same inputs (deterministic)', () => {
    // Arrange
    const answers: StudentAnswer[] = [
      { questionId: 'A1', status: 'correct' },
      { questionId: 'A2', status: 'incorrect' },
      { questionId: 'A3', status: 'nsp' },
      { questionId: 'B1', status: 'correct' },
      { questionId: 'B2', status: 'correct' },
      { questionId: 'B3', status: 'incorrect' },
      { questionId: 'P1', status: 'nsp' },
      { questionId: 'P2', status: 'correct' },
    ];

    // Act
    const result1 = computeStageScore(answers, questions);
    const result2 = computeStageScore(answers, questions);

    // Assert: all numeric fields must be identical
    expect(result1.globalScore).toBe(result2.globalScore);
    expect(result1.confidenceIndex).toBe(result2.confidenceIndex);
    expect(result1.precisionIndex).toBe(result2.precisionIndex);
    expect(result1.totalCorrect).toBe(result2.totalCorrect);
    expect(result1.totalNSP).toBe(result2.totalNSP);
    expect(result1.strengths).toEqual(result2.strengths);
    expect(result1.weaknesses).toEqual(result2.weaknesses);
    expect(result1.categoryScores.length).toBe(result2.categoryScores.length);
  });
});

// ─── Domain Separation (Maths vs NSI) ────────────────────────────────────────

describe('Domain Separation (Maths vs NSI)', () => {
  it('should separate Maths score from NSI score correctly', () => {
    // Arrange
    const allQuestions = [...buildMathsQuestions(), ...buildNSIQuestions()];
    // All Maths correct, all NSI incorrect
    const answers: StudentAnswer[] = [
      ...buildMathsQuestions().map((q) => ({ questionId: q.id, status: 'correct' as const })),
      ...buildNSIQuestions().map((q) => ({ questionId: q.id, status: 'incorrect' as const })),
    ];

    // Act
    const result = computeStageScore(answers, allQuestions);

    // Assert: Maths categories should be strengths, NSI should be weaknesses
    const mathsCategories = result.categoryScores.filter((c) => c.subject === 'MATHS');
    const nsiCategories = result.categoryScores.filter((c) => c.subject === 'NSI');

    mathsCategories.forEach((c) => {
      expect(c.precision).toBe(100);
    });
    nsiCategories.forEach((c) => {
      expect(c.precision).toBe(0);
    });
  });

  it('should compute global score as weighted average of domain scores', () => {
    // Arrange: all correct
    const allQuestions = [...buildMathsQuestions(), ...buildNSIQuestions()];
    const answers = allCorrectAnswers(allQuestions);

    // Act
    const result = computeStageScore(answers, allQuestions);

    // Assert
    expect(result.globalScore).toBe(100);
    expect(result.radarData.length).toBe(6); // 3 Maths + 3 NSI categories
  });

  it('should include nsiErrors only when NSI questions are present', () => {
    // Arrange: Maths only
    const mathsOnly = buildMathsQuestions();
    const answers = allCorrectAnswers(mathsOnly);

    // Act
    const result = computeStageScore(answers, mathsOnly);

    // Assert
    expect(result.nsiErrors).toBeNull();
  });

  it('should include nsiErrors when NSI questions are present', () => {
    // Arrange
    const allQuestions = [...buildMathsQuestions(), ...buildNSIQuestions()];
    const answers = allCorrectAnswers(allQuestions);

    // Act
    const result = computeStageScore(answers, allQuestions);

    // Assert
    expect(result.nsiErrors).not.toBeNull();
    expect(result.nsiErrors!.totalErrors).toBe(0);
  });
});

// ─── Confidence Thresholds ───────────────────────────────────────────────────

describe('Confidence and Precision Thresholds', () => {
  const questions = buildMathsQuestions();

  it('should have confidenceIndex=100 when all questions attempted', () => {
    // Arrange
    const answers = allCorrectAnswers(questions);

    // Act
    const result = computeStageScore(answers, questions);

    // Assert
    expect(result.confidenceIndex).toBe(100);
  });

  it('should have confidenceIndex=50 when half questions attempted', () => {
    // Arrange: 4 answered, 4 NSP
    const answers: StudentAnswer[] = [
      { questionId: 'A1', status: 'correct' },
      { questionId: 'A2', status: 'correct' },
      { questionId: 'A3', status: 'correct' },
      { questionId: 'B1', status: 'correct' },
      { questionId: 'B2', status: 'nsp' },
      { questionId: 'B3', status: 'nsp' },
      { questionId: 'P1', status: 'nsp' },
      { questionId: 'P2', status: 'nsp' },
    ];

    // Act
    const result = computeStageScore(answers, questions);

    // Assert
    expect(result.confidenceIndex).toBe(50);
    expect(result.precisionIndex).toBe(100); // all attempted are correct
  });

  it('should have precisionIndex=0 when all attempted answers are incorrect', () => {
    // Arrange
    const answers = allIncorrectAnswers(questions);

    // Act
    const result = computeStageScore(answers, questions);

    // Assert
    expect(result.precisionIndex).toBe(0);
    expect(result.confidenceIndex).toBe(100); // all attempted
  });
});

// ─── Diagnostic Text Generation ──────────────────────────────────────────────

describe('Diagnostic Text Generation', () => {
  const questions = buildMathsQuestions();

  it('should include "niveau solide" for globalScore >= 75', () => {
    // Arrange: all correct
    const answers = allCorrectAnswers(questions);

    // Act
    const result = computeStageScore(answers, questions);

    // Assert
    expect(result.diagnosticText).toContain('niveau solide');
  });

  it('should include "lacunes significatives" for globalScore < 50', () => {
    // Arrange: all incorrect
    const answers = allIncorrectAnswers(questions);

    // Act
    const result = computeStageScore(answers, questions);

    // Assert
    expect(result.diagnosticText).toContain('lacunes significatives');
  });

  it('should include "intermédiaire" for globalScore between 50 and 74', () => {
    // Arrange: mix to get ~60%
    const answers: StudentAnswer[] = [
      { questionId: 'A1', status: 'correct' },
      { questionId: 'A2', status: 'correct' },
      { questionId: 'A3', status: 'correct' }, // 6/6 for Analyse
      { questionId: 'B1', status: 'incorrect' },
      { questionId: 'B2', status: 'incorrect' },
      { questionId: 'B3', status: 'incorrect' }, // 0/6 for Algèbre
      { questionId: 'P1', status: 'correct' },
      { questionId: 'P2', status: 'correct' }, // 3/3 for Probabilités
    ];

    // Act
    const result = computeStageScore(answers, questions);

    // Assert: globalScore = (6+0+3)/15 * 100 = 60
    expect(result.globalScore).toBe(60);
    expect(result.diagnosticText).toContain('intermédiaire');
  });

  it('should mention strengths in diagnostic text when present', () => {
    // Arrange: all correct
    const answers = allCorrectAnswers(questions);

    // Act
    const result = computeStageScore(answers, questions);

    // Assert
    expect(result.diagnosticText).toContain('Points forts');
    expect(result.strengths.length).toBeGreaterThan(0);
  });

  it('should mention weaknesses in diagnostic text when present', () => {
    // Arrange: all incorrect
    const answers = allIncorrectAnswers(questions);

    // Act
    const result = computeStageScore(answers, questions);

    // Assert
    expect(result.diagnosticText).toContain('Points faibles');
    expect(result.weaknesses.length).toBeGreaterThan(0);
  });

  it('should mention low confidence in diagnostic text', () => {
    // Arrange: mostly NSP
    const answers: StudentAnswer[] = [
      { questionId: 'A1', status: 'correct' },
      { questionId: 'A2', status: 'nsp' },
      { questionId: 'A3', status: 'nsp' },
      { questionId: 'B1', status: 'nsp' },
      { questionId: 'B2', status: 'nsp' },
      { questionId: 'B3', status: 'nsp' },
      { questionId: 'P1', status: 'nsp' },
      { questionId: 'P2', status: 'nsp' },
    ];

    // Act
    const result = computeStageScore(answers, questions);

    // Assert
    expect(result.confidenceIndex).toBeLessThan(50);
    expect(result.diagnosticText).toContain('confiance faible');
  });
});

// ─── generateLucidityText — Extended ─────────────────────────────────────────

describe('generateLucidityText — Extended', () => {
  it('should return intermediate text for medium confidence (40-60) and medium precision', () => {
    // Arrange / Act
    const text = generateLucidityText(55, 55);

    // Assert
    expect(text).toContain('zones d\'incertitude');
  });

  it('should return default text for high confidence and medium precision', () => {
    // Arrange / Act
    const text = generateLucidityText(80, 60);

    // Assert: falls into the default case
    expect(text).toContain('Profil intermédiaire');
  });
});

// ─── computeCategoryTag — Extended ───────────────────────────────────────────

describe('computeCategoryTag — Extended Edge Cases', () => {
  it('should return "Bases Fragiles" even with high precision (flag overrides)', () => {
    // Arrange / Act / Assert
    expect(computeCategoryTag(90, 90, 5, true)).toBe('Bases Fragiles');
  });

  it('should prioritize "À découvrir" over "Maîtrisé" when NSP > 60%', () => {
    // Arrange / Act / Assert
    expect(computeCategoryTag(100, 100, 65, false)).toBe('À découvrir');
  });

  it('should return "Confusions" for low precision and medium confidence', () => {
    // Arrange / Act / Assert: precision=35, confidence=50, nsp=20
    expect(computeCategoryTag(35, 50, 20, false)).toBe('Confusions');
  });

  it('should return "Confusions" for edge case: precision=30, confidence=31', () => {
    // Arrange / Act / Assert: precision exactly at boundary
    expect(computeCategoryTag(30, 31, 20, false)).toBe('Confusions');
  });
});

// ─── Bases Fragiles — Extended ───────────────────────────────────────────────

describe('detectBasesFragiles — Extended', () => {
  it('should not flag when both basics and experts fail', () => {
    // Arrange
    const questions = buildMathsQuestions();
    const answers: StudentAnswer[] = [
      { questionId: 'A1', status: 'incorrect' }, // weight=1 FAIL
      { questionId: 'A2', status: 'incorrect' }, // weight=2 FAIL
      { questionId: 'A3', status: 'incorrect' }, // weight=3 FAIL
    ];

    // Act
    const result = detectBasesFragiles(answers, questions, 'Analyse');

    // Assert
    expect(result).toBeNull();
  });

  it('should not flag when basics pass and experts fail', () => {
    // Arrange
    const questions = buildMathsQuestions();
    const answers: StudentAnswer[] = [
      { questionId: 'A1', status: 'correct' },   // weight=1 PASS
      { questionId: 'A2', status: 'correct' },    // weight=2 PASS
      { questionId: 'A3', status: 'incorrect' },  // weight=3 FAIL
    ];

    // Act
    const result = detectBasesFragiles(answers, questions, 'Analyse');

    // Assert
    expect(result).toBeNull();
  });

  it('should include descriptive message in flag', () => {
    // Arrange
    const questions = buildMathsQuestions();
    const answers: StudentAnswer[] = [
      { questionId: 'A1', status: 'incorrect' }, // weight=1 FAIL
      { questionId: 'A2', status: 'correct' },
      { questionId: 'A3', status: 'correct' },   // weight=3 PASS
    ];

    // Act
    const result = detectBasesFragiles(answers, questions, 'Analyse');

    // Assert
    expect(result).not.toBeNull();
    expect(result!.message).toContain('Analyse');
    expect(result!.message).toContain('automatismes à consolider');
  });
});

// ─── Full Integration: Bases Fragiles in computeStageScore ───────────────────

describe('computeStageScore — Bases Fragiles Integration', () => {
  it('should include basesFragiles flags in full scoring result', () => {
    // Arrange: fail basics, pass experts in Analyse
    const questions = buildMathsQuestions();
    const answers: StudentAnswer[] = [
      { questionId: 'A1', status: 'incorrect' }, // weight=1 FAIL
      { questionId: 'A2', status: 'correct' },
      { questionId: 'A3', status: 'correct' },   // weight=3 PASS
      { questionId: 'B1', status: 'correct' },
      { questionId: 'B2', status: 'correct' },
      { questionId: 'B3', status: 'correct' },
      { questionId: 'P1', status: 'correct' },
      { questionId: 'P2', status: 'correct' },
    ];

    // Act
    const result = computeStageScore(answers, questions);

    // Assert
    expect(result.basesFragiles.length).toBeGreaterThanOrEqual(1);
    expect(result.basesFragiles[0].category).toBe('Analyse');
    expect(result.diagnosticText).toContain('Attention');
  });
});
