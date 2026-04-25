import { 
  AutomatismeSeries, 
  AutomatismeAttemptResult, 
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

  // Initialize domain performance
  series.questions.forEach(q => {
    if (!domainPerformance[q.domain]) {
      domainPerformance[q.domain] = { correct: 0, total: 0, percentage: 0 };
    }
    const perf = domainPerformance[q.domain]!;
    perf.total += 1;
    
    const userAnswer = answers[q.id];
    if (userAnswer === q.correctChoiceId) {
      score += 1;
      perf.correct += 1;
    } else {
      // Collect references for remediation if wrong
      if (q.sourceReference && !sourceReferences.includes(q.sourceReference)) {
        sourceReferences.push(q.sourceReference);
      }
    }
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
  if (percentage >= 90) {
    recommendation = "Excellent travail ! Tu maîtrises parfaitement les automatismes de cette série. Continue ainsi pour maintenir ce niveau.";
  } else if (percentage >= 70) {
    recommendation = "Très bon résultat. Quelques points de vigilance sur certains domaines, mais l'essentiel est acquis. Travaille tes points faibles pour viser le sans-faute.";
  } else if (percentage >= 50) {
    recommendation = "Résultat encourageant mais encore trop fragile. Reprends les méthodes des questions échouées et refais une série similaire.";
  } else {
    recommendation = "Attention, plusieurs automatismes fondamentaux ne sont pas maîtrisés. Un travail de fond sur les bases du calcul et de l'analyse est nécessaire avant de retenter une simulation.";
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
    answers // Pass the raw answers back
  };
}
