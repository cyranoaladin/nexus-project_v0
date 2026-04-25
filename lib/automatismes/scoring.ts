import { 
  AutomatismeSeries, 
  AutomatismeAttemptResult, 
  AutomatismeCorrection,
  AutomatismeDomain 
} from "@/types/automatismes";

export const DOMAIN_LABELS: Record<AutomatismeDomain, string> = {
  calcul_numerique: "Calcul numérique",
  calcul_algebrique: "Calcul algébrique",
  fractions_puissances: "Fractions et Puissances",
  proportions_pourcentages: "Proportions et Pourcentages",
  evolutions: "Évolutions",
  fonctions_representations: "Fonctions et Représentations",
  lecture_graphique: "Lecture graphique",
  second_degre: "Second degré",
  statistiques: "Statistiques",
  probabilites: "Probabilités",
  derivation: "Dérivation",
  suites: "Suites",
  exponentielle: "Exponentielle",
  geometrie_reperee: "Géométrie repérée",
  produit_scalaire: "Produit scalaire",
  trigonometrie: "Trigonométrie"
};

export function calculateAutomatismeScore(
  answers: Record<string, string>,
  series: AutomatismeSeries,
  durationSeconds: number
): AutomatismeAttemptResult {
  let score = 0;
  const numQuestions = series.questions.length;

  if (numQuestions === 0) {
    throw new Error("La série ne contient aucune question.");
  }

  const domainPerformance: Partial<Record<AutomatismeDomain, { correct: number; total: number; percentage: number }>> = {};
  const sourceReferences: string[] = [];
  const corrections: AutomatismeCorrection[] = [];

  // Initialize domain performance
  series.questions.forEach(q => {
    if (!domainPerformance[q.domain]) {
      domainPerformance[q.domain] = { correct: 0, total: 0, percentage: 0 };
    }
    const perf = domainPerformance[q.domain]!;
    perf.total += 1;

    const userAnswer = answers[q.id] ?? null;
    const isCorrect = userAnswer === q.correctChoiceId;

    if (isCorrect) {
      score += 1;
      perf.correct += 1;
    } else {
      // Collect references for remediation if wrong
      if (q.sourceReference && !sourceReferences.includes(q.sourceReference)) {
        sourceReferences.push(q.sourceReference);
      }
    }

    corrections.push({
      questionId: q.id,
      questionNumber: q.questionNumber,
      userAnswer: userAnswer as AutomatismeCorrection["userAnswer"],
      correctChoiceId: q.correctChoiceId,
      isCorrect,
      feedback: isCorrect ? q.feedbackCorrect : q.feedbackWrong,
      method: q.method,
      trap: q.trap,
      remediation: q.remediation,
      sourceReference: q.sourceReference,
      sourceComment: q.sourceComment,
    });
  });

  // Calculate percentages for domains
  (Object.keys(domainPerformance) as AutomatismeDomain[]).forEach(d => {
    const perf = domainPerformance[d]!;
    perf.percentage = Math.round((perf.correct / perf.total) * 100);
  });

  const percentage = Math.round((score / numQuestions) * 100);
  const scoreSur6 = Number(((score / numQuestions) * 6).toFixed(1));

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  (Object.keys(domainPerformance) as AutomatismeDomain[]).forEach(d => {
    const perf = domainPerformance[d]!;
    const label = DOMAIN_LABELS[d];
    if (perf.percentage >= 80) {
      strengths.push(label);
    } else if (perf.percentage < 50) {
      weaknesses.push(label);
    }
  });

  let recommendation = "";
  if (score >= 11) {
    recommendation = "Très bon niveau. Tu peux passer en mode chronométré ou viser le sans-faute.";
  } else if (score >= 9) {
    recommendation = "Bon niveau général. Quelques automatismes doivent être stabilisés pour viser une note élevée.";
  } else if (score >= 6) {
    recommendation = "Résultat encourageant, mais la fiabilité reste insuffisante. Travaille les domaines indiqués avant de refaire une simulation.";
  } else {
    recommendation = "Plusieurs automatismes fondamentaux restent fragiles. Reprends les corrections, puis refais une simulation de consolidation.";
  }

  return {
    score,
    totalQuestions: numQuestions,
    scoreSur6,
    percentage,
    duration: durationSeconds,
    averageTimePerQuestion: Math.round(durationSeconds / numQuestions),
    domainPerformance: domainPerformance as Record<AutomatismeDomain, { correct: number; total: number; percentage: number }>,
    weaknesses,
    strengths,
    recommendation,
    sourceReferences,
    corrections,
    answers // Pass the raw answers back
  };
}
