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

/**
 * Computes the contributive margin for a set of quote lines. GROUPE/DUO
 * lines split the teacher's per-hour cost across the enrolled students
 * (assumed group size = 3, the opening minimum, as the conservative
 * floor — a fuller group only improves margin, never worsens it); an
 * INDIVIDUEL line bears the full per-hour teacher cost alone. PILOTAGE and
 * PACK lines carry no teacher hours and are priced at the policy's flat
 * variable cost only.
 */
export function computeMargin(lines: RecommendedLine[], policy: CommercialCostPolicy): MarginComputation {
  const CONSERVATIVE_GROUP_SIZE = 3;

  const monthlyRevenueTnd = lines.reduce((sum, l) => sum + l.unitPriceMonthly, 0);

  const monthlyTeacherCostTnd = lines.reduce((sum, l) => {
    if (l.hoursPerMonth == null || l.hoursPerMonth === 0) return sum;
    const hourlyCost = policy.teacherCostPerHourTnd;
    if (l.modality === 'GROUPE') return sum + (hourlyCost * l.hoursPerMonth) / CONSERVATIVE_GROUP_SIZE;
    if (l.modality === 'DUO') return sum + (hourlyCost * l.hoursPerMonth) / 2;
    if (l.modality === 'INDIVIDUEL') return sum + hourlyCost * l.hoursPerMonth;
    return sum;
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
