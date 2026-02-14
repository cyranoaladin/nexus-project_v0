/**
 * Unit tests for Scoring Engine V3 (scoring-engine.ts)
 *
 * Tests: computeStageScore, computeCategoryTag, detectBasesFragiles,
 *        computeNSIErrors, generateLucidityText
 */

import {
  computeStageScore,
  computeCategoryTag,
  detectBasesFragiles,
  computeNSIErrors,
  generateLucidityText,
  type QuestionMetadata,
  type StudentAnswer,
} from '@/lib/scoring-engine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMathsQuestions(): QuestionMetadata[] {
  return [
    // Analyse (3 questions: weight 1, 2, 3)
    { id: 'A1', subject: 'MATHS', category: 'Analyse', competence: 'Restituer', weight: 1, label: 'Dérivée de x²' },
    { id: 'A2', subject: 'MATHS', category: 'Analyse', competence: 'Appliquer', weight: 2, label: 'Tableau de variation' },
    { id: 'A3', subject: 'MATHS', category: 'Analyse', competence: 'Raisonner', weight: 3, label: 'Théorème des valeurs intermédiaires' },
    // Algèbre (3 questions)
    { id: 'B1', subject: 'MATHS', category: 'Algèbre', competence: 'Restituer', weight: 1, label: 'Résolution équation 1er degré' },
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

// ─── computeCategoryTag ──────────────────────────────────────────────────────

describe('computeCategoryTag', () => {
  it('should return "Maîtrisé" for high precision + high confidence', () => {
    expect(computeCategoryTag(85, 70, 10, false)).toBe('Maîtrisé');
  });

  it('should return "En progression" for medium precision + medium confidence', () => {
    expect(computeCategoryTag(55, 50, 20, false)).toBe('En progression');
  });

  it('should return "Confusions" for low precision + high confidence', () => {
    expect(computeCategoryTag(40, 80, 10, false)).toBe('Confusions');
  });

  it('should return "Notion non abordée" for high NSP rate (>40%)', () => {
    expect(computeCategoryTag(80, 30, 50, false)).toBe('Notion non abordée');
  });

  it('should return "À découvrir" for very high NSP rate (>60%)', () => {
    expect(computeCategoryTag(100, 20, 70, false)).toBe('À découvrir');
  });

  it('should return "Bases Fragiles" when flag is set', () => {
    expect(computeCategoryTag(60, 80, 10, true)).toBe('Bases Fragiles');
  });

  it('should return "Insuffisant" for very low precision', () => {
    expect(computeCategoryTag(20, 80, 10, false)).toBe('Insuffisant');
  });
});

// ─── detectBasesFragiles ─────────────────────────────────────────────────────

describe('detectBasesFragiles', () => {
  const questions = buildMathsQuestions();

  it('should detect "Bases Fragiles" when basics fail but experts pass', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'A1', status: 'incorrect' }, // weight=1 FAIL
      { questionId: 'A2', status: 'correct' },   // weight=2 OK
      { questionId: 'A3', status: 'correct' },   // weight=3 OK
    ];

    const result = detectBasesFragiles(answers, questions, 'Analyse');
    expect(result).not.toBeNull();
    expect(result!.category).toBe('Analyse');
    expect(result!.basicsFailed).toBe(1);
    expect(result!.expertPassed).toBe(1);
  });

  it('should NOT detect "Bases Fragiles" when basics pass', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'A1', status: 'correct' },
      { questionId: 'A2', status: 'correct' },
      { questionId: 'A3', status: 'incorrect' },
    ];

    const result = detectBasesFragiles(answers, questions, 'Analyse');
    expect(result).toBeNull();
  });

  it('should return null for categories without weight=1 or weight=3', () => {
    const limitedQuestions: QuestionMetadata[] = [
      { id: 'X1', subject: 'MATHS', category: 'Test', competence: 'Appliquer', weight: 2, label: 'Test' },
    ];
    const result = detectBasesFragiles([], limitedQuestions, 'Test');
    expect(result).toBeNull();
  });
});

// ─── computeNSIErrors ────────────────────────────────────────────────────────

describe('computeNSIErrors', () => {
  const questions = buildNSIQuestions();

  it('should count syntax vs logic vs conceptual errors', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'N1', status: 'incorrect' }, // syntax
      { questionId: 'N2', status: 'incorrect' }, // logic
      { questionId: 'N3', status: 'correct' },
      { questionId: 'N4', status: 'incorrect' }, // conceptual
    ];

    const result = computeNSIErrors(answers, questions);
    expect(result.syntaxErrors).toBe(1);
    expect(result.logicErrors).toBe(1);
    expect(result.conceptualErrors).toBe(1);
    expect(result.totalErrors).toBe(3);
  });

  it('should return zeros when all correct', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'N1', status: 'correct' },
      { questionId: 'N2', status: 'correct' },
      { questionId: 'N3', status: 'correct' },
      { questionId: 'N4', status: 'correct' },
    ];

    const result = computeNSIErrors(answers, questions);
    expect(result.totalErrors).toBe(0);
  });

  it('should not count NSP as errors', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'N1', status: 'nsp' },
      { questionId: 'N2', status: 'nsp' },
      { questionId: 'N3', status: 'nsp' },
      { questionId: 'N4', status: 'nsp' },
    ];

    const result = computeNSIErrors(answers, questions);
    expect(result.totalErrors).toBe(0);
  });
});

// ─── generateLucidityText ────────────────────────────────────────────────────

describe('generateLucidityText', () => {
  it('should praise high confidence + high precision', () => {
    const text = generateLucidityText(85, 75);
    expect(text).toContain('assurance');
    expect(text).toContain('maîtrise');
  });

  it('should flag false representations for high confidence + low precision', () => {
    const text = generateLucidityText(85, 40);
    expect(text).toContain('fausses représentations');
  });

  it('should praise lucidity for low confidence + high precision', () => {
    const text = generateLucidityText(30, 80);
    expect(text).toContain('lucidité');
  });

  it('should flag priority support for low confidence + low precision', () => {
    const text = generateLucidityText(30, 40);
    expect(text).toContain('accompagnement prioritaire');
  });
});

// ─── computeStageScore (integration) ─────────────────────────────────────────

describe('computeStageScore', () => {
  const mathsQuestions = buildMathsQuestions();

  it('should compute a perfect score for all correct answers', () => {
    const answers: StudentAnswer[] = mathsQuestions.map((q) => ({
      questionId: q.id,
      status: 'correct' as const,
    }));

    const result = computeStageScore(answers, mathsQuestions);

    expect(result.globalScore).toBe(100);
    expect(result.confidenceIndex).toBe(100);
    expect(result.precisionIndex).toBe(100);
    expect(result.totalCorrect).toBe(8);
    expect(result.totalNSP).toBe(0);
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(result.weaknesses.length).toBe(0);
  });

  it('should compute zero score for all NSP answers', () => {
    const answers: StudentAnswer[] = mathsQuestions.map((q) => ({
      questionId: q.id,
      status: 'nsp' as const,
    }));

    const result = computeStageScore(answers, mathsQuestions);

    expect(result.globalScore).toBe(0);
    expect(result.confidenceIndex).toBe(0);
    expect(result.totalNSP).toBe(8);
    expect(result.totalAttempted).toBe(0);
    // NSP should NOT be penalized — score is 0, not negative
    expect(result.globalScore).toBeGreaterThanOrEqual(0);
  });

  it('should distinguish NSP from errors in confidence vs precision', () => {
    // 4 correct, 4 NSP → confidence 50%, precision 100%
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

    const result = computeStageScore(answers, mathsQuestions);

    expect(result.confidenceIndex).toBe(50); // 4/8 attempted
    expect(result.precisionIndex).toBe(100); // 4/4 correct among attempted
    expect(result.totalNSP).toBe(4);
    expect(result.totalCorrect).toBe(4);
    expect(result.lucidityText).toContain('lucidité');
  });

  it('should flag errors as confusions, not NSP', () => {
    // All attempted, 2 correct, 6 incorrect
    const answers: StudentAnswer[] = mathsQuestions.map((q, i) => ({
      questionId: q.id,
      status: i < 2 ? 'correct' as const : 'incorrect' as const,
    }));

    const result = computeStageScore(answers, mathsQuestions);

    expect(result.confidenceIndex).toBe(100); // All attempted
    expect(result.precisionIndex).toBe(25);   // 2/8
    expect(result.totalNSP).toBe(0);
    expect(result.weaknesses.length).toBeGreaterThan(0);
  });

  it('should generate radarData for each category', () => {
    const answers: StudentAnswer[] = mathsQuestions.map((q) => ({
      questionId: q.id,
      status: 'correct' as const,
    }));

    const result = computeStageScore(answers, mathsQuestions);

    expect(result.radarData.length).toBe(3); // Analyse, Algèbre, Probabilités
    expect(result.radarData.every((r: { score: number }) => r.score >= 0 && r.score <= 100)).toBe(true);
  });

  it('should handle mixed Maths + NSI questions', () => {
    const allQuestions = [...buildMathsQuestions(), ...buildNSIQuestions()];
    const answers: StudentAnswer[] = allQuestions.map((q) => ({
      questionId: q.id,
      status: 'correct' as const,
    }));

    const result = computeStageScore(answers, allQuestions);

    expect(result.globalScore).toBe(100);
    expect(result.nsiErrors).not.toBeNull();
    expect(result.nsiErrors!.totalErrors).toBe(0);
    expect(result.radarData.length).toBe(6); // 3 maths + 3 NSI categories
  });

  it('should detect NSI error types correctly', () => {
    const nsiQuestions = buildNSIQuestions();
    const answers: StudentAnswer[] = [
      { questionId: 'N1', status: 'incorrect' }, // syntax error
      { questionId: 'N2', status: 'incorrect' }, // logic error
      { questionId: 'N3', status: 'correct' },
      { questionId: 'N4', status: 'nsp' },
    ];

    const result = computeStageScore(answers, nsiQuestions);

    expect(result.nsiErrors).not.toBeNull();
    expect(result.nsiErrors!.syntaxErrors).toBe(1);
    expect(result.nsiErrors!.logicErrors).toBe(1);
    expect(result.nsiErrors!.conceptualErrors).toBe(0);
  });

  it('should include scoredAt timestamp', () => {
    const result = computeStageScore([], []);
    expect(result.scoredAt).toBeTruthy();
    expect(new Date(result.scoredAt).getTime()).toBeGreaterThan(0);
  });
});
