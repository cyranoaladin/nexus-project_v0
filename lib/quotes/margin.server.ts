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

const costPolicySchema = z
  .object({
    teacherCostPerHourTnd: z.number().positive(),
    variableCostPerStudentMonthTnd: z.number().nonnegative(),
    marginGates: z.object({
      greenPct: z.number().min(0).max(100),
      warningPct: z.number().min(0).max(100),
    }),
  })
  .strict();

export type CommercialCostPolicy = z.infer<typeof costPolicySchema>;

/**
 * Safe default when no admin override exists yet in BusinessConfig — the
 * reference operational cost (~100 TND/h enseignant) per CDC §10. Never
 * exposed publicly; only ever read by this server-only module.
 */
const DEFAULT_COST_POLICY: CommercialCostPolicy = {
  teacherCostPerHourTnd: 100,
  variableCostPerStudentMonthTnd: 10,
  marginGates: { greenPct: 40, warningPct: 30 },
};

export async function getCommercialCostPolicy(): Promise<CommercialCostPolicy> {
  const row = await prisma.businessConfig.findUnique({
    where: { namespace_key: { namespace: COST_POLICY_NAMESPACE, key: COST_POLICY_KEY } },
  });
  if (!row) return DEFAULT_COST_POLICY;
  const parsed = costPolicySchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_COST_POLICY;
}

/** Admin-only write, always audited — see CDC §10/§29 ("toute dérogation direction doit être explicite, authentifiée et auditée"). */
export async function updateCommercialCostPolicy(
  next: CommercialCostPolicy,
  updatedByUserId: string,
): Promise<void> {
  const validated = costPolicySchema.parse(next);
  await prisma.$transaction(async (tx) => {
    const existing = await tx.businessConfig.findUnique({
      where: { namespace_key: { namespace: COST_POLICY_NAMESPACE, key: COST_POLICY_KEY } },
    });
    const nextVersion = (existing?.version ?? 0) + 1;
    // Round-trip through JSON so Prisma's nullable-Json input type accepts
    // the value regardless of whether it happens to contain a literal null.
    const previousValueInput = existing ? (JSON.parse(JSON.stringify(existing.value)) as object) : undefined;
    await tx.businessConfig.upsert({
      where: { namespace_key: { namespace: COST_POLICY_NAMESPACE, key: COST_POLICY_KEY } },
      create: {
        namespace: COST_POLICY_NAMESPACE,
        key: COST_POLICY_KEY,
        value: validated,
        schemaVersion: '1',
        version: 1,
        updatedBy: updatedByUserId,
      },
      update: {
        value: validated,
        previousValue: previousValueInput,
        version: nextVersion,
        updatedBy: updatedByUserId,
      },
    });
    await tx.businessConfigAudit.create({
      data: {
        namespace: COST_POLICY_NAMESPACE,
        key: COST_POLICY_KEY,
        oldValue: previousValueInput,
        newValue: validated,
        version: nextVersion,
        changedBy: updatedByUserId,
      },
    });
  });
}

export type MarginGate = 'GREEN' | 'WARNING' | 'BLOCKED';

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
      ? 'GREEN'
      : marginPct >= policy.marginGates.warningPct
        ? 'WARNING'
        : 'BLOCKED';

  return { monthlyRevenueTnd, monthlyTeacherCostTnd, monthlyVariableCostTnd, monthlyContributionTnd, marginPct, gate };
}
