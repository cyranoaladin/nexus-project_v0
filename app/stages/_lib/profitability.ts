// ─────────────────────────────────────────────────────────────
// Profitability audit — internal tool for business model verification
// NOT rendered publicly. Used for auditing / CLI inspection.
// ─────────────────────────────────────────────────────────────

import {
  type Subject,
  calculateSubjectCost,
  MAX_STUDENTS,
} from "./business-config";
import {
  type Offer,
  type HoursBreakdown,
  type PortfolioRole,
  type ProfitabilityProfile,
  ALL_OFFERS,
} from "../_data/offers";

// ── Types ────────────────────────────────────────────────────

export interface ScenarioResult {
  students: number;
  revenue: number;
  teacherCost: number;
  margin: number;
  marginPercent: number;
  isProfitable: boolean;
}

export interface OfferAudit {
  id: string;
  title: string;
  level: string;
  category: string;
  hours: number;
  price: number;
  hoursBreakdown: HoursBreakdown;
  breakdownSum: number;
  breakdownValid: boolean;
  openingThreshold: number;
  roleInPortfolio: PortfolioRole;
  profitabilityProfile: ProfitabilityProfile;
  marketingPriority: number;
  priceReference?: number;
  saving?: number;
  savingValid: boolean;
  scenarios: ScenarioResult[];
  isProfitableAtThreshold: boolean;
}

// ── Core calculation ─────────────────────────────────────────

function calculateTeacherCost(
  breakdown: HoursBreakdown,
  students: number
): number {
  let total = 0;
  for (const [subject, hours] of Object.entries(breakdown)) {
    if (hours && hours > 0) {
      total += calculateSubjectCost(subject as Subject, hours, students);
    }
  }
  return total;
}

function sumBreakdown(breakdown: HoursBreakdown): number {
  return Object.values(breakdown).reduce((sum, h) => sum + (h ?? 0), 0);
}

// ── Single offer audit ───────────────────────────────────────

const STUDENT_SCENARIOS = [2, 3, 4, 5, 6] as const;

export function auditOffer(offer: Offer): OfferAudit {
  const breakdownSum = sumBreakdown(offer.hoursBreakdown);
  const breakdownValid = breakdownSum === offer.hours;

  const scenarios: ScenarioResult[] = STUDENT_SCENARIOS.map((students) => {
    const revenue = offer.price * students;
    const teacherCost = calculateTeacherCost(
      offer.hoursBreakdown,
      students
    );
    const margin = revenue - teacherCost;
    const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;
    return {
      students,
      revenue,
      teacherCost,
      margin,
      marginPercent: Math.round(marginPercent * 10) / 10,
      isProfitable: margin >= 0,
    };
  });

  const thresholdScenario = scenarios.find(
    (s) => s.students === offer.openingThreshold
  );

  // Validate priceReference / saving
  let savingValid = true;
  if (offer.priceReference != null && offer.saving != null) {
    savingValid = offer.priceReference - offer.price === offer.saving;
  }

  return {
    id: offer.id,
    title: offer.title,
    level: offer.level,
    category: offer.category,
    hours: offer.hours,
    price: offer.price,
    hoursBreakdown: offer.hoursBreakdown,
    breakdownSum,
    breakdownValid,
    openingThreshold: offer.openingThreshold,
    roleInPortfolio: offer.roleInPortfolio,
    profitabilityProfile: offer.profitabilityProfile,
    marketingPriority: offer.marketingPriority,
    priceReference: offer.priceReference,
    saving: offer.saving,
    savingValid,
    scenarios,
    isProfitableAtThreshold: thresholdScenario?.isProfitable ?? false,
  };
}

// ── Full audit ───────────────────────────────────────────────

export function auditAllOffers(): OfferAudit[] {
  return ALL_OFFERS.map(auditOffer);
}

// ── Text-based summary (caller decides where to output) ─────

export function formatAuditSummary(): string {
  const audits = auditAllOffers();
  const divider = "─".repeat(120);
  const lines: string[] = [];

  lines.push("\n" + divider);
  lines.push("  NEXUS RÉUSSITE — PROFITABILITY AUDIT");
  lines.push(divider);

  let hasIssues = false;

  for (const a of audits) {
    const tag = ` [${a.roleInPortfolio.toUpperCase()}] [${a.profitabilityProfile}] mktPrio=${a.marketingPriority}`;

    lines.push(`\n  ${a.id}${tag}`);
    lines.push(`  ${a.title} | ${a.hours}h | ${a.price} TND`);
    lines.push(
      `  Breakdown: ${JSON.stringify(a.hoursBreakdown)} = ${a.breakdownSum}h ${a.breakdownValid ? "✓" : "✗ MISMATCH"}`
    );

    if (a.priceReference) {
      lines.push(
        `  PriceRef: ${a.priceReference} | Saving: ${a.saving} ${a.savingValid ? "✓" : "✗ MISMATCH"}`
      );
    }

    lines.push(`  Threshold: ${a.openingThreshold} students | Max: ${MAX_STUDENTS}`);
    lines.push(
      `  ${"Students".padEnd(10)} ${"Revenue".padEnd(12)} ${"Cost".padEnd(12)} ${"Margin".padEnd(12)} ${"Margin%".padEnd(10)} ${"OK"}`
    );

    for (const s of a.scenarios) {
      const marker =
        s.students === a.openingThreshold
          ? s.isProfitable
            ? " ← THRESHOLD ✓"
            : " ← THRESHOLD ✗ DEFICIT"
          : "";
      lines.push(
        `  ${String(s.students).padEnd(10)} ${String(s.revenue).padEnd(12)} ${String(s.teacherCost).padEnd(12)} ${String(s.margin).padEnd(12)} ${(s.marginPercent + "%").padEnd(10)} ${s.isProfitable ? "✓" : "✗"}${marker}`
      );
    }

    if (!a.breakdownValid) {
      lines.push(`  ⚠️  HOURS MISMATCH: breakdown=${a.breakdownSum} vs displayed=${a.hours}`);
      hasIssues = true;
    }
    if (!a.savingValid) {
      lines.push(`  ⚠️  SAVING MISMATCH: ref=${a.priceReference} - price=${a.price} ≠ saving=${a.saving}`);
      hasIssues = true;
    }
    if (!a.isProfitableAtThreshold) {
      lines.push(`  ⚠️  DEFICIT AT THRESHOLD (${a.openingThreshold} students)`);
      hasIssues = true;
    }
  }

  lines.push("\n" + divider);
  lines.push(
    hasIssues
      ? "  ⚠️  ISSUES FOUND — review items marked above"
      : "  ✅ ALL OFFERS PASS AUDIT"
  );
  lines.push(divider + "\n");

  return lines.join("\n");
}
