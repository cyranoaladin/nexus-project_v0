export type Results = {
  total: number;
  totalMax: number;
  byDomain: Record<string, { points: number; max: number; percent: number; }>;
};

export function toScoresByDomain(results: Results) {
  // Domain keys possibles dans le QCM: NombresCalculs, EquationsInequations, Fonctions, GeometrieTrig, ProbaStats, AlgoLogique
  // Mapping vers libellés lisibles pour le PDF
  const prettyMap: Record<string, string> = {
    NombresCalculs: "Nombres & Calculs",
    EquationsInequations: "Équations / Inéquations",
    Fonctions: "Fonctions",
    GeometrieTrig: "Géométrie & Trigonométrie",
    ProbaStats: "Probabilités & Statistiques",
    AlgoLogique: "Algorithmique & Logique",
  };
  const preferredOrder = [
    "NombresCalculs",
    "EquationsInequations",
    "Fonctions",
    "GeometrieTrig",
    "ProbaStats",
    "AlgoLogique",
  ];
  const keys = results.byDomain ? Object.keys(results.byDomain) : [];
  const chosenKeys = preferredOrder.every((k) => keys.includes(k)) ? preferredOrder : keys;
  return chosenKeys.map((k) => ({ domain: prettyMap[k] || k, percent: results.byDomain?.[k]?.percent ?? 0 }));
}

export function inferStrengthsWeaknesses(results: Results) {
  const forces: string[] = [];
  const faiblesses: string[] = [];
  for (const [k, v] of Object.entries(results.byDomain || {})) {
    const p = v.percent || 0;
    if (p >= 75) forces.push(k);
    else if (p < 50) faiblesses.push(k);
  }
  return { forces, faiblesses };
}

export function suggestPlanPremiere(results: Results) {
  return [
    "S1–S2 : Automatismes Seconde (fractions, puissances, équations 1er degré)",
    "S3–S4 : Fonctions affines & carré — variations, lectures graphiques",
    "S5–S6 : Géométrie & trigonométrie — Pythagore, Thalès, cos/sin/tan",
    "S7–S8 : Probas/Stats — interprétation, fréquences, modélisation simple",
  ];
}

export function chooseOffer(results: Results) {
  const percents = Object.values(results.byDomain || {}).map((v) => v.percent || 0);
  const avg = percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : 0;
  const low = percents.filter((p) => p < 50).length;
  if (avg >= 65 && low === 0) return { primary: "Cortex", alternatives: ["Studio Flex"], reasoning: "Radar homogène et autonomie présumée." };
  if (low <= 2) return { primary: "Studio Flex", alternatives: ["Académies"], reasoning: "1–2 lacunes ciblées à combler rapidement." };
  if (low >= 3) return { primary: "Académies", alternatives: ["Odyssée"], reasoning: "Plusieurs domaines <50% : besoin d’un boost intensif." };
  return { primary: "Odyssée", alternatives: ["Studio Flex"], reasoning: "Objectif mention / besoin de structuration annuelle." };
}

export function buildPdfPayloadPremiere(results: Results, eleve?: { firstName?: string; lastName?: string; niveau?: string; statut?: string; }) {
  const scoresByDomain = toScoresByDomain(results);
  const { forces, faiblesses } = inferStrengthsWeaknesses(results);
  const feuilleDeRoute = suggestPlanPremiere(results);
  const recommandation = chooseOffer(results);
  const scoreGlobal = Math.round((results.total / Math.max(1, results.totalMax)) * 100);
  return { eleve, scoresByDomain, forces, faiblesses, feuilleDeRoute, recommandation, scoreGlobal };
}
