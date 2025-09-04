import { QcmItem } from './types';

export type DomainScore = { points: number; max: number; percent: number; };
export type QcmScores = { total: number; totalMax: number; byDomain: Record<string, DomainScore>; };

function normalizeShortAnswer(v: any): string {
  return String(v ?? '').trim().replace(/\s+/g, ' ');
}

export function computeQcmScores(items: QcmItem[], answers: Record<string, any>): QcmScores {
  const byDomain: Record<string, DomainScore> = {};
  let total = 0, totalMax = 0;
  for (const q of items) {
    const domain = (q as any).domain || 'General';
    const weight = Math.max(1, Number((q as any).weight || 1));
    if (!byDomain[domain]) byDomain[domain] = { points: 0, max: 0, percent: 0 };
    byDomain[domain].max += weight; totalMax += weight;
    const ans = answers[q.id];
    let correct = false;
    if (q.type === 'mcq') {
      const picked = String(ans || '').trim();
      const choices = (q as any).choices || [];
      const found = choices.find((c: any) => c.k === picked);
      correct = !!found?.correct;
    } else {
      const expected = normalizeShortAnswer((q as any).answer_latex);
      const got = normalizeShortAnswer(ans);
      correct = expected.length > 0 && got === expected;
    }
    if (correct) {
      byDomain[domain].points += weight; total += weight;
    }
  }
  for (const d of Object.keys(byDomain)) {
    const s = byDomain[d];
    s.percent = s.max > 0 ? Math.round(100 * s.points / s.max) : 0;
  }
  return { total, totalMax, byDomain };
}
