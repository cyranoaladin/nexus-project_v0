import { lamisExercises } from '@/src/data/lamisExercises';
import {
  buildPedagogicalReport,
  computeProgressSummary,
  isAnswerCorrect,
  isTooFast,
  recordAttempt,
} from '@/lib/lamis/progress';
import type { LamisAttempt } from '@/lib/lamis/types';

describe('Lamis mission logic', () => {
  test('provides the requested exercise volume by day and theme', () => {
    expect(lamisExercises.length).toBeGreaterThanOrEqual(128);
    expect(lamisExercises.filter((exercise) => exercise.day === 1)).toHaveLength(65);
    expect(lamisExercises.filter((exercise) => exercise.day === 2)).toHaveLength(63);
    expect(lamisExercises.filter((exercise) => exercise.block.includes('Pourcentages'))).toHaveLength(20);
    expect(lamisExercises.filter((exercise) => exercise.block.includes('Suites'))).toHaveLength(15);
  });

  test('accepts numeric answers with comma decimal and tolerance', () => {
    const exercise = lamisExercises.find((item) => item.id === 'pct-coef-baisse-25')!;
    expect(isAnswerCorrect(exercise, '0,75')).toBe(true);
    expect(isAnswerCorrect(exercise, '0.7501')).toBe(true);
    expect(isAnswerCorrect(exercise, '0,8')).toBe(false);
  });

  test('accepts text answers regardless of case and simple spacing', () => {
    const exercise = lamisExercises.find((item) => item.id === 'suite-geo-1000-900')!;
    expect(isAnswerCorrect(exercise, '729 geometrie q=0,9')).toBe(true);
    expect(isAnswerCorrect(exercise, '729 ; géométrique ; q = 0,9')).toBe(true);
    expect(isAnswerCorrect(exercise, '730 arithmetique r=5')).toBe(false);
  });

  test('detects fast answers using the exercise expected time', () => {
    const simple = lamisExercises.find((item) => item.id === 'mental-10p-250')!;
    const justification = lamisExercises.find((item) => item.type === 'justification')!;
    expect(isTooFast(simple, 3)).toBe(true);
    expect(isTooFast(simple, 4)).toBe(false);
    expect(isTooFast(justification, 14)).toBe(true);
    expect(isTooFast(justification, 15)).toBe(false);
  });

  test('records scoring, retries, corrections and questions to redo', () => {
    const first = lamisExercises.find((item) => item.id === 'pct-hausse-200-10')!;
    const failed = lamisExercises.find((item) => item.id === 'eq-2x-6')!;
    const attempts: LamisAttempt[] = [];
    attempts.push(recordAttempt(first, '220', 1, 9, false, false, false));
    attempts.push(recordAttempt(failed, '2', 1, 11, true, false, false));
    attempts.push(recordAttempt(failed, '3', 2, 10, true, true, true));

    const summary = computeProgressSummary(lamisExercises, attempts);
    expect(summary.totalScore).toBe(18);
    expect(summary.answeredExerciseIds).toContain(first.id);
    expect(summary.redoExerciseIds).toContain(failed.id);
    expect(summary.helpCount).toBe(2);
    expect(summary.correctionCount).toBe(1);
    expect(summary.badges).toContain('Chasseuse de points faciles');
    expect(summary.badges).toContain('Je corrige mes erreurs');
  });

  test('builds an actionable teacher report from attempts', () => {
    const pct = lamisExercises.find((item) => item.id === 'pct-coef-hausse-30')!;
    const suite = lamisExercises.find((item) => item.id === 'suite-geo-1000-900')!;
    const attempts = [
      recordAttempt(pct, '1,3', 1, 10, false, false, false),
      recordAttempt(suite, '900 arithmetique r=100', 1, 5, true, true, true),
    ];

    const report = buildPedagogicalReport(lamisExercises, attempts);
    expect(report).toContain('Lamis');
    expect(report).toContain('Pourcentages');
    expect(report).toContain('répondu très vite');
    expect(report).toContain('recommandation');
  });
});
