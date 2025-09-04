export type Results = {
  total: number;
  totalMax: number;
  byDomain: Record<string, { points: number; max: number; percent: number; }>;
};

// Réplique locale pour éviter d'importer des modules qui chargent des JSON côté SSR
const NSI_ORDER = [
  'TypesBase',
  'TypesConstruits',
  'Algo',
  'LangagePython',
  'TablesDonnees',
  'IHMWeb',
  'Reseaux',
  'ArchOS',
  'HistoireEthique',
] as const;

function nsiDomainToLabel(key: string): string {
  switch (key) {
    case 'TypesBase': return 'Types de base';
    case 'TypesConstruits': return 'Types construits';
    case 'Algo': return 'Algorithmique';
    case 'LangagePython': return 'Langage Python';
    case 'TablesDonnees': return 'Tables de données';
    case 'IHMWeb': return 'IHM Web';
    case 'Reseaux': return 'Réseaux';
    case 'ArchOS': return 'Architecture & OS';
    case 'HistoireEthique': return 'Histoire & Éthique';
    default: return key;
  }
}

export function toScoresByDomainNSITerminale(results: Results) {
  const order = Array.from(NSI_ORDER);
  return order.map((d) => ({ domain: nsiDomainToLabel(d), percent: results.byDomain?.[d]?.percent ?? 0 }));
}

export function inferStrengthsWeaknessesNSITerminale(results: Results) {
  const forces: string[] = [];
  const faiblesses: string[] = [];
  for (const [k, v] of Object.entries(results.byDomain || {})) {
    const p = v.percent || 0;
    const label = nsiDomainToLabel(k);
    if (p >= 75) forces.push(label);
    else if (p < 50) faiblesses.push(label);
  }
  return { forces, faiblesses };
}

export function suggestPlanNSITerminale(_: Results) {
  return [
    "S1–S2 : Rappels Python & Algorithmes — modularité, tests, complexité",
    "S3–S4 : Données & fichiers — CSV/JSON, filtrage/tri/jointure, nettoyage",
    "S5–S6 : Web & HTTP — APIs simples, formulaires, cookies, sécurité de base",
    "S7–S8 : Réseaux & OS — outils CLI, droits, déploiement local de mini‑projet",
  ];
}

export function chooseOfferNSITerminale(results: Results) {
  const percents = Object.values(results.byDomain || {}).map((v) => v.percent || 0);
  const avg = percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : 0;
  const low = percents.filter((p) => p < 50).length;
  if (avg >= 65 && low === 0) return { primary: "Cortex", alternatives: ["Studio Flex"], reasoning: "Radar homogène et autonomie présumée." };
  if (low <= 2) return { primary: "Studio Flex", alternatives: ["Académies"], reasoning: "1–2 lacunes ciblées à combler rapidement." };
  if (low >= 3) return { primary: "Académies", alternatives: ["Odyssée"], reasoning: "Plusieurs domaines <50% : besoin d’un boost intensif." };
  return { primary: "Odyssée", alternatives: ["Studio Flex"], reasoning: "Objectif mention / besoin de structuration annuelle." };
}

export function buildPdfPayloadNSITerminale(results: Results) {
  const scoresByDomain = toScoresByDomainNSITerminale(results);
  const { forces, faiblesses } = inferStrengthsWeaknessesNSITerminale(results);
  const feuilleDeRoute = suggestPlanNSITerminale(results);
  const offers = chooseOfferNSITerminale(results);
  const scoreGlobal = Math.round((results.total / Math.max(1, results.totalMax)) * 100);
  return { scoresByDomain, forces, faiblesses, feuilleDeRoute, offers, scoreGlobal };
}
