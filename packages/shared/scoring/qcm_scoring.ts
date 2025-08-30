import { QcmSummary, DomainScore } from '../types/bilan';

/**
 * Structure attendue pour une réponse individuelle au QCM.
 */
export interface QcmAnswer {
  domain: string;      // ex: 'Algèbre'
  isCorrect: boolean;
  points: number;      // Points pour cette question si correcte
  maxPoints: number;   // Points maximum pour cette question
}

/**
 * Calcule les scores du QCM à partir d'une liste de réponses.
 *
 * @param qcmAnswers - Un tableau de réponses au QCM.
 * @returns Un résumé des scores du QCM.
 */
export function calculateQcmScores(qcmAnswers: QcmAnswer[]): QcmSummary {
  const domainData: Record<string, { points: number; max: number }> = {};

  // 1. Agréger les points par domaine
  for (const answer of qcmAnswers) {
    if (!domainData[answer.domain]) {
      domainData[answer.domain] = { points: 0, max: 0 };
    }
    if (answer.isCorrect) {
      domainData[answer.domain].points += answer.points;
    }
    domainData[answer.domain].max += answer.maxPoints;
  }

  // 2. Transformer en tableau de DomainScore et calculer les pourcentages
  const domains: DomainScore[] = Object.entries(domainData).map(([domain, data]) => {
    const masteryPct = data.max > 0 ? (data.points / data.max) * 100 : 0;
    return {
      domain,
      points: data.points,
      max: data.max,
      masteryPct,
      note: getMasteryNote(masteryPct),
    };
  });

  // 3. Calculer les totaux
  const total = domains.reduce((sum, d) => sum + d.points, 0);
  const max = domains.reduce((sum, d) => sum + d.max, 0);
  const scoreGlobalPct = max > 0 ? (total / max) * 100 : 0;
  const weakDomainsCount = domains.filter(d => d.masteryPct < 50).length;

  return {
    total,
    max,
    scoreGlobalPct,
    weakDomainsCount,
    domains: domains.sort((a, b) => b.max - a.max), // Trier par importance
  };
}

/**
 * Fournit une note qualitative basée sur le pourcentage de maîtrise.
 */
function getMasteryNote(pct: number): string {
  if (pct >= 90) return 'Excellent';
  if (pct >= 75) return 'Bonne maîtrise';
  if (pct >= 60) return 'Solide';
  if (pct >= 50) return 'Satisfaisant';
  if (pct >= 30) return 'A revoir';
  return 'Lacunes importantes';
}
