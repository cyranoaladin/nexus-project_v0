export type PedagoAnswer = number | number[];
export type PedagoQuestion = {
  id: string;
  domain: string;
  type: 'likert'|'single'|'multi';
  weight: number;
  reverse?: boolean;
  options?: string[];
};
export type PedagoSurvey = { meta: any; questions: PedagoQuestion[] };

export type PedagoScores = {
  byDomain: Record<string, { points: number; max: number; percent: number }>;
  raw: Record<string, PedagoAnswer>;
};

function normalizeLikert(v: number, reverse = false) {
  const clamped = Math.max(1, Math.min(5, Number(v || 1)));
  const val = reverse ? 6 - clamped : clamped; // 1..5
  return (val - 1) / 4; // 0..1
}

export function scorePedagoNSI(survey: PedagoSurvey, answers: Record<string, PedagoAnswer>): PedagoScores {
  const byDomain: PedagoScores['byDomain'] = {};
  for (const q of survey.questions) {
    const d = q.domain;
    byDomain[d] ||= { points: 0, max: 0, percent: 0 };
    byDomain[d].max += q.weight;
    const a = answers[q.id];
    if (q.type === 'likert' && typeof a === 'number') {
      byDomain[d].points += q.weight * normalizeLikert(a, !!q.reverse);
    }
    if (q.type === 'single' && typeof a === 'number') {
      byDomain[d].points += 0.5 * q.weight; // bonus de complétion
    }
    if (q.type === 'multi' && Array.isArray(a)) {
      byDomain[d].points += 0.5 * q.weight * Math.min(1, a.length / 2);
    }
  }
  for (const d in byDomain) {
    const { points, max } = byDomain[d];
    byDomain[d].percent = Math.round(100 * (points / Math.max(1, max)));
  }
  return { byDomain, raw: answers };
}

export type PedagoProfileNSI = {
  vak: 'Visuel'|'Auditif'|'Kinesthesique';
  autonomie: 'faible'|'moyenne'|'bonne';
  organisation: 'faible'|'moyenne'|'bonne';
  stress: 'faible'|'moyen'|'élevé';
  flags: string[];
  preferences: { pairProgramming: boolean; git: boolean; tests: boolean };
};

function avgLikert(items: [string, boolean][], raw: Record<string, any>) {
  const vals = items.map(([id, rev]) => normalizeLikert(Number(raw[id] || 3), rev));
  return vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
}

export function deriveProfileNSI(scores: PedagoScores): PedagoProfileNSI {
  const raw = scores.raw as Record<string, number | number[]>;
  const v = Number(raw['P11'] || 3);
  const a = Number(raw['P12'] || 3);
  const k = Number(raw['P13'] || 3);
  const top = Math.max(v, a, k);
  const vak: PedagoProfileNSI['vak'] = top === v ? 'Visuel' : top === a ? 'Auditif' : 'Kinesthesique';

  const meth = avgLikert([
    ['P4', false], ['P5', false], ['P6', false], ['P7', true],
  ], raw);
  const autonomie = meth >= 0.66 ? 'bonne' : meth >= 0.4 ? 'moyenne' : 'faible';

  const org = avgLikert([
    ['P8', false], ['P9', false], ['P10', false], ['P26', false],
  ], raw);
  const organisation = org >= 0.66 ? 'bonne' : org >= 0.4 ? 'moyenne' : 'faible';

  const stressVal = avgLikert([
    ['P16', true], ['P17', false],
  ], raw);
  const stress: PedagoProfileNSI['stress'] = stressVal >= 0.66 ? 'faible' : stressVal >= 0.4 ? 'moyen' : 'élevé';

  const flags: string[] = [];
  if ((Number(raw['P20']) || 1) >= 4) flags.push('Concentration');
  if ((Number(raw['P21']) || 1) >= 4) flags.push('Abstraction');
  if ((Number(raw['P22']) || 1) >= 4) flags.push('Anxiete');
  const p30 = raw['P30'];
  if (Array.isArray(p30)) {
    if (p30.includes(0)) flags.push('Dys');
    if (p30.includes(1)) flags.push('TDAH_suspect');
    if (p30.includes(2)) flags.push('Anxiete');
    if (p30.includes(3)) flags.push('Besoins_specifiques');
  }

  const preferences = {
    pairProgramming: (Number(raw['P14']) || 1) >= 4,
    git: (Number(raw['P10']) || 1) >= 4 || (Number(raw['P28']) || 1) >= 4,
    tests: (Number(raw['P6']) || 1) >= 4,
  };

  return { vak, autonomie, organisation, stress, flags, preferences };
}

export function recommendModalityNSI(profile: PedagoProfileNSI) {
  let format = 'groupe homogène (4 élèves)';
  if (profile.autonomie === 'faible' || profile.stress === 'élevé' || profile.flags.length > 0) format = 'individuel';
  const duree = profile.stress === 'élevé' ? 60 : 90;
  const hebdo = profile.autonomie === 'bonne' ? 1.5 : profile.autonomie === 'moyenne' ? 2 : 3;
  return { format, duree, hebdo };
}

export function buildPedagoPayloadNSIPremiere(survey: PedagoSurvey, answers: Record<string, PedagoAnswer>) {
  const pedagoScores = scorePedagoNSI(survey, answers);
  const pedagoProfile = deriveProfileNSI(pedagoScores);
  const pedagoModality = recommendModalityNSI(pedagoProfile);
  return { pedagoScores, pedagoProfile, pedagoModality };
}

