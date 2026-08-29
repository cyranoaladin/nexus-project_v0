/**
 * Server-only contributive margin engine (CDC §10).
 *
 * Reads the commercial cost policy from BusinessConfig (namespace
 * "quotes.costPolicy") — never from a component, never from the
 * versioned public data/pricing.canonical.json. This module must never be
 * imported by anything that can reach a public DTO: teacher cost and
 * margin never leave the server (enforced by __tests__/lib/quotes/margin.test.ts,
 * which asserts the public RecommendationResult/QuoteScenario shapes have
 * no cost/margin fields at all).
 */
import 'server-only';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { RecommendedLine } from './schemas';

const COST_POLICY_NAMESPACE = 'quotes.costPolicy';
const COST_POLICY_KEY = 'default';

/**
 * The STORED/admin-written shape — never carries provenance. `source` is
 * deliberately absent here (T1 closeout, item 2, post-0e60466ea): letting
 * an admin write `source` into the payload would let a governed row
 * falsely label itself the coded fallback, or vice versa. `.strict()`
 * rejects any row that tries to include one, exactly like any other
 * unknown key.
 */
const storedCostPolicySchema = z
  .object({
    teacherCostPerHourTnd: z.number().positive(),
    variableCostPerStudentMonthTnd: z.number().nonnegative(),
    marginGates: z.object({
      greenPct: z.number().min(0).max(100),
      warningPct: z.number().min(0).max(100),
    }),
  })
  .strict();

/**
 * `source` (T1 — CANDIDAT INDIVIDUEL POLICY SAFETY CORE) is computed by
 * getCommercialCostPolicy() alone, never trusted from stored data:
 * `BLENDED_FALLBACK` when no BusinessConfig row exists (DEFAULT_COST_
 * POLICY below), `BUSINESS_CONFIG` when a real, valid row was read from
 * the governed `quotes.costPolicy` namespace. Both are today the same
 * "blended" cost-model shape (a single teacherCostPerHourTnd) — a future
 * decomposed model (enseignant certifié/agrégé/tuteur + structure +
 * dossier) is a recorded direction decision but not implemented in this
 * lot; its fields do not exist on this type, so no calculation can ever
 * mix the two.
 */
export type CommercialCostPolicy = z.infer<typeof storedCostPolicySchema> & {
  source: 'BLENDED_FALLBACK' | 'BUSINESS_CONFIG';
};

/**
 * Safe default when no admin override exists yet in BusinessConfig — the
 * reference operational cost (~100 TND/h enseignant) per CDC §10. Never
 * exposed publicly; only ever read by this server-only module.
 */
const DEFAULT_COST_POLICY: CommercialCostPolicy = {
  source: 'BLENDED_FALLBACK',
  teacherCostPerHourTnd: 100,
  variableCostPerStudentMonthTnd: 10,
  marginGates: { greenPct: 40, warningPct: 30 },
};

export async function getCommercialCostPolicy(): Promise<CommercialCostPolicy> {
  const row = await prisma.businessConfig.findUnique({
    where: { namespace_key: { namespace: COST_POLICY_NAMESPACE, key: COST_POLICY_KEY } },
  });
  if (!row) return DEFAULT_COST_POLICY;
  const parsed = storedCostPolicySchema.safeParse(row.value);
  if (!parsed.success) return DEFAULT_COST_POLICY;
  return { ...parsed.data, source: 'BUSINESS_CONFIG' };
}

/**
 * T1 — CANDIDAT INDIVIDUEL POLICY SAFETY CORE (direction decision
 * registry, commit 4ffaac8ed §2 "Gates de marge"): renamed from the
 * previous GREEN/WARNING/BLOCKED — margin < 30% -> BLOCKED,
 * 30% <= margin < 40% -> HUMAN_REVIEW_REQUIRED, margin >= 40% ->
 * MARGIN_OK. Not the dead 45%/55% constants in pricing-engine.ts.
 */
export type MarginGate = 'MARGIN_OK' | 'HUMAN_REVIEW_REQUIRED' | 'BLOCKED';

export interface MarginComputation {
  monthlyRevenueTnd: number;
  monthlyTeacherCostTnd: number;
  monthlyVariableCostTnd: number;
  monthlyContributionTnd: number;
  marginPct: number;
  gate: MarginGate;
}

export interface MarginCostBasisLine {
  subject: string;
  modality: 'GROUPE' | 'DUO' | 'INDIVIDUEL';
  hoursPerMonth: number;
  /** Exact confirmed cohort size when the effective modality remains GROUPE. */
  confirmedHeadcount?: number;
}

/**
 * Computes the contributive margin for a set of commercial quote lines.
 * A separate cost basis may be supplied for commercial lines that
 * deliberately aggregate teaching details (PACK) or amortize an annual
 * envelope (Grand Oral). This keeps the public line set unchanged while
 * preventing hidden teaching hours from becoming zero-cost. GROUPE/DUO
 * lines split the teacher's per-hour cost across the enrolled students
 * (assumed group size = 3, the opening minimum, as the conservative
 * floor — a fuller group only improves margin, never worsens it); an
 * INDIVIDUEL line bears the full per-hour teacher cost alone. PILOTAGE and
 * PILOTAGE carries no teacher hours.
 */
export function computeMargin(
  lines: RecommendedLine[],
  policy: CommercialCostPolicy,
  explicitCostBasis?: MarginCostBasisLine[],
): MarginComputation {
  const CONSERVATIVE_GROUP_SIZE = 3;

  const containsAggregatedTeaching = lines.some((line) =>
    line.modality === 'PACK'
    || (
      (line.modality === 'GROUPE' || line.modality === 'DUO' || line.modality === 'INDIVIDUEL')
      && line.hoursPerMonth == null
    ));
  if (containsAggregatedTeaching && (explicitCostBasis == null || explicitCostBasis.length === 0)) {
    throw new Error('Explicit margin cost basis required for aggregated teaching');
  }

  const monthlyRevenueTnd = lines.reduce((sum, l) => sum + l.unitPriceMonthly, 0);

  const costBasis: MarginCostBasisLine[] = explicitCostBasis ?? lines.flatMap((line) => {
    if (
      line.hoursPerMonth == null
      || line.hoursPerMonth === 0
      || (line.modality !== 'GROUPE' && line.modality !== 'DUO' && line.modality !== 'INDIVIDUEL')
    ) return [];
    return [{ subject: line.subject, modality: line.modality, hoursPerMonth: line.hoursPerMonth }];
  });

  const monthlyTeacherCostTnd = costBasis.reduce((sum, line) => {
    if (!Number.isFinite(line.hoursPerMonth) || line.hoursPerMonth < 0) {
      throw new Error(`Invalid margin cost hours for ${line.subject}`);
    }
    if (line.hoursPerMonth === 0) return sum;
    const hourlyCost = policy.teacherCostPerHourTnd;
    if (line.modality === 'GROUPE') {
      const divisor = line.confirmedHeadcount ?? CONSERVATIVE_GROUP_SIZE;
      if (!Number.isInteger(divisor) || divisor < CONSERVATIVE_GROUP_SIZE) {
        throw new Error(`Invalid confirmed group headcount for ${line.subject}`);
      }
      return sum + (hourlyCost * line.hoursPerMonth) / divisor;
    }
    if (line.modality === 'DUO') {
      if (line.confirmedHeadcount != null && line.confirmedHeadcount !== 2) {
        throw new Error(`Invalid confirmed duo headcount for ${line.subject}`);
      }
      return sum + (hourlyCost * line.hoursPerMonth) / 2;
    }
    if (line.modality === 'INDIVIDUEL') {
      if (line.confirmedHeadcount != null && line.confirmedHeadcount !== 1) {
        throw new Error(`Invalid confirmed individual headcount for ${line.subject}`);
      }
      return sum + hourlyCost * line.hoursPerMonth;
    }
    throw new Error(`Unknown margin cost modality for ${line.subject}`);
  }, 0);

  const monthlyVariableCostTnd = lines.length * policy.variableCostPerStudentMonthTnd;
  const monthlyContributionTnd = monthlyRevenueTnd - monthlyTeacherCostTnd - monthlyVariableCostTnd;
  const marginPct = monthlyRevenueTnd > 0 ? (monthlyContributionTnd / monthlyRevenueTnd) * 100 : 0;

  const gate: MarginGate =
    marginPct >= policy.marginGates.greenPct
      ? 'MARGIN_OK'
      : marginPct >= policy.marginGates.warningPct
        ? 'HUMAN_REVIEW_REQUIRED'
        : 'BLOCKED';

  return { monthlyRevenueTnd, monthlyTeacherCostTnd, monthlyVariableCostTnd, monthlyContributionTnd, marginPct, gate };
}
