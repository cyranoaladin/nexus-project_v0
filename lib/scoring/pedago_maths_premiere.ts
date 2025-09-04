export type PedagoAnswer = number | number[];
export type PedagoQuestion = {
  id: string;
  domain?: string;
  type: 'likert' | 'single' | 'multi';
  weight?: number;
  reverse?: boolean;
  options?: string[];
};
export type PedagoSurvey = { meta?: any; questions: PedagoQuestion[]; };

function normalizeLikert(v: number, reverse = false) {
  const clamped = Math.max(1, Math.min(5, Number(v || 3)));
  const val = reverse ? 6 - clamped : clamped; // 1..5
  return (val - 1) / 4; // 0..1
}

export function scorePedagoMathsPremiere(survey: PedagoSurvey, answers: Record<string, PedagoAnswer>) {
  const byDomain: Record<string, { points: number; max: number; percent: number; }> = {};
  for (const q of survey.questions || []) {
    const d = q.domain || 'General';
    const w = Math.max(1, Number(q.weight || 1));
    byDomain[d] ||= { points: 0, max: 0, percent: 0 };
    byDomain[d].max += w;
    const a = answers[q.id];
    if (q.type === 'likert' && typeof a === 'number') {
      byDomain[d].points += w * normalizeLikert(a, !!q.reverse);
    } else if (q.type === 'single' && (typeof a === 'number' || typeof a === 'string')) {
      byDomain[d].points += 0.5 * w; // participation
    } else if (q.type === 'multi' && Array.isArray(a)) {
      byDomain[d].points += Math.min(1, a.length / 2) * 0.5 * w; // couverture
    }
  }
  for (const d in byDomain) {
    const { points, max } = byDomain[d];
    byDomain[d].percent = Math.round(100 * (points / Math.max(1, max)));
  }
  return { byDomain, raw: answers };
}

export function deriveProfileMathsPremiere(scores: { raw: Record<string, any>; }) {
  const r = scores.raw || {};
  const motivation = Number(r['M1'] || 3) >= 4 ? 'élevée' : Number(r['M2'] || 3) >= 4 ? 'bonne' : 'moyenne';
  const style = (() => {
    const vis = Number(r['M12'] || 3);
    const aud = Number(r['M13'] || 3);
    const kin = Number(r['M14'] || 3);
    const top = Math.max(vis, aud, kin);
    return top === vis ? 'Visuel' : top === aud ? 'Auditif' : 'Kinesthésique';
  })();
  const organisation = Number(r['M9'] || 3) >= 4 && Number(r['M10'] || 3) >= 4 ? 'bonne' : 'moyenne';
  const confiance = Number(r['M17'] || 3) <= 2 ? 'fragile' : Number(r['M18'] || 3) >= 4 ? 'correcte' : 'moyenne';
  const methods = Array.isArray(r['M8']) ? r['M8'] : [];
  const environment = Array.isArray(r['M19']) ? r['M19'] : [];
  const flags: string[] = [];
  if (Number(r['M6'] || 3) >= 4) flags.push('Rigueur à consolider');
  if (Number(r['M22'] || 3) >= 4) flags.push('Persévérance à travailler');
  return { style, motivation, organisation, confidence: confiance, methods, environment, flags };
}

export function buildPedagoPayloadMathsPremiere(survey: PedagoSurvey, answers: Record<string, PedagoAnswer>) {
  const scores = scorePedagoMathsPremiere(survey, answers);
  const profile = deriveProfileMathsPremiere(scores);
  return { pedagoScores: scores, pedagoProfile: profile };
}
