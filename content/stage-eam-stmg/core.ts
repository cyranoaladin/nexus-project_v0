import { DIAGNOSTIC_EXERCISES, DIAGNOSTIC_QCM } from "./diagnostic";
import { DOMAINS } from "./domains";
import { BASE_PLANNING } from "./planning";
import type { DiagnosticAnswers, DiagnosticProfile, DomainId, DomainScore, ExerciseEvaluation, PlanningDay } from "./types";

const exerciseWeights: Record<ExerciseEvaluation, number> = {
  acquired: 1,
  partial: 0.5,
  not_acquired: 0,
};

export function getDomainPriorities(scores: Record<DomainId, number>) {
  return [...DOMAINS]
    .sort((a, b) => scores[a.id] - scores[b.id])
    .map((domain) => ({ ...domain, score: scores[domain.id] }));
}

export function computeDiagnosticProfile(answers: DiagnosticAnswers, diagnosticDate = new Date().toISOString()): DiagnosticProfile {
  const domainScores: DomainScore[] = DOMAINS.map((domain) => {
    const domainQcm = DIAGNOSTIC_QCM.filter((item) => item.domainId === domain.id);
    const correct = domainQcm.filter((item) => answers.qcm[item.id] === item.answerIndex).length;
    const qcmScore = domainQcm.length > 0 ? (correct / domainQcm.length) * 100 : 0;

    const exerciseRubrics = DIAGNOSTIC_EXERCISES.flatMap((exercise) =>
      exercise.rubric.filter((rubric) => rubric.domainId === domain.id).map(() => answers.exercises[exercise.id])
    );
    const exerciseScore =
      exerciseRubrics.length > 0
        ? (exerciseRubrics.reduce((sum, value) => sum + exerciseWeights[value ?? "not_acquired"], 0) / exerciseRubrics.length) * 100
        : qcmScore;

    return {
      domainId: domain.id,
      qcmScore: Math.round(qcmScore),
      exerciseScore: Math.round(exerciseScore),
      score: Math.round(qcmScore * 0.6 + exerciseScore * 0.4),
    };
  });

  const scoreMap = Object.fromEntries(domainScores.map((entry) => [entry.domainId, entry.score])) as Record<DomainId, number>;

  return {
    diagnosticDate,
    domainScores,
    priorities: getDomainPriorities(scoreMap).map((domain) => domain.id),
  };
}

export function buildAdaptivePlanning(priorities: DomainId[]): PlanningDay[] {
  const uniquePriorities = priorities.filter((id, index) => priorities.indexOf(id) === index);
  const fallback = DOMAINS.map((domain) => domain.id).filter((id) => !uniquePriorities.includes(id));
  const ordered = [...uniquePriorities, ...fallback];

  return BASE_PLANNING.map((day) => {
    if (day.id === "j1") return { ...day, domainIds: [ordered[0]], objective: `Domaine prioritaire #1 : ${labelOf(ordered[0])}.` };
    if (day.id === "j2") return { ...day, domainIds: [ordered[1]], objective: `Domaine prioritaire #2 : ${labelOf(ordered[1])}.` };
    if (day.id === "j3") return { ...day, domainIds: [ordered[2]], objective: `Domaine #3 : ${labelOf(ordered[2])} + automatismes intensifs.` };
    if (day.id === "j4") return { ...day, domainIds: [ordered[3], ordered[4]], objective: `Domaines #4/#5 : ${labelOf(ordered[3])} et ${labelOf(ordered[4])} + sujet zéro.` };
    return day;
  });
}

export function labelOf(domainId: DomainId) {
  return DOMAINS.find((domain) => domain.id === domainId)?.label ?? domainId;
}

export function getDefaultProfile(): DiagnosticProfile {
  return computeDiagnosticProfile({ qcm: {}, exercises: {} }, "2026-05-30T10:00:00.000Z");
}
