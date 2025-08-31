import { QCM_QUESTIONS, QcmQuestion, DomainKey } from "./qcmData";

export type QcmAnswerMap = Record<string, string | string[]>;

export type DomainScore = { points: number; max: number; percent: number };
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

function isCorrect(ans: string | string[] | undefined, q: QcmQuestion): boolean {
  if (q.type === "single") {
    return typeof ans === "string" && ans === q.correct;
  }
  // free answer: soft compare after normalization
  const got = normalizeFree(ans);
  const expected = normalizeFree(q.correct as string);
  return got === expected;
}

export function scoreQCM(answers: QcmAnswerMap, questions: QcmQuestion[] = QCM_QUESTIONS): QcmScore {
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

