import 'server-only';

import { CANDIDATE_DIAGNOSTIC_ANSWER_KEYS } from './answer-key.server';
import { getPublicModuleDefinition } from './definition.public';
import type {
  DiagnosticAnswer,
  DiagnosticAutoScore,
  DiagnosticQuestion,
  QuestionScoreEvidence,
} from './types';

function asString(value: DiagnosticAnswer['value']): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: DiagnosticAnswer['value']): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: DiagnosticAnswer['value']): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asStringArray(value: DiagnosticAnswer['value']): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function scoreQuestion(question: DiagnosticQuestion, answer?: DiagnosticAnswer): QuestionScoreEvidence {
  const key = CANDIDATE_DIAGNOSTIC_ANSWER_KEYS[question.id];
  const base = {
    questionId: question.id,
    maxPoints: question.maxPoints,
    domains: question.domains,
    competencies: question.competencies,
    confidence: answer?.confidence,
  };

  if (answer?.status === 'NOT_STUDIED') {
    return { ...base, points: 0, status: 'NOT_STUDIED' };
  }

  if (!answer || answer.status === 'SKIPPED' || answer.value === null || answer.value === '') {
    return { ...base, points: 0, status: question.manualReview ? 'MANUAL_REVIEW' : 'INCORRECT' };
  }

  if (!key || key.kind === 'manual') {
    return { ...base, points: 0, status: 'MANUAL_REVIEW' };
  }

  if (key.kind === 'neutral') {
    return { ...base, points: 0, status: question.manualReview ? 'MANUAL_REVIEW' : 'CORRECT' };
  }

  if (key.kind === 'single') {
    const correct = asString(answer.value) === key.correct;
    return { ...base, points: correct ? question.maxPoints : 0, status: correct ? 'CORRECT' : 'INCORRECT' };
  }

  if (key.kind === 'multiple') {
    const selected = new Set(asStringArray(answer.value) ?? []);
    const expected = new Set(key.correct);
    const truePositives = [...selected].filter((item) => expected.has(item)).length;
    const falsePositives = [...selected].filter((item) => !expected.has(item)).length;
    const exact = truePositives === expected.size && falsePositives === 0;
    if (exact) return { ...base, points: question.maxPoints, status: 'CORRECT' };
    if (key.partial && truePositives > 0) {
      const ratio = clamp((truePositives - falsePositives) / expected.size, 0, 1);
      const points = Math.round(question.maxPoints * ratio * 100) / 100;
      return { ...base, points, status: points > 0 ? 'PARTIAL' : 'INCORRECT' };
    }
    return { ...base, points: 0, status: 'INCORRECT' };
  }

  if (key.kind === 'numeric') {
    const numeric = asNumber(answer.value);
    const correct = numeric !== null && Math.abs(numeric - key.value) <= key.tolerance;
    return { ...base, points: correct ? question.maxPoints : 0, status: correct ? 'CORRECT' : 'INCORRECT' };
  }

  if (key.kind === 'ack') {
    const correct = asBoolean(answer.value) === key.expected;
    return { ...base, points: correct ? question.maxPoints : 0, status: correct ? 'CORRECT' : 'INCORRECT' };
  }

  const scaleValue = asNumber(answer.value);
  if (scaleValue === null) return { ...base, points: 0, status: 'INCORRECT' };
  const normalized = (scaleValue - key.min) / Math.max(1, key.max - key.min);
  const directed = key.direction === 1 ? normalized : 1 - normalized;
  const points = Math.round(clamp(directed, 0, 1) * question.maxPoints * 100) / 100;
  return {
    ...base,
    points,
    status: points >= question.maxPoints * 0.8 ? 'CORRECT' : points > 0 ? 'PARTIAL' : 'INCORRECT',
  };
}

export function scoreDiagnosticModule(
  moduleKey: string,
  answers: Record<string, DiagnosticAnswer>,
): DiagnosticAutoScore {
  const definition = getPublicModuleDefinition(moduleKey);
  if (!definition) throw new Error(`Unknown diagnostic module: ${moduleKey}`);

  const evidence = definition.questions.map((question) => scoreQuestion(question, answers[question.id]));
  const scorable = evidence.filter((item) => item.maxPoints > 0 && item.status !== 'MANUAL_REVIEW');
  const covered = scorable.filter((item) => item.status !== 'NOT_STUDIED');
  const points = covered.reduce((sum, item) => sum + item.points, 0);
  const maxPoints = covered.reduce((sum, item) => sum + item.maxPoints, 0);
  const potentialMaxPoints = scorable.reduce((sum, item) => sum + item.maxPoints, 0);

  const domainScores: DiagnosticAutoScore['domainScores'] = {};
  for (const item of covered) {
    for (const domain of item.domains) {
      domainScores[domain] ??= { points: 0, maxPoints: 0, percentage: null };
      domainScores[domain].points += item.points;
      domainScores[domain].maxPoints += item.maxPoints;
    }
  }
  for (const value of Object.values(domainScores)) {
    value.points = Math.round(value.points * 100) / 100;
    value.maxPoints = Math.round(value.maxPoints * 100) / 100;
    value.percentage = value.maxPoints > 0 ? Math.round((value.points / value.maxPoints) * 10_000) / 100 : null;
  }

  const confidenceAnswered = evidence.filter((item) => typeof item.confidence === 'number' && item.status !== 'MANUAL_REVIEW');
  const overconfidenceCount = confidenceAnswered.filter(
    (item) => (item.confidence ?? 0) >= 2 && (item.status === 'INCORRECT' || item.status === 'NOT_STUDIED'),
  ).length;
  const underconfidenceCount = confidenceAnswered.filter(
    (item) => (item.confidence ?? 0) <= 1 && item.status === 'CORRECT',
  ).length;

  return {
    points: Math.round(points * 100) / 100,
    maxPoints: Math.round(maxPoints * 100) / 100,
    percentage: maxPoints > 0 ? Math.round((points / maxPoints) * 10_000) / 100 : null,
    coveragePercentage: potentialMaxPoints > 0 ? Math.round((maxPoints / potentialMaxPoints) * 10_000) / 100 : 100,
    domainScores,
    evidence,
    manualReviewQuestionIds: evidence.filter((item) => item.status === 'MANUAL_REVIEW').map((item) => item.questionId),
    confidenceCalibration: {
      answeredWithConfidence: confidenceAnswered.length,
      overconfidenceCount,
      underconfidenceCount,
    },
  };
}

export function validateRequiredAnswers(
  moduleKey: string,
  answers: Record<string, DiagnosticAnswer>,
): { valid: boolean; missingQuestionIds: string[] } {
  const definition = getPublicModuleDefinition(moduleKey);
  if (!definition) throw new Error(`Unknown diagnostic module: ${moduleKey}`);
  const missingQuestionIds = definition.questions
    .filter((question) => question.required !== false && question.type !== 'information')
    .filter((question) => {
      const answer = answers[question.id];
      if (question.type === 'upload') return false; // Validated against persisted documents by the API route.
      return !answer || answer.status === 'SKIPPED' || answer.value === null || answer.value === '';
    })
    .map((question) => question.id);
  return { valid: missingQuestionIds.length === 0, missingQuestionIds };
}
