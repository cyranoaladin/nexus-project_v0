export type QcmQuestion = { id: string; domain?: string; weight?: number; type?: string; answer?: number; correct?: number[]; };
export type QcmDoc = { meta?: any; questions: QcmQuestion[]; };

export function isCorrectQcmAnswer(q: any, ans: any): boolean {
  const toNumberArray = (v: any): number[] => {
    if (Array.isArray(v)) return v.map((x) => Number(x));
    if (typeof v === 'string') return v.split(',').map((x) => Number(x.trim()));
    if (v === undefined || v === null) return [];
    return [Number(v)];
  };
  const expected = toNumberArray(q?.correct);
  const got = toNumberArray(ans);
  if (expected.length > 0) {
    const a = [...expected].sort().join(',');
    const b = [...got].sort().join(',');
    return a === b;
  }
  return Number(ans) === Number(q?.answer);
}

export function scoreQcm(qcm: QcmDoc, answers: Record<string, any>) {
  const byDomain: Record<string, { points: number; max: number; percent: number; }> = {};
  let total = 0; let totalMax = 0;
  for (const q of (qcm.questions || [])) {
    const d = q.domain || 'General';
    const w = Math.max(1, Number(q.weight || 1));
    byDomain[d] ||= { points: 0, max: 0, percent: 0 };
    byDomain[d].max += w; totalMax += w;
    const a = answers[q.id];
    if (a !== undefined && isCorrectQcmAnswer(q, a)) { byDomain[d].points += w; total += w; }
  }
  for (const d of Object.keys(byDomain)) {
    const s = byDomain[d]; s.percent = Math.round(100 * s.points / Math.max(1, s.max));
  }
  return { total, totalMax, byDomain };
}

export function deriveSynthesisFromQcm(byDomain: Record<string, { percent: number; }>) {
  const forces: string[] = []; const faiblesses: string[] = [];
  for (const [k, v] of Object.entries(byDomain || {} as any)) {
    const p = (v as any).percent || 0;
    if (p >= 75) forces.push(k); else if (p < 50) faiblesses.push(k);
  }
  const feuilleDeRoute = [
    'S1–S2 : Automatismes et bases essentielles',
    'S3–S4 : Applications ciblées selon faiblesses',
    'S5–S6 : Approfondissement et annales',
    'S7–S8 : Consolidation et préparation examens',
  ];
  return { forces, faiblesses, feuilleDeRoute };
}

import { DomainKey, QCM_QUESTIONS, QcmQuestion as QcmQuestionData } from "./qcmData";

export type QcmAnswerMap = Record<string, string | string[]>;

export type DomainScore = { points: number; max: number; percent: number; };
export type QcmScore = {
  total: number;
  totalMax: number;
  byDomain: Record<string, DomainScore>;
};

function normalizeFree(v: string | string[] | undefined): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.join(",").trim();
  return String(v).trim().toLowerCase().replace(/\s+/g, " ");
}

function isCorrect(ans: string | string[] | undefined, q: QcmQuestionData): boolean {
  if (q.type === "single") {
    return typeof ans === "string" && ans === q.correct;
  }
  // free answer: soft compare after normalization
  const got = normalizeFree(ans);
  const expected = normalizeFree(q.correct as string);
  return got === expected;
}

export function scoreQCM(answers: QcmAnswerMap, questions: QcmQuestionData[] = QCM_QUESTIONS): QcmScore {
  const byDomain = {} as Record<DomainKey, DomainScore>;
  let total = 0, totalMax = 0;
  for (const q of questions) {
    if (!byDomain[q.domain]) byDomain[q.domain] = { points: 0, max: 0, percent: 0 };
    const ok = isCorrect(answers[q.id], q);
    const pts = ok ? q.weight : 0;
    total += pts;
    totalMax += q.weight;
    byDomain[q.domain].points += pts;
    byDomain[q.domain].max += q.weight;
  }
  // compute percentages
  (Object.keys(byDomain) as DomainKey[]).forEach((d) => {
    const ds = byDomain[d];
    ds.percent = ds.max > 0 ? Math.round((100 * ds.points) / ds.max) : 0;
  });
  return { total, totalMax, byDomain };
}
