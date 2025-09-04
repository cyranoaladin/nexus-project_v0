export type DomainScore = { points: number; max: number; percent: number; };
export type QcmScores = { total: number; totalMax: number; byDomain: Record<string, DomainScore>; };

export type OffersDecision = { primary: string; alternatives: string[]; reasoning?: string; };

export function decideOffers(scores: QcmScores): OffersDecision {
  const percents = Object.values(scores.byDomain || {}).map((s) => s.percent || 0);
  const avg = percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : 0;
  const lows = percents.filter((p) => p < 50).length;
  if (avg >= 75 && lows === 0) return { primary: 'Cortex', alternatives: ['Studio Flex'], reasoning: 'Profil solide et homogène' };
  if (lows <= 1 && avg >= 60) return { primary: 'Studio Flex', alternatives: ['Cortex', 'Académies'], reasoning: 'Quelques axes à renforcer' };
  if (lows >= 3 || avg < 50) return { primary: 'Académies', alternatives: ['Odyssée'], reasoning: 'Plusieurs domaines fragiles' };
  return { primary: 'Odyssée', alternatives: ['Studio Flex'], reasoning: 'Besoin de structuration continue' };
}
