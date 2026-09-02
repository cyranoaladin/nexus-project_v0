/**
 * Server-only contributive margin engine (CDC §10; cost model per mission
 * "fair go-live" Phase F/I7 — BLOQUANT before any real staff quote).
 *
 * Reads the commercial cost policy from BusinessConfig (namespace
 * "quotes.costPolicy") — never from a component, never from the
 * versioned public data/pricing.canonical.json. This module must never be
 * imported by anything that can reach a public DTO: teacher cost and
 * margin never leave the server (enforced by __tests__/lib/quotes/margin.test.ts,
 * which asserts the public RecommendationResult/QuoteScenario shapes have
 * no cost/margin fields at all).
 *
 * Cost model (mission Phase F, formalizing the decomposed hypothesis
 * already recorded and sensitivity-tested in docs/candidat-individuel/
 * gouvernance-vs-hypotheses-couts-lot-fermeture-p11-p3.md §"Table B"):
 *   - teacherNominalCostPerHourTnd: 50 TND/h delivered (enseignant certifié).
 *   - structureCostPerHourTnd: 15 TND/h delivered (plateforme/support).
 *   - oneOffDossierCostTnd: 120 TND, subtracted EXACTLY ONCE per quote —
 *     never amortized across months or multiplied by line count.
 *   - deliveryCostPerHourTnd = teacherCostPerHourTnd + structureCostPerHourTnd.
 *   - TEACHER_FALLBACK_COST_PER_HOUR_TND (100 TND/h) is used only when the
 *     resolved nominal rate is itself missing/invalid at compute time — a
 *     defensive guard, not a second policy source.
 * marginPct = (annualRevenue − annualTeachingDeliveryCost − oneOffDossierCost)
 *   / annualRevenue — computed at the ANNUAL level (never monthly) because a
 *   one-off cost divided across months would understate its real weight on
 *   a partial-year projection.
 */
import 'server-only';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { RecommendedLine } from './schemas';
import { SERVICE_MONTHS_PER_SCHOOL_YEAR } from './pricing-engine';

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
    teacherNominalCostPerHourTnd: z.number().positive(),
    structureCostPerHourTnd: z.number().nonnegative(),
    oneOffDossierCostTnd: z.number().nonnegative(),
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
 * POLICY below — despite the historical name, this is now the decomposed
 * governed default per mission Phase F, kept for audit-trail continuity
 * with every prior "source" record rather than a cosmetic rename),
 * `BUSINESS_CONFIG` when a real, valid row was read from the governed
 * `quotes.costPolicy` namespace (e.g. a future differentiated agrégé/
 * certifié/tuteur rate).
 */
export type CommercialCostPolicy = z.infer<typeof storedCostPolicySchema> & {
  source: 'BLENDED_FALLBACK' | 'BUSINESS_CONFIG';
};

/**
 * Governed default when no admin override exists yet in BusinessConfig —
 * the decomposed cost hypothesis (Table B, gouvernance-vs-hypotheses-couts
 * doc) formalized as the operative policy by mission "fair go-live" Phase F.
 * Never exposed publicly; only ever read by this server-only module.
 */
const DEFAULT_COST_POLICY: CommercialCostPolicy = {
  source: 'BLENDED_FALLBACK',
  teacherNominalCostPerHourTnd: 50,
  structureCostPerHourTnd: 15,
  oneOffDossierCostTnd: 120,
  marginGates: { greenPct: 40, warningPct: 30 },
};

/**
 * Used only when the resolved teacherNominalCostPerHourTnd is itself
 * missing/invalid at compute time (defensive — never reachable through
 * DEFAULT_COST_POLICY or a schema-valid BusinessConfig row, both of which
 * already require a positive number; guards a hand-built policy object
 * from a future caller that skips validation).
 */
const TEACHER_FALLBACK_COST_PER_HOUR_TND = 100;

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

export interface MarginLineCost {
  subject: RecommendedLine['subject'];
  /** The headcount this line's delivery cost was actually divided by — 1 (SOLO/INDIVIDUEL), 2 (DUO), or the real confirmedHeadcount (GROUPE). Recorded for audit (mission: "snapshot must record ... headcounts"). */
  headcount: number;
  hoursPerMonth: number;
  monthlyDeliveryCostTnd: number;
}

export interface MarginComputation {
  annualRevenueTnd: number;
  annualTeachingDeliveryCostTnd: number;
  oneOffDossierCostTnd: number;
  annualContributionTnd: number;
  marginPct: number;
  gate: MarginGate;
  /** The teacher rate actually used this computation — the policy's nominal rate, or TEACHER_FALLBACK_COST_PER_HOUR_TND if that rate was itself invalid. Recorded for audit (mission: "cost source/provenance"). */
  teacherCostPerHourTndUsed: number;
  teacherCostSource: 'NOMINAL' | 'FALLBACK';
  structureCostPerHourTnd: number;
  lineCosts: MarginLineCost[];
}

/**
 * Conservative headcount used to project a line's delivery cost BEFORE any
 * real headcount is confirmed (e.g. /api/quotes/margin's pre-enrollment
 * preview) — GROUPE defaults to the catalogue's own opening minimum (3,
 * data/pricing.canonical.json's min_group_open — a fuller group only
 * improves margin, never worsens it), DUO to 2, anything else (SOLO/
 * INDIVIDUEL/PILOTAGE) to 1. Once a real confirmedHeadcount is known (the
 * staff quote-creation route, post resolveScenarioEffectiveGroupPricing),
 * headcountBySubject overrides this per mission Phase F: "GROUPE split by
 * confirmedHeadcount", never a fixed conservative floor.
 */
const CONSERVATIVE_GROUP_SIZE_PROJECTION = 3;

function effectiveHeadcountForLine(line: RecommendedLine, headcountBySubject: Record<string, number> | undefined): number {
  const confirmed = headcountBySubject?.[line.subject];
  if (confirmed != null) return confirmed;
  if (line.modality === 'DUO') return 2;
  if (line.modality === 'GROUPE') return CONSERVATIVE_GROUP_SIZE_PROJECTION;
  return 1; // SOLO/INDIVIDUEL (and any other modality carrying hours) always bears its own delivery cost alone.
}

/**
 * Computes the contributive margin for a set of quote lines, at the ANNUAL
 * level (mission Phase F: marginPct = (annualRevenue −
 * annualTeachingDeliveryCost − oneOffDossierCost) / annualRevenue — never
 * monthly, since a one-off cost divided across months would understate its
 * real weight). Delivery cost per hour = teacherCost + structureCost,
 * allocated per line by headcount: SOLO/INDIVIDUEL bears it alone, DUO
 * splits between 2, GROUPE splits by the real confirmedHeadcount when
 * known (headcountBySubject), else the conservative catalogue-minimum
 * projection. PILOTAGE/PACK lines carry no delivery hours and cost
 * nothing beyond the one-off dossier fee already subtracted once.
 */
export function computeMargin(
  lines: RecommendedLine[],
  policy: CommercialCostPolicy,
  headcountBySubject?: Record<string, number>,
): MarginComputation {
  const teacherNominalValid = Number.isFinite(policy.teacherNominalCostPerHourTnd) && policy.teacherNominalCostPerHourTnd > 0;
  const teacherCostPerHourTndUsed = teacherNominalValid ? policy.teacherNominalCostPerHourTnd : TEACHER_FALLBACK_COST_PER_HOUR_TND;
  const teacherCostSource: 'NOMINAL' | 'FALLBACK' = teacherNominalValid ? 'NOMINAL' : 'FALLBACK';
  const structureCostPerHourTnd = Number.isFinite(policy.structureCostPerHourTnd) && policy.structureCostPerHourTnd >= 0 ? policy.structureCostPerHourTnd : 0;
  const deliveryCostPerHourTnd = teacherCostPerHourTndUsed + structureCostPerHourTnd;

  const monthlyRevenueTnd = lines.reduce((sum, l) => sum + l.unitPriceMonthly, 0);

  const lineCosts: MarginLineCost[] = [];
  const monthlyDeliveryCostTnd = lines.reduce((sum, l) => {
    if (l.hoursPerMonth == null || l.hoursPerMonth === 0) return sum;
    const headcount = effectiveHeadcountForLine(l, headcountBySubject);
    const cost = (deliveryCostPerHourTnd * l.hoursPerMonth) / headcount;
    lineCosts.push({ subject: l.subject, headcount, hoursPerMonth: l.hoursPerMonth, monthlyDeliveryCostTnd: cost });
    return sum + cost;
  }, 0);

  const annualRevenueTnd = monthlyRevenueTnd * SERVICE_MONTHS_PER_SCHOOL_YEAR;
  const annualTeachingDeliveryCostTnd = monthlyDeliveryCostTnd * SERVICE_MONTHS_PER_SCHOOL_YEAR;
  const oneOffDossierCostTnd = Number.isFinite(policy.oneOffDossierCostTnd) && policy.oneOffDossierCostTnd >= 0 ? policy.oneOffDossierCostTnd : 0;
  const annualContributionTnd = annualRevenueTnd - annualTeachingDeliveryCostTnd - oneOffDossierCostTnd;
  const marginPct = annualRevenueTnd > 0 ? (annualContributionTnd / annualRevenueTnd) * 100 : 0;

  const gate: MarginGate =
    marginPct >= policy.marginGates.greenPct
      ? 'MARGIN_OK'
      : marginPct >= policy.marginGates.warningPct
        ? 'HUMAN_REVIEW_REQUIRED'
        : 'BLOCKED';

  return {
    annualRevenueTnd,
    annualTeachingDeliveryCostTnd,
    oneOffDossierCostTnd,
    annualContributionTnd,
    marginPct,
    gate,
    teacherCostPerHourTndUsed,
    teacherCostSource,
    structureCostPerHourTnd,
    lineCosts,
  };
}
