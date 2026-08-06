import type { ItemResult } from './types';

export type DomainScore = Readonly<{
  domain: string;
  score: number;
}>;

type DomainScoreItem = Pick<ItemResult, 'itemId' | 'nodeCpsId' | 'weight' | 'rawSuccess'>;

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeDomainScores(
  packDomains: readonly string[],
  nodeDomains: Readonly<Record<string, string>>,
  items: readonly DomainScoreItem[],
): readonly DomainScore[] {
  const domainIds = new Set(packDomains);
  const totals = new Map(packDomains.map((domain) => [domain, { weightedSuccess: 0, weight: 0 }]));

  for (const item of items) {
    const domain = nodeDomains[item.nodeCpsId];
    if (domain === undefined || !domainIds.has(domain)) {
      throw new Error(`Fact item ${item.itemId} node ${item.nodeCpsId} is not bound to a pack domain`);
    }
    const total = totals.get(domain) as { weightedSuccess: number; weight: number };
    total.weight += item.weight;
    total.weightedSuccess += item.rawSuccess * item.weight;
  }

  return Object.freeze(packDomains.map((domain) => {
    const total = totals.get(domain) as { weightedSuccess: number; weight: number };
    return Object.freeze({
      domain,
      score: total.weight === 0 ? 0 : roundToOneDecimal((100 * total.weightedSuccess) / total.weight),
    });
  }));
}
