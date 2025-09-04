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

export function scorePedagoMathsTerminale(survey: PedagoSurvey, answers: Record<string, PedagoAnswer>) {
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
      byDomain[d].points += 0.5 * w;
    } else if (q.type === 'multi' && Array.isArray(a)) {
      byDomain[d].points += Math.min(1, a.length / 2) * 0.5 * w;
    }
  }
  for (const d in byDomain) {
    const { points, max } = byDomain[d];
    byDomain[d].percent = Math.round(100 * (points / Math.max(1, max)));
  }
  return { byDomain, raw: answers };
}

export function deriveProfileMathsTerminale(scores: { raw: Record<string, any>; }) {
  const r = scores.raw || {};
  const motivation = Number(r['T1'] || 3) >= 4 ? 'élevée' : Number(r['T2'] || 3) >= 4 ? 'bonne' : 'moyenne';
  const style = (() => {
    const vis = Number(r['T12'] || 3);
    const aud = Number(r['T13'] || 3);
    const kin = Number(r['T14'] || 3);
    const top = Math.max(vis, aud, kin);
    return top === vis ? 'Visuel' : top === aud ? 'Auditif' : 'Kinesthésique';
  })();
  const organisation = Number(r['T9'] || 3) >= 4 && Number(r['T10'] || 3) >= 4 ? 'bonne' : 'moyenne';
  const confiance = Number(r['T17'] || 3) <= 2 ? 'fragile' : Number(r['T18'] || 3) >= 4 ? 'correcte' : 'moyenne';
  const methods = Array.isArray(r['T8']) ? r['T8'] : [];
  const environment = Array.isArray(r['T19']) ? r['T19'] : [];
  const flags: string[] = [];
  if (Number(r['T6'] || 3) >= 4) flags.push('Rigueur à consolider');
  if (Number(r['T22'] || 3) >= 4) flags.push('Persévérance à travailler');
  return { style, motivation, organisation, confidence: confiance, methods, environment, flags };
}

export function buildPedagoPayloadMathsTerminale(survey: PedagoSurvey, answers: Record<string, PedagoAnswer>) {
  const scores = scorePedagoMathsTerminale(survey, answers);
  const profile = deriveProfileMathsTerminale(scores);
  return { pedagoScores: scores, pedagoProfile: profile };
}
