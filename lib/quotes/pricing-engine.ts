/**
 * Candidat-individuel pricing engine — Phase A (structural), mission Lot 5
 * §7. Resolves catalogue modules (lib/quotes/catalogue.ts) into priced
 * lines using ONLY the existing rate table (candidat_individuel_modules)
 * and payment rules (rules.payment/discounts) — never a second price
 * source, never an invented rate. Refuses every DIRECTION_A_VALIDER
 * element structurally (throws, never silently prices it).
 *
 * Cost/margin inputs are NOT wired to any real quote here — Phase B
 * (calibration commerciale) hypotheses live in a clearly-labeled,
 * non-contractual constant at the bottom of this file, usable only for
 * simulation, never for a definitive emission.
 */
import 'server-only';
import { getCandidatIndividuelModules, getRules } from '@/lib/pricing';
import {
  coverageItemsForSelection,
  detectDoubleBilling,
  type CatalogueSelection,
  type ResolvedCatalogueModule,
} from './catalogue';
import { computeCandidatLibreSchedule, type CandidatLibreSchedule } from './pricing';
import type { PricingRuleId } from './catalogue-schema';
import { matchCanonicalPack } from './recommendation';
import type { QuoteScenario, RecommendedLine } from './schemas';

type PackMatch = NonNullable<ReturnType<typeof matchCanonicalPack>>;

export class UnapprovedCatalogueElementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnapprovedCatalogueElementError';
  }
}

export class NoCostDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoCostDataError';
  }
}

export class DoubleBillingDetectedError extends Error {
  constructor(public readonly issues: ReturnType<typeof detectDoubleBilling>) {
    super(`Double billing detected: ${issues.map((i) => i.explanation).join(' | ')}`);
    this.name = 'DoubleBillingDetectedError';
  }
}

export class DiscountRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscountRejectedError';
  }
}

export class MarginTooLowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarginTooLowError';
  }
}

/**
 * A quote assembled over a school year in candidat-individuel — 10 months
 * (matches the existing convention already used throughout lib/quotes/,
 * e.g. QuoteScenario.months, the 6 canonical offers' price_annual /
 * hours_per_month × price_per_student_monthly ratio). Not a new invented
 * constant — reused from the established business model.
 */
export const SERVICE_MONTHS_PER_SCHOOL_YEAR = 10;

// ── Rate resolution (mission §7 "résolution des règles tarifaires") ──

export interface ResolvedRate {
  pricingRuleId: PricingRuleId;
  kind: 'flat_monthly' | 'hourly_tier_monthly' | 'per_hour';
  amountTnd: number;
  hoursPerMonth?: number;
  groupMinOpen?: number;
  groupMax?: number;
}

export function resolveRate(pricingRuleId: PricingRuleId): ResolvedRate {
  const modules = getCandidatIndividuelModules();
  switch (pricingRuleId) {
    case 'PILOTAGE_MONTHLY':
      return { pricingRuleId, kind: 'flat_monthly', amountTnd: modules.pilotage.price_monthly };
    case 'PETIT_GROUPE_4H':
    case 'PETIT_GROUPE_8H':
    case 'PETIT_GROUPE_12H': {
      const hours = { PETIT_GROUPE_4H: 4, PETIT_GROUPE_8H: 8, PETIT_GROUPE_12H: 12 }[pricingRuleId];
      const tier = modules.petit_groupe.find((t) => t.hours_per_month === hours);
      if (!tier) throw new NoCostDataError(`No petit_groupe tier at ${hours}h/month in candidat_individuel_modules for ${pricingRuleId}`);
      return {
        pricingRuleId,
        kind: 'hourly_tier_monthly',
        amountTnd: tier.price_per_student_monthly,
        hoursPerMonth: tier.hours_per_month,
        groupMinOpen: tier.group_min_open,
        groupMax: tier.group_max,
      };
    }
    case 'DUO_HOUR':
      return { pricingRuleId, kind: 'per_hour', amountTnd: modules.duo.price_per_hour_per_student };
    case 'INDIVIDUEL_HOUR_MIN':
      return { pricingRuleId, kind: 'per_hour', amountTnd: modules.individuel.price_per_hour_min };
  }
}

// ── Effectif / bascule DUO-SOLO (mission §9) ──

export type GroupModality = 'GROUPE' | 'DUO' | 'SOLO';

export interface ModalityResolution {
  modality: GroupModality;
  monthlyAmountTnd: number;
  explanation: string;
}

/**
 * Given a petit_groupe tier's effectif thresholds and the number of
 * candidates actually available for that discipline, decides whether the
 * group opens as-is, bascule to DUO (2 élèves), or SOLO (1 élève) — never
 * silently prices a group rate for an effectif that never reaches
 * group_min_open.
 */
export function resolveGroupModality(effectif: number, hoursPerMonth: number, tier: ResolvedRate): ModalityResolution {
  if (tier.kind !== 'hourly_tier_monthly' || tier.groupMinOpen == null) {
    throw new NoCostDataError('resolveGroupModality requires an hourly_tier_monthly rate with groupMinOpen');
  }
  // T2 — CANDIDAT INDIVIDUEL HEADCOUNT & GROUP STATE SAFETY: an invalid
  // effectif (0, negative, fractional) must never silently fall through
  // to the SOLO branch below (it previously did, matching neither the
  // GROUPE nor the DUO condition) — that would mean an unconfirmed or
  // malformed headcount gets billed as a confirmed single-student SOLO.
  if (!Number.isInteger(effectif) || effectif <= 0) {
    throw new NoCostDataError(`resolveGroupModality requires a positive integer effectif, received: ${effectif}`);
  }
  if (effectif >= tier.groupMinOpen) {
    return {
      modality: 'GROUPE',
      monthlyAmountTnd: tier.amountTnd,
      explanation: `Effectif ${effectif} >= seuil d'ouverture ${tier.groupMinOpen} — groupe ouvert au tarif ${tier.pricingRuleId}.`,
    };
  }
  if (effectif === 2) {
    const duo = resolveRate('DUO_HOUR');
    return {
      modality: 'DUO',
      monthlyAmountTnd: duo.amountTnd * hoursPerMonth,
      explanation: `Effectif 2 < seuil ${tier.groupMinOpen} — bascule DUO (${duo.amountTnd} TND/h/élève × ${hoursPerMonth}h).`,
    };
  }
  const individuel = resolveRate('INDIVIDUEL_HOUR_MIN');
  return {
    modality: 'SOLO',
    monthlyAmountTnd: individuel.amountTnd * hoursPerMonth,
    explanation: `Effectif ${effectif} < seuil ${tier.groupMinOpen}, non DUO — bascule individuel (${individuel.amountTnd} TND/h min × ${hoursPerMonth}h).`,
  };
}

// ── T2 — CANDIDAT INDIVIDUEL HEADCOUNT & GROUP STATE SAFETY (direction
// decision registry, commit 4ffaac8ed) — resolves a scenario's GROUPE
// line(s) against a confirmed headcount, reusing resolveGroupModality
// (never a second resolution engine) and computeCandidatLibreSchedule
// (the same D4 schedule pipeline.ts already uses). ──

export class InvalidConfirmedHeadcountError extends Error {
  constructor(subject: string, value: unknown) {
    super(`confirmedHeadcountBySubject["${subject}"] must be a positive integer, received: ${JSON.stringify(value)}`);
    this.name = 'InvalidConfirmedHeadcountError';
  }
}

/**
 * T2-closeout item 1 (post-294a885d6): GROUP_CONFIRMED means the group
 * actually materialized (effectiveModality === 'GROUPE',
 * confirmedHeadcount >= group_min_open) — never SOLO/DUO, which are a
 * different product, not "a confirmed group". Those resolve to
 * NOT_APPLICABLE instead, reusing the existing state rather than
 * inventing a fourth one.
 */
export type GroupPricingState = 'NOT_APPLICABLE' | 'GROUP_PENDING' | 'GROUP_CONFIRMED';

export interface GroupLineResolution {
  subject: RecommendedLine['subject'];
  requestedModality: 'GROUPE';
  /** The exact headcount this specific line was resolved with — always this subject's own entry, never another's. */
  confirmedHeadcount: number;
  effectiveModality: GroupModality;
  /** true iff effectiveModality === 'GROUPE' (equivalently: confirmedHeadcount >= group_min_open) — the per-line form of the GROUP_CONFIRMED invariant. */
  groupConfirmed: boolean;
}

export interface EffectiveGroupPricingResult {
  state: GroupPricingState;
  lines: RecommendedLine[];
  monthlyTotal: number;
  grandTotal: number;
  deposit: number;
  lastInstallmentAmount: number;
  groupLineResolutions: GroupLineResolution[];
}

const PETIT_GROUPE_RULE_BY_HOURS: Record<number, PricingRuleId> = {
  4: 'PETIT_GROUPE_4H',
  8: 'PETIT_GROUPE_8H',
  12: 'PETIT_GROUPE_12H',
};

/**
 * The single source of truth for "what does this candidate actually pay
 * and what margin does that represent" once real headcounts are known.
 * Never invoked by buildCandidateQuoteRecommendation (pipeline.ts) —
 * that function still produces the "requested"/"planned" scenario at the
 * catalogue GROUPE rate, an intention, not a commitment. This function is
 * the confirmation step, called only once headcounts are actually known.
 *
 * T2-closeout item 2 (post-294a885d6): HEADCOUNT_CARDINALITY =
 * PER_GROUP_HEADCOUNT_REQUIRED. Independent subjects (Maths, LVA, LVB...)
 * are independent cohorts in the real product — a single scenario-wide
 * headcount was a domain modeling error present in the first T2 cut.
 * `confirmedHeadcountBySubject` is keyed by RecommendedLine.subject — the
 * stable identity that already exists (catalogue.modules maps 1:1 to
 * distinct subjectIds via MODULE_LEGACY_MAPPING, so `subject` is unique
 * per scenario line; verified, no new identity invented). A GROUPE line
 * is resolved using ONLY its own subject's entry — a headcount for one
 * subject is never applied to another, and an entry for a subject the
 * scenario doesn't contain is silently ignored (never misapplied).
 *
 * - No GROUPE-modality line and no PACK-carried group requirement in the
 *   scenario -> NOT_APPLICABLE (Pilotage-only or all-INDIVIDUEL like P11).
 * - At least one GROUPE line's subject has no entry in
 *   confirmedHeadcountBySubject -> GROUP_PENDING for the WHOLE scenario —
 *   all-or-nothing, never a partial Quote where some subjects are priced
 *   and others silently assumed. Lines/totals are returned unchanged.
 * - Every GROUPE line's subject has a valid, positive-integer headcount:
 *   each is resolved independently via resolveGroupModality.
 *   headcount>=group_min_open stays GROUPE at the unchanged catalogue
 *   rate (the existing conservative floor for margin is untouched);
 *   headcount===2 bascules to the real DUO rate; headcount===1 bascules
 *   to the real INDIVIDUEL rate. Scenario state is GROUP_CONFIRMED iff at
 *   least one line actually resolved to GROUPE, else NOT_APPLICABLE (every
 *   GROUPE-intention line resolved away to SOLO/DUO). Totals are
 *   recomputed via computeCandidatLibreSchedule only if a line's price
 *   actually changed.
 *
 * Throws InvalidConfirmedHeadcountError for 0, negative, or fractional
 * input — never silently treated as "3" or as SOLO.
 */
export function resolveScenarioEffectiveGroupPricing(
  scenario: Pick<
    QuoteScenario,
    'lines' | 'months' | 'monthlyTotal' | 'grandTotal' | 'deposit' | 'lastInstallmentAmount' | 'groupHeadcountRequirements'
  >,
  confirmedHeadcountBySubject: Record<string, number> | null | undefined,
): EffectiveGroupPricingResult {
  const passthrough = (state: GroupPricingState, groupLineResolutions: GroupLineResolution[] = []): EffectiveGroupPricingResult => ({
    state,
    lines: scenario.lines,
    monthlyTotal: scenario.monthlyTotal,
    grandTotal: scenario.grandTotal,
    deposit: scenario.deposit,
    lastInstallmentAmount: scenario.lastInstallmentAmount,
    groupLineResolutions,
  });

  const groupeLines = scenario.lines.filter((l) => l.modality === 'GROUPE');
  const groupInputs = groupeLines.length > 0 ? groupeLines : (scenario.groupHeadcountRequirements ?? []);
  if (groupInputs.length === 0) return passthrough('NOT_APPLICABLE');

  const headcountMap = confirmedHeadcountBySubject ?? {};
  const anyMissing = groupInputs.some((line) => !(line.subject in headcountMap));
  if (anyMissing) return passthrough('GROUP_PENDING');

  for (const line of groupInputs) {
    const value = headcountMap[line.subject];
    if (!Number.isInteger(value) || value <= 0) {
      throw new InvalidConfirmedHeadcountError(line.subject, value);
    }
  }

  const modules = getCandidatIndividuelModules();
  const resolveGroupInput = (line: typeof groupInputs[number]) => {
    const confirmedHeadcount = headcountMap[line.subject];
    const hours = line.hoursPerMonth ?? 0;
    const syntheticTier: ResolvedRate = {
      pricingRuleId: PETIT_GROUPE_RULE_BY_HOURS[hours] ?? 'PETIT_GROUPE_8H',
      kind: 'hourly_tier_monthly',
      amountTnd: line.unitPriceMonthly,
      hoursPerMonth: hours,
      groupMinOpen: modules.min_group_open,
      groupMax: modules.max_group_size,
    };
    const resolution = resolveGroupModality(confirmedHeadcount, hours, syntheticTier);
    const lineResolution: GroupLineResolution = {
      subject: line.subject,
      requestedModality: 'GROUPE',
      confirmedHeadcount,
      effectiveModality: resolution.modality,
      groupConfirmed: resolution.modality === 'GROUPE',
    };
    return { resolution, lineResolution };
  };

  if (groupeLines.length === 0) {
    const groupLineResolutions = groupInputs.map((line) => resolveGroupInput(line).lineResolution);
    const state: GroupPricingState = groupLineResolutions.some((resolution) => resolution.groupConfirmed)
      ? 'GROUP_CONFIRMED'
      : 'NOT_APPLICABLE';
    return passthrough(state, groupLineResolutions);
  }

  const groupLineResolutions: GroupLineResolution[] = [];
  const newLines = scenario.lines.map((line): RecommendedLine => {
    if (line.modality !== 'GROUPE') return line;
    const { resolution, lineResolution } = resolveGroupInput(line);
    groupLineResolutions.push(lineResolution);
    if (resolution.modality === 'GROUPE') return line;
    return {
      ...line,
      modality: resolution.modality === 'SOLO' ? 'INDIVIDUEL' : 'DUO',
      unitPriceMonthly: resolution.monthlyAmountTnd,
      reason: `${line.reason} — ${resolution.explanation}`,
    };
  });

  const anyGroupConfirmed = groupLineResolutions.some((r) => r.groupConfirmed);
  const state: GroupPricingState = anyGroupConfirmed ? 'GROUP_CONFIRMED' : 'NOT_APPLICABLE';

  const anyLineChanged = groupLineResolutions.some((r) => r.effectiveModality !== 'GROUPE');
  if (!anyLineChanged) {
    return { ...passthrough(state), groupLineResolutions };
  }

  const monthlyTotalRaw = newLines.reduce((sum, l) => sum + l.unitPriceMonthly, 0);
  const grandTotal = monthlyTotalRaw * scenario.months;
  const schedule = computeCandidatLibreSchedule(grandTotal);
  return {
    state,
    lines: newLines,
    monthlyTotal: schedule.installmentAmount,
    grandTotal,
    deposit: schedule.deposit,
    lastInstallmentAmount: schedule.lastInstallmentAmount,
    groupLineResolutions,
  };
}

// ── Module → priced line (mission §7 "calcul par modalité", §8 refus des éléments non approuvés) ──

export interface PricedLine {
  id: string;
  label: string;
  coverageKey: string;
  monthlyAmountTnd: number;
  hoursPerMonth: number | null;
  explanation: string;
}

export function priceSelectedModule(m: ResolvedCatalogueModule): PricedLine {
  if (m.status !== 'SELECTED') {
    throw new UnapprovedCatalogueElementError(`${m.moduleId}: status=${m.status}, only a SELECTED module can be priced`);
  }
  if (m.directionApprovalStatus !== 'APPROVED') {
    throw new UnapprovedCatalogueElementError(
      `${m.moduleId} is DIRECTION_A_VALIDER — cannot enter a definitive quote (mission §2/§8 règle de blocage)`,
    );
  }
  if (m.pricingRuleId == null) {
    if (m.inclusionPolicy === 'inclus_uniquement') {
      return {
        id: m.moduleId,
        label: m.label,
        coverageKey: m.coverageKey,
        monthlyAmountTnd: 0,
        hoursPerMonth: null,
        explanation: `${m.label} inclus dans un forfait/pack — non facturé séparément.`,
      };
    }
    throw new NoCostDataError(`${m.moduleId}: no pricingRuleId and not inclus_uniquement — cannot be priced`);
  }
  const rate = resolveRate(m.pricingRuleId);
  if (rate.kind === 'per_hour') {
    throw new NoCostDataError(
      `${m.moduleId}: per-hour rate ${m.pricingRuleId} needs an explicit effectif via resolveGroupModality — not directly priceable`,
    );
  }
  return {
    id: m.moduleId,
    label: m.label,
    coverageKey: m.coverageKey,
    monthlyAmountTnd: rate.amountTnd,
    hoursPerMonth: rate.kind === 'hourly_tier_monthly' ? rate.hoursPerMonth! : null,
    explanation: `${m.pricingRuleId} -> ${rate.amountTnd} TND/mois (candidat_individuel_modules).`,
  };
}

export function pricePilotage(): PricedLine {
  const rate = resolveRate('PILOTAGE_MONTHLY');
  return {
    id: 'SVC_PILOTAGE',
    label: 'Pilotage Nexus',
    coverageKey: 'PILOTAGE_REGLEMENTAIRE',
    monthlyAmountTnd: rate.amountTnd,
    hoursPerMonth: null,
    explanation: `PILOTAGE_MONTHLY -> ${rate.amountTnd} TND/mois.`,
  };
}

// ── Full selection pricing (mission §7 "coûts... anti-double-facturation... snapshots") ──

export interface PricedQuote {
  lines: PricedLine[];
  monthlyTotalTnd: number;
  annualTotalTnd: number;
  schedule: CandidatLibreSchedule;
  explanations: string[];
}

/**
 * Prices every SELECTED module in a resolved catalogue selection, plus
 * Pilotage when included. Throws (never silently degrades) if: any
 * DIRECTION_A_VALIDER element is present among the priceable set, or the
 * resulting line set double-bills a coverageKey (mission §5/§6 anti-
 * double-facturation — reuses detectDoubleBilling, never re-implemented).
 */
export function priceSelection(selection: CatalogueSelection): PricedQuote {
  const lines: PricedLine[] = [];
  if (selection.pilotageIncluded) lines.push(pricePilotage());
  for (const m of selection.modules) {
    if (m.status !== 'SELECTED') continue;
    lines.push(priceSelectedModule(m));
  }

  const coverageItems = coverageItemsForSelection(selection);
  const doubleBillingIssues = detectDoubleBilling(coverageItems);
  if (doubleBillingIssues.length > 0) throw new DoubleBillingDetectedError(doubleBillingIssues);

  const monthlyTotalTnd = lines.reduce((sum, l) => sum + l.monthlyAmountTnd, 0);
  const annualTotalTnd = monthlyTotalTnd * SERVICE_MONTHS_PER_SCHOOL_YEAR;
  const schedule = computeCandidatLibreSchedule(annualTotalTnd);

  return {
    lines,
    monthlyTotalTnd,
    annualTotalTnd,
    schedule,
    explanations: lines.map((l) => l.explanation),
  };
}

// ── P11 (second groupe) payment — mission §6, 100% à la réservation ──

export interface SecondGroupePayment {
  totalTnd: number;
  depositTnd: number;
  remainingTnd: number;
  nInstallments: 1;
}

/**
 * Aucun acompte annuel, aucune mensualité — paiement intégral avant la
 * prestation, distinct du schéma 25%/10 mensualités annuel
 * (computeCandidatLibreSchedule). Décision de direction, mission §6.
 */
export function computeSecondGroupePayment(totalTnd: number): SecondGroupePayment {
  return { totalTnd, depositTnd: totalTnd, remainingTnd: 0, nInstallments: 1 };
}

/**
 * P11 (SVC_SECOND_GROUPE) volumes — mission "vers un produit complet",
 * 14-arbitrages dossier (docs/candidat-individuel/dossier-decisionnel-14-
 * elements.md #14): 6h/10h/16h total across 2 disciplines
 * (3h/5h/8h per discipline). NOT re-derived here — copied from the one
 * place this volume grid is sourced, so a future price-policy change to
 * that document is the only place that needs to change.
 */
const SECOND_GROUPE_HOURS_BY_TIER: Record<import('./schemas').ScenarioTier, number> = {
  ESSENTIEL: 6,
  RECOMMANDE: 10,
  COMPLET: 16,
};

/**
 * Builds the 3 P11 (second groupe) scenarios — mission "vers un produit
 * complet", lot de fermeture P11. Pure computation only: this function
 * does NOT check SVC_SECOND_GROUPE.directionApprovalStatus (the caller,
 * lib/quotes/pipeline.ts, gates on that BEFORE calling this — same
 * pattern as every DIRECTION_A_VALIDER module, checked in
 * lib/quotes/catalogue.ts::resolveModule, never inside the pricing
 * function itself). Calling this with an unapproved service would price
 * a P11 quote nobody may sell yet — the pipeline's gate exists precisely
 * so this never happens outside a disposable-DB test fixture.
 *
 * Reuses lib/quotes/pricing-engine.ts::resolveRate('INDIVIDUEL_HOUR_MIN')
 * — the SAME existing, already-used individuel hourly rate every other
 * individuel-delivery module already resolves through (data/pricing.
 * canonical.json's `SVC_SECOND_GROUPE.pricingRuleId` now points at it —
 * a data correction, not a price invention: the 14-arbitrages dossier
 * already proposed reusing this exact existing rate).
 */
export function buildSecondGroupeScenarios(): import('./schemas').QuoteScenario[] {
  const rate = resolveRate('INDIVIDUEL_HOUR_MIN');
  return (['ESSENTIEL', 'RECOMMANDE', 'COMPLET'] as const).map((tier) => {
    const hours = SECOND_GROUPE_HOURS_BY_TIER[tier];
    const totalTnd = hours * rate.amountTnd;
    const payment = computeSecondGroupePayment(totalTnd);
    return {
      tier,
      lines: [
        {
          subject: 'second-groupe' as const,
          label: 'Rattrapage second groupe — 2 disciplines',
          modality: 'INDIVIDUEL' as const,
          hoursPerMonth: hours,
          unitPriceMonthly: totalTnd,
          priorityScore: Number.MAX_SAFE_INTEGER,
          priorityLabel: 'haute' as const,
          reason: `${hours}h de rattrapage (${hours / 2}h/discipline) sur les 2 disciplines du second groupe, ${rate.amountTnd} TND/h (tarif individuel existant réutilisé).`,
        },
      ],
      notRecommended: [],
      monthlyTotal: totalTnd,
      grandTotal: totalTnd,
      months: 1,
      matchedOfferId: null,
      paymentPolicy: 'PAY_IN_FULL_AT_BOOKING' as const,
      deposit: payment.depositTnd,
      lastInstallmentAmount: payment.remainingTnd,
    };
  });
}

// ── Prix plancher (mission §7/§9) ──

export function checkFloor(hourlyRateTnd: number, floorType: keyof ReturnType<typeof getRules>['price_floor_per_student_hour_tnd']): {
  ok: boolean;
  floorTnd: number;
} {
  const floorTnd = getRules().price_floor_per_student_hour_tnd[floorType];
  return { ok: hourlyRateTnd >= floorTnd, floorTnd };
}

// ── Remises (mission §7/§9 — plafond 20%, non cumulables) ──

export interface DiscountInput {
  label: string;
  pct: number;
}

/** Throws if the cumulative pct exceeds the 20% cap, or if more than one discount is applied while rules.discounts.cumulable is false. */
export function applyDiscounts(baseAmountTnd: number, discounts: DiscountInput[]): { finalAmountTnd: number; appliedPct: number } {
  const rules = getRules().discounts;
  if (discounts.length > 1 && !rules.cumulable) {
    throw new DiscountRejectedError(
      `${discounts.length} remises simultanées demandées (${discounts.map((d) => d.label).join(', ')}) — non cumulables sauf décision exceptionnelle de la direction.`,
    );
  }
  const appliedPct = discounts.reduce((sum, d) => sum + d.pct, 0);
  if (appliedPct > rules.global_cap_pct) {
    throw new DiscountRejectedError(`Remise cumulée ${appliedPct}% dépasse le plafond global de ${rules.global_cap_pct}%.`);
  }
  const finalAmountTnd = Math.round(baseAmountTnd * (1 - appliedPct / 100));
  return { finalAmountTnd, appliedPct };
}

// ── Marge (mission §7/§9 — bloquante <45%, signalée <55%) ──

export const MARGIN_BLOCKING_THRESHOLD_PCT = 45;
export const MARGIN_TARGET_THRESHOLD_PCT = 55;

export interface MarginResult {
  marginPct: number;
  blocked: boolean;
  warning: boolean;
}

/**
 * Pure — never called with an invented cost for a real/definitive quote
 * (no code path here supplies one). Usable for Phase B simulation with the
 * explicitly non-contractual hypotheses below, or once real teacher-cost
 * data becomes available to this layer (not the case today).
 */
export function computeMargin(priceTnd: number, costTnd: number): MarginResult {
  if (priceTnd <= 0) throw new NoCostDataError('computeMargin: priceTnd must be positive');
  const marginPct = ((priceTnd - costTnd) / priceTnd) * 100;
  return {
    marginPct,
    blocked: marginPct < MARGIN_BLOCKING_THRESHOLD_PCT,
    warning: marginPct < MARGIN_TARGET_THRESHOLD_PCT,
  };
}

export function assertMarginAcceptable(result: MarginResult): void {
  if (result.blocked) {
    throw new MarginTooLowError(`Marge ${result.marginPct.toFixed(1)}% < seuil bloquant ${MARGIN_BLOCKING_THRESHOLD_PCT}%.`);
  }
}

// ── Comparaison de packs sur base annuelle (mission §7/§9 — réutilise matchCanonicalPack, ne le duplique pas) ──

export interface PackCoverageComparison {
  match: PackMatch | null;
  /**
   * Best-effort coverage check: the offer's flat hours_per_month must be
   * >= the sur-mesure selection's total hoursPerMonth. Not a full
   * coverageKey-level comparison — offers don't carry structured
   * coverageKeys yet (documented gap, lot5-catalogue-architecture.md).
   * A pack is only ever returned as a genuine match when this holds, so a
   * cheaper pack covering strictly less is never silently preferred.
   */
  coverageSufficient: boolean;
}

export function compareSelectionToCanonicalPacks(
  level: 'premiere' | 'terminale',
  pricedQuote: PricedQuote,
): PackCoverageComparison {
  const surMesureHoursPerMonth = pricedQuote.lines.reduce((sum, l) => sum + (l.hoursPerMonth ?? 0), 0);
  const match = matchCanonicalPack(level, surMesureHoursPerMonth, pricedQuote.monthlyTotalTnd);
  return { match, coverageSufficient: match != null };
}

// ── Snapshot (mission §7 "snapshots") ──

export interface PricingEngineSnapshot {
  computedAt: string;
  serviceMonthsPerYear: number;
  lines: PricedLine[];
  monthlyTotalTnd: number;
  annualTotalTnd: number;
  schedule: CandidatLibreSchedule;
}

export function buildPricingEngineSnapshot(pricedQuote: PricedQuote): PricingEngineSnapshot {
  return {
    computedAt: new Date().toISOString(),
    serviceMonthsPerYear: SERVICE_MONTHS_PER_SCHOOL_YEAR,
    lines: pricedQuote.lines,
    monthlyTotalTnd: pricedQuote.monthlyTotalTnd,
    annualTotalTnd: pricedQuote.annualTotalTnd,
    schedule: pricedQuote.schedule,
  };
}

// ── Phase B — hypothèses de calibration, NON contractuelles (mission §7 Phase B) ──

/**
 * Hypothèses de simulation fournies par la mission (brief initial) —
 * jamais activées pour un devis réel. Aucune fonction de ce fichier ne les
 * consomme automatiquement ; elles existent pour que le futur dossier
 * d'arbitrage chiffré (Phase B) puisse les référencer explicitement, avec
 * une analyse de sensibilité, sans que la direction n'ait à les
 * redécouvrir. STATUS = DIRECTION_A_VALIDER.
 */
export const PHASE_B_COST_HYPOTHESES_NON_CONTRACTUELLES = {
  coutEnseignantAgregeTndH: 70,
  coutEnseignantCertifieTndH: 50,
  coutTuteurTndH: 35,
  coutStructureTndH: 15,
  coutFixeDossierTnd: 120,
  margeBloquantePct: 45,
  margeCiblePct: 55,
  plancherTndHEleve: 40,
  remiseMaximalePct: 20,
} as const;
