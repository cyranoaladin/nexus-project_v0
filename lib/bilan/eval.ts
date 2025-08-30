// lib/bilan/eval.ts
import { QCMAnswersPayload, QCMScores, DomainScore } from './types';
import { QCM_PREMIERE_MATHS, DOMAIN_MAX } from './qcm-premiere-maths';

export function evaluateQcm(answers: QCMAnswersPayload): QCMScores {
  const domainPoints: Record<string, number> = {};
  const domainMax: Record<string, number> = { ...DOMAIN_MAX };

  for (const q of QCM_PREMIERE_MATHS) {
    const choice = answers[q.id];
    const ok = typeof choice === 'number' && choice === q.correctIndex;
    domainPoints[q.domain] = (domainPoints[q.domain] || 0) + (ok ? q.weight : 0);
  }

  const byDomain: Record<string, DomainScore> = {};
  let pointsSum = 0;
  let maxSum = 0;
  let weakDomains = 0;

  for (const domain of Object.keys(domainMax)) {
    const pts = domainPoints[domain] || 0;
    const mx = domainMax[domain] || 0;
    const percent = mx > 0 ? Math.round((100 * pts) / mx) : 0;
    byDomain[domain] = { domain: domain as any, points: pts, max: mx, percent };
    pointsSum += pts;
    maxSum += mx;
    if (percent < 50) weakDomains++;
  }

  const scoreGlobal = maxSum > 0 ? Math.round((100 * pointsSum) / maxSum) : 0;
  return { byDomain, scoreGlobal, weakDomains };
}

