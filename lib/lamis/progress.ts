import type { LamisAttempt, LamisExercise, LamisProgressSummary } from "@/lib/lamis/types";

export const LAMIS_STORAGE_KEY = "nexus-lamis-mission-v1";

function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/,/g, ".")
    .replace(/[;:()]/g, " ")
    .replace(/\s*=\s*/g, "=")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value: string): number {
  return Number.parseFloat(normalizeAnswer(value).replace(/[^0-9.+-]/g, ""));
}

export function isAnswerCorrect(exercise: LamisExercise, answer: string): boolean {
  const normalized = normalizeAnswer(answer);
  if (!normalized) return false;

  if (exercise.type === "number") {
    const actual = toNumber(answer);
    return exercise.correctAnswers.some((expectedAnswer) => {
      const expected = toNumber(expectedAnswer);
      return Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= (exercise.tolerance ?? 0);
    });
  }

  if (exercise.type === "qcm") {
    return exercise.correctAnswers.some((expectedAnswer) => normalizeAnswer(expectedAnswer) === normalized);
  }

  return exercise.correctAnswers.some((expectedAnswer) => {
    const expected = normalizeAnswer(expectedAnswer);
    if (normalized === expected || normalized.includes(expected)) return true;
    const expectedTokens = expected.split(" ").filter(Boolean);
    return expectedTokens.every((token) => normalized.includes(token));
  });
}

export function isTooFast(exercise: LamisExercise, timeSpentSeconds: number): boolean {
  return timeSpentSeconds < exercise.expectedTimeSeconds;
}

export function recordAttempt(
  exercise: LamisExercise,
  answer: string,
  attemptNumber: number,
  timeSpentSeconds: number,
  usedHint1: boolean,
  usedHint2: boolean,
  viewedCorrection: boolean,
): LamisAttempt {
  return {
    exerciseId: exercise.id,
    answer,
    isCorrect: isAnswerCorrect(exercise, answer),
    attemptNumber,
    timeSpentSeconds,
    usedHint1,
    usedHint2,
    viewedCorrection,
    tooFast: isTooFast(exercise, timeSpentSeconds),
    timestamp: new Date().toISOString(),
  };
}

function attemptScore(attempt: LamisAttempt, exercise: LamisExercise): number {
  if (!attempt.isCorrect) {
    return attempt.viewedCorrection ? 4 : 0;
  }
  if (exercise.type === "justification") return 5;
  if (attempt.attemptNumber > 1) return 8;
  if (attempt.usedHint1 || attempt.usedHint2) return 6;
  return 10;
}

export function computeProgressSummary(exercises: LamisExercise[], attempts: LamisAttempt[]): LamisProgressSummary {
  const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const attemptsByExercise = attempts.reduce<Record<string, LamisAttempt[]>>((acc, attempt) => {
    acc[attempt.exerciseId] = [...(acc[attempt.exerciseId] ?? []), attempt];
    return acc;
  }, {});

  const answeredExerciseIds = Object.entries(attemptsByExercise)
    .filter(([, exerciseAttempts]) => exerciseAttempts.some((attempt) => attempt.isCorrect || attempt.viewedCorrection || attempt.attemptNumber >= 2))
    .map(([exerciseId]) => exerciseId);

  const redoExerciseIds = Object.entries(attemptsByExercise)
    .filter(([, exerciseAttempts]) => exerciseAttempts.some((attempt) => !attempt.isCorrect))
    .map(([exerciseId]) => exerciseId);

  const totalScore = attempts.reduce((sum, attempt) => {
    const exercise = exercisesById.get(attempt.exerciseId);
    return exercise ? sum + attemptScore(attempt, exercise) : sum;
  }, 0);

  const scoreByTheme = attempts.reduce<Record<string, number>>((acc, attempt) => {
    const exercise = exercisesById.get(attempt.exerciseId);
    if (!exercise) return acc;
    acc[exercise.theme] = (acc[exercise.theme] ?? 0) + attemptScore(attempt, exercise);
    return acc;
  }, {});

  const correctExerciseCount = new Set(attempts.filter((attempt) => attempt.isCorrect).map((attempt) => attempt.exerciseId)).size;
  const helpCount = Object.values(attemptsByExercise).reduce((sum, exerciseAttempts) => {
    const usedHint1 = exerciseAttempts.some((attempt) => attempt.usedHint1);
    const usedHint2 = exerciseAttempts.some((attempt) => attempt.usedHint2);
    return sum + Number(usedHint1) + Number(usedHint2);
  }, 0);
  const badges: string[] = [];
  if (attempts.some((attempt) => attempt.isCorrect && attempt.attemptNumber === 1)) badges.push("Chasseuse de points faciles");
  if (attempts.some((attempt) => attempt.isCorrect && exercisesById.get(attempt.exerciseId)?.theme.includes("Coefficient"))) badges.push("Reine du coefficient");
  if (attempts.filter((attempt) => !attempt.tooFast).length >= 5) badges.push("Mode sérieux activé");
  if (attempts.some((attempt) => attempt.isCorrect && attempt.attemptNumber > 1)) badges.push("Je corrige mes erreurs");
  if (correctExerciseCount >= 10) badges.push("Mission validée");
  if (attempts.some((attempt) => attempt.isCorrect && exercisesById.get(attempt.exerciseId)?.theme === "Probabilités")) badges.push("Tableau maîtrisé");
  if (attempts.some((attempt) => attempt.isCorrect && exercisesById.get(attempt.exerciseId)?.theme === "Suites")) badges.push("Suites sous contrôle");

  return {
    totalScore,
    answeredExerciseIds,
    redoExerciseIds,
    fastAttempts: attempts.filter((attempt) => attempt.tooFast),
    helpCount,
    correctionCount: attempts.filter((attempt) => attempt.viewedCorrection).length,
    totalTimeSeconds: attempts.reduce((sum, attempt) => sum + attempt.timeSpentSeconds, 0),
    successRate: answeredExerciseIds.length ? Math.round((correctExerciseCount / answeredExerciseIds.length) * 100) : 0,
    scoreByTheme,
    attemptsByExercise,
    badges,
  };
}

export function buildPedagogicalReport(exercises: LamisExercise[], attempts: LamisAttempt[]): string {
  const summary = computeProgressSummary(exercises, attempts);
  const bestTheme = Object.entries(summary.scoreByTheme).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Pourcentages";
  const displayBestTheme = bestTheme === "Coefficient multiplicateur" ? "Pourcentages" : bestTheme;
  const fastCount = summary.fastAttempts.length;
  const redoThemes = Array.from(new Set(summary.redoExerciseIds.map((id) => exercises.find((exercise) => exercise.id === id)?.theme).filter(Boolean)));
  const weakText = redoThemes.length ? redoThemes.join(", ") : "les questions non encore traitées";

  return `Lamis réussit mieux les questions de ${displayBestTheme} lorsqu’elles sont directes. ${fastCount > 0 ? `Elle a répondu très vite à ${fastCount} question(s), ce qui doit être repris avec une trace écrite.` : "Le rythme de réponse est globalement exploitable."} Les points à reprendre sont : ${weakText}. recommandation : refaire les questions rouges avant de passer au bloc suivant, puis verbaliser le coefficient ou la raison choisie.`;
}

export function exportAttemptsCsv(exercises: LamisExercise[], attempts: LamisAttempt[]): string {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const rows = attempts.map((attempt) => {
    const exercise = byId.get(attempt.exerciseId);
    return [
      attempt.timestamp,
      attempt.exerciseId,
      exercise?.day ?? "",
      exercise?.theme ?? "",
      JSON.stringify(attempt.answer),
      attempt.isCorrect,
      attempt.attemptNumber,
      attempt.timeSpentSeconds,
      attempt.usedHint1,
      attempt.usedHint2,
      attempt.viewedCorrection,
      attempt.tooFast,
    ].join(",");
  });
  return ["timestamp,exerciseId,day,theme,answer,isCorrect,attemptNumber,timeSpentSeconds,usedHint1,usedHint2,viewedCorrection,tooFast", ...rows].join("\n");
}
