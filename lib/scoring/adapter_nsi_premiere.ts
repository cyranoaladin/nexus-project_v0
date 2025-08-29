export type Results = {
  total: number;
  totalMax: number;
  byDomain: Record<string, { points: number; max: number; percent: number }>;
};

import { NSI_ORDER, nsiDomainToLabel } from "./premiere_nsi";

export function toScoresByDomainNSI(results: Results) {
  const order = Array.from(NSI_ORDER);
  return order.map((d) => ({ domain: nsiDomainToLabel(d), percent: results.byDomain?.[d]?.percent ?? 0 }));
}

export function inferStrengthsWeaknessesNSI(results: Results) {
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

export function suggestPlanNSIPremiere(_: Results) {
  return [
    "S1–S2 : Types & Python — booléens, conditions, boucles, fonctions",
    "S3–S4 : Tables de données — CSV, filtres, tris, jointures simples",
    "S5–S6 : IHM Web & HTTP — formulaires, GET/POST, cookies, sécurité basique",
    "S7–S8 : Réseaux & OS — CLI, droits, modèle client‑serveur, projet d’intégration",
  ];
}

export function chooseOfferNSI(results: Results) {
  const percents = Object.values(results.byDomain || {}).map((v) => v.percent || 0);
  const avg = percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : 0;
  const low = percents.filter((p) => p < 50).length;
  if (avg >= 65 && low === 0) return { primary: "Cortex", alternatives: ["Studio Flex"], reasoning: "Radar homogène et autonomie présumée." };
  if (low <= 2) return { primary: "Studio Flex", alternatives: ["Académies"], reasoning: "1–2 lacunes ciblées à combler rapidement." };
  if (low >= 3) return { primary: "Académies", alternatives: ["Odyssée"], reasoning: "Plusieurs domaines <50% : besoin d’un boost intensif." };
  return { primary: "Odyssée", alternatives: ["Studio Flex"], reasoning: "Objectif mention / besoin de structuration annuelle." };
}

export function buildPdfPayloadNSIPremiere(results: Results) {
  const scoresByDomain = toScoresByDomainNSI(results);
  const { forces, faiblesses } = inferStrengthsWeaknessesNSI(results);
  const feuilleDeRoute = suggestPlanNSIPremiere(results);
  const offers = chooseOfferNSI(results);
  const scoreGlobal = Math.round((results.total / Math.max(1, results.totalMax)) * 100);
  return { scoresByDomain, forces, faiblesses, feuilleDeRoute, offers, scoreGlobal };
}

