export type Results = {
  total: number;
  totalMax: number;
  byDomain: Record<string, { points: number; max: number; percent: number; }>;
};

export function toScoresByDomainPC(results: Results) {
  const pretty: Record<string, string> = {
    mesure_incertitudes: 'Mesure & Incertitudes',
    chimie_matiere: 'Constitution & Transformations (Chimie)',
    mouvement_interactions: 'Mouvement & Interactions',
    energie: 'Énergie',
    ondes_signaux: 'Ondes & Signaux',
  };
  const order = ['mesure_incertitudes', 'chimie_matiere', 'mouvement_interactions', 'energie', 'ondes_signaux'];
  const keys = Object.keys(results.byDomain || {});
  const chosen = order.every(k => keys.includes(k)) ? order : keys;
  return chosen.map(k => ({ domain: pretty[k] || k, percent: results.byDomain?.[k]?.percent ?? 0 }));
}

export function inferStrengthsWeaknessesPC(results: Results) {
  const forces: string[] = [];
  const faiblesses: string[] = [];
  for (const [k, v] of Object.entries(results.byDomain || {})) {
    const p = v.percent || 0;
    if (p >= 75) forces.push(k);
    else if (p < 50) faiblesses.push(k);
  }
  return { forces, faiblesses };
}

export function suggestPlanTerminalePC(_: Results) {
  return [
    'S1–S2 : Mesures & incertitudes — écriture du résultat, tableur',
    'S3–S4 : Chimie — dilution/titrage, rendements, UV-Vis',
    'S5–S6 : Mouvement & interactions — lois, travail, bilans',
    'S7–S8 : Énergie / ondes & signaux — P=UI, v=λf, instrumentation',
  ];
}

export function chooseOfferPC(results: Results) {
  const percents = Object.values(results.byDomain || {}).map(v => v.percent || 0);
  const avg = percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : 0;
  const low = percents.filter(p => p < 50).length;
  if (avg >= 65 && low === 0) return { primary: 'Cortex', alternatives: ['Studio Flex'], reasoning: 'Radar homogène et autonomie présumée.' };
  if (low <= 2) return { primary: 'Studio Flex', alternatives: ['Académies'], reasoning: '1–2 lacunes ciblées à combler rapidement.' };
  if (low >= 3) return { primary: 'Académies', alternatives: ['Odyssée'], reasoning: 'Plusieurs domaines <50% : besoin d’un boost intensif.' };
  return { primary: 'Odyssée', alternatives: ['Studio Flex'], reasoning: 'Objectif mention / besoin de structuration annuelle.' };
}

export function buildPdfPayloadTerminalePC(results: Results, eleve?: { firstName?: string; lastName?: string; niveau?: string; statut?: string; }) {
  const scoresByDomain = toScoresByDomainPC(results);
  const { forces, faiblesses } = inferStrengthsWeaknessesPC(results);
  const feuilleDeRoute = suggestPlanTerminalePC(results);
  const recommandation = chooseOfferPC(results);
  const scoreGlobal = Math.round((results.total / Math.max(1, results.totalMax)) * 100);
  return { eleve, scoresByDomain, forces, faiblesses, feuilleDeRoute, recommandation, scoreGlobal };
}
