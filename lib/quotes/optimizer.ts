/**
 * Budget-constrained variant of the ideal recommendation (CDC §20).
 *
 * Never invents prices: every candidate volume comes from the same
 * canonical petit_groupe modules used to build the ideal recommendation.
 * The optimizer only decides which lines to keep, at which of their
 * already-priced tiers, in priority order — it downgrades a line's hours
 * before dropping it entirely, and always keeps Pilotage. Pure, no React,
 * no DB.
 */
import { getCandidatIndividuelModules } from '@/lib/pricing';
import type { BudgetStrategy, NotRecommendedSubject, RecommendedLine } from './schemas';

/** BEST_BALANCE may exceed the stated budget by up to this percentage to keep a high-priority subject at a meaningful volume, instead of hard-dropping it like RESPECT_BUDGET would. */
export const BEST_BALANCE_OVERFLOW_TOLERANCE_PCT = 10;

function downgradeTiers(hoursPerMonth: number): number[] {
  if (hoursPerMonth >= 12) return [12, 8, 4];
  if (hoursPerMonth >= 8) return [8, 4];
  return [4];
}

export interface OptimizedRecommendation {
  lines: RecommendedLine[];
  droppedForBudget: NotRecommendedSubject[];
  monthlyTotal: number;
}

export function optimizeForBudget(
  idealLines: RecommendedLine[],
  monthlyBudgetTnd: number,
  strategy: BudgetStrategy,
): OptimizedRecommendation {
  const pilotage = idealLines.find((l) => l.modality === 'PILOTAGE');
  const rest = idealLines.filter((l) => l.modality !== 'PILOTAGE').sort((a, b) => b.priorityScore - a.priorityScore);

  if (strategy === 'MOST_COMPLETE') {
    const monthlyTotal = idealLines.reduce((sum, l) => sum + l.unitPriceMonthly, 0);
    return { lines: idealLines, droppedForBudget: [], monthlyTotal };
  }

  const ceiling =
    strategy === 'BEST_BALANCE'
      ? Math.round(monthlyBudgetTnd * (1 + BEST_BALANCE_OVERFLOW_TOLERANCE_PCT / 100))
      : monthlyBudgetTnd;

  const modules = getCandidatIndividuelModules();
  const priceForHours = new Map(modules.petit_groupe.map((m) => [m.hours_per_month, m.price_per_student_monthly]));

  const kept: RecommendedLine[] = pilotage ? [pilotage] : [];
  const dropped: NotRecommendedSubject[] = [];
  let runningTotal = pilotage?.unitPriceMonthly ?? 0;

  for (const line of rest) {
    const remaining = ceiling - runningTotal;

    if (line.hoursPerMonth == null) {
      // Non-downgradable forfait (e.g. Grand Oral) — include if it fits, else drop.
      if (line.unitPriceMonthly <= remaining) {
        kept.push(line);
        runningTotal += line.unitPriceMonthly;
      } else {
        dropped.push({
          subject: line.subject as NotRecommendedSubject['subject'],
          reason: `${line.label} : non retenu pour respecter le budget indiqué (${monthlyBudgetTnd} TND/mois).`,
        });
      }
      continue;
    }

    let placed = false;
    for (const tier of downgradeTiers(line.hoursPerMonth)) {
      const price = priceForHours.get(tier);
      if (price == null) continue;
      if (price <= remaining) {
        kept.push({
          ...line,
          hoursPerMonth: tier,
          unitPriceMonthly: price,
          reason:
            tier === line.hoursPerMonth
              ? line.reason
              : `${line.reason} (volume ajusté à ${tier} h/mois pour respecter le budget)`,
        });
        runningTotal += price;
        placed = true;
        break;
      }
    }

    if (!placed) {
      dropped.push({
        subject: line.subject as NotRecommendedSubject['subject'],
        reason: `${line.label} : non retenu pour respecter le budget indiqué (${monthlyBudgetTnd} TND/mois).`,
      });
    }
  }

  return { lines: kept, droppedForBudget: dropped, monthlyTotal: runningTotal };
}
