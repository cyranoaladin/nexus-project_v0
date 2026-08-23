/**
 * Typed loader for pricing.canonical.json — single source of truth.
 * No other file should import the JSON directly.
 *
 * WARNING: Do NOT import this module in 'use client' components.
 * Use '@/lib/pricing-client' instead — it contains a lightweight subset
 * (~5 KB) that avoids bundling the full 28 KB JSON in the client.
 * A test enforces this: __tests__/lib/pricing-client-sync.test.ts
 */
import 'server-only';
import pricingData from '@/data/pricing.canonical.json';

// ── Types ──

export interface Campaign {
  label: string;
  availability: string;
  availability_note: string;
  public_label: string;
  campaign_label: string;
  fidelity_label: string;
  fidelity_condition: string;
}

export interface Rules {
  weeks_per_year: number;
  group_max: number;
  group_min_open: Record<string, number>;
  semi_individual_surcharge_pct: number;
  price_floor_per_student_hour_tnd: Record<string, number>;
  payment: {
    deposit_pct: number;
    deposit_pct_annual: number;
    deposit_pct_stage: number;
    installments_default: number;
    rounding_tnd: number;
    deposit_non_refundable_except_group_not_opened: boolean;
    deposit_deductible_to_annual: boolean;
    deposit_carryover: boolean;
  };
  discounts: {
    comptant_pct: number;
    fratrie_2nd_child_pct: number;
    ancien_eleve_min_pct: number;
    ancien_eleve_max_pct: number;
    parrainage_min_tnd: number;
    parrainage_max_tnd: number;
    carte_nexus_pct: number;
    cumulable: boolean;
    global_cap_pct: number;
    note: string;
  };
  /**
   * Bounded Grand Oral prep policy — no offer may promise unlimited hours.
   * 4 séances × 2h = 8h max/an, direction-approved (not a placeholder).
   */
  grand_oral_policy: {
    included_sessions: number;
    session_duration_minutes: number;
    total_hours_max: number;
    note_focus_bac: string;
    note_integrale: string;
    applies_to_offer_ids: string[];
  };
}

export interface AnnualOffer {
  id: string;
  level: string;
  track: string;
  audience?: string[];
  /** Controls how pricing renders: 'monthly_first' (default for tutorat), 'annual' (plateforme) */
  pricing_display?: 'monthly_first' | 'annual';
  /**
   * Effectif family for group-size invariants. 'candidat_individuel' allows
   * group_max up to 6 (min 3); every other offer (default 'standard') stays
   * capped at 5. See __tests__/lib/business-model-invariants.test.ts.
   */
  effectif_family?: 'standard' | 'candidat_individuel';
  /** 'fixed' (default) shows the price as-is; 'from' prefixes it with "dès". */
  price_qualifier?: 'fixed' | 'from';
  title: string;
  subjects: string;
  hours_per_week: number | null;
  hours_per_year: number | null;
  /** Monthly hour envelope for candidat individuel offers (September→June cadence). */
  hours_per_month?: number | null;
  /** True when hours_per_month is a ceiling ("jusqu'à"), not a committed weekly volume. */
  hours_per_month_is_ceiling?: boolean;
  group_max: number | null;
  group_min_open: number | null;
  price_annual: number | null;
  price_per_student_hour: number | null;
  equiv_per_2h_session: number | null;
  deposit: number | null;
  n_installments: number | null;
  installment_amount: number | null;
  last_installment: number | null;
  display?: string;
  included: string[];
}

/** Public shape — no internal `_*` fields. */
export interface StageFormat {
  format_id: string;
  title: string;
  hours: number;
  group_max: number;
  group_min_open: number;
  price_per_student: number;
  price_per_student_hour: number;
  floor_type: string;
  payment: { deposit: number; solde: number };
}

/** Raw shape in canonical JSON (may contain `_*` internal fields). */
interface StageFormatRaw extends StageFormat {
  [key: string]: unknown;
}

export interface StageEdition {
  edition_id: string;
  title: string;
  period: string;
  dates_display?: string;
  formats: string[];
}

export interface PonctuelOffer {
  id: string;
  title: string;
  public: string;
  description: string;
  hours: number | null;
  group_max: number | null;
  group_min_open: number | null;
  price_per_student: number;
  price_per_student_hour: number | null;
  floor_type: string;
  payment: { full_at_booking?: boolean; deposit: number; solde: number };
}

export interface CoachingOffer {
  id: string;
  title: string;
  format: string;
  effectif: string;
  group_max: number | null;
  group_min_open: number | null;
  price: number;
  price_per_hour: number | null;
  floor_type: string;
  campaign_free: boolean;
  deductible: boolean;
  payment: { full_at_booking?: boolean; deposit: number; solde?: number; solde_schedule?: number[] };
}

export interface PackComponent {
  type: 'stage' | 'ponctuel' | 'coaching' | 'service';
  id?: string;
  format_id?: string;
  edition_id?: string;
  label?: string;
  qty: number;
  value_override?: number;
}

export interface Pack {
  id: string;
  title: string;
  public: string;
  components: PackComponent[];
  price: number;
  deposit_deductible_to_annual: boolean;
  deposit_carryover: boolean;
  payment: { deposit: number; solde_schedule: number[] };
}

/** Modular building blocks for the "sur mesure" candidat individuel devis engine. */
export interface CandidatIndividuelModules {
  min_group_open: number;
  max_group_size: number;
  pilotage: { id: string; title: string; price_monthly: number };
  petit_groupe: Array<{
    hours_per_month: number;
    price_per_student_monthly: number;
    group_min_open: number;
    group_max: number;
  }>;
  duo: { price_per_hour_per_student: number };
  individuel: { price_per_hour_min: number; floor_type: string };
}

/** A program without a fixed price — devis-only, subject to eligibility review. */
export interface IndicativeProgram {
  id: string;
  level: string;
  track: string;
  title: string;
  subtitle: string;
  pricing_display: 'devis';
  price_monthly_min: number;
  price_monthly_max: number;
  eligibility_requires_human_review: boolean;
  depends_on: string[];
}

export interface CarteNexus {
  id: string;
  title: string;
  price_annual: number;
  includes: string[];
  rationale: string;
  discount_pct: number;
  discount_applies_to: string[];
  discount_excludes: string[];
  non_cumulable: boolean;
  member_floor_per_student_hour: number;
}

export interface StageCalendarEntry {
  id: string;
  title: string;
  format_id: string | null;
  format_label: string;
  half_days: number;
  hours: number | null;
  date_start: string;
  date_end: string;
  dates_display: string;
  weeks: string[] | null;
  objective: string;
  audience: string[];
  subjects: string[];
  notes: string | null;
}

export interface SpecialProgram {
  id: string;
  title: string;
  hours: number;
  group_max: number;
  price_per_student: number;
  price_per_student_hour: number;
  payment: { deposit: number; solde: number };
}

export interface PreRentreePack {
  id: string;
  title: string;
  edition_id: string;
  subjects_count: number;
  hours_per_subject: number;
  total_hours: number;
  sessions_per_subject: number;
  session_duration_h: number;
  group_max: number;
  group_min_open: number;
  price_per_student: number;
  price_per_student_hour: number;
  floor_type: string;
  payment: { deposit: number; solde: number };
  discount_exclusions: string[];
  non_cumulable: boolean;
}

export interface PreRentreeFoundationsProduct {
  id: string;
  title: string;
  edition_id: string;
  level: 'QUATRIEME' | 'TROISIEME' | 'SECONDE';
  subjects_count: 1;
  hours_per_subject: 10;
  total_hours: 10;
  sessions_per_subject: 5;
  session_duration_h: 2;
  group_max: 6;
  // 4 for QUATRIEME (documented exception, mission 4e/Philosophie §5.1), 3 for
  // TROISIEME/SECONDE — never a single literal.
  group_min_open: number;
  price_per_student: number;
  price_per_student_hour: number;
  floor_type: string;
  commercial_exception?: {
    exception_id: string;
    edition_id: string;
    status: 'APPROVED' | 'PENDING' | 'REJECTED';
    approved_at: string;
    approved_by_role: string;
    scope: string;
    justification: string;
  };
  payment: { deposit: number; solde: number };
  multi_subject_discount: false;
}

export interface AriaAddon {
  price_monthly: number;
  subjects: string[];
}

export interface SubscriptionTier {
  id: string;
  price_monthly: number;
}

export interface OperationalSubscriptionPlan {
  name: string;
  price: number;
  credits: number;
  popular?: boolean;
  features: string[];
}

export interface OperationalAriaAddon {
  name: string;
  price: number;
  description: string;
  features: string[];
}

export interface OperationalSpecialPack {
  name: string;
  price: number;
  description: string;
  features: string[];
}

export interface PricingData {
  version: string;
  _note?: string;
  currency: string;
  campaign: Campaign;
  rules: Rules;
  offers: AnnualOffer[];
  stage_formats: StageFormat[];
  stage_calendar: StageCalendarEntry[];
  stage_editions: StageEdition[];
  ponctuel_offers: PonctuelOffer[];
  coaching: CoachingOffer[];
  packs: Pack[];
  candidat_individuel_modules: CandidatIndividuelModules;
  indicative_programs: IndicativeProgram[];
  special_programs: SpecialProgram[];
  pre_rentree_packs: PreRentreePack[];
  pre_rentree_foundations: PreRentreeFoundationsProduct[];
  aria_addon: AriaAddon;
  operational_aria_addons: Record<string, OperationalAriaAddon>;
  subscription_tiers: SubscriptionTier[];
  operational_subscription_plans: Record<string, OperationalSubscriptionPlan>;
  operational_special_packs: Record<string, OperationalSpecialPack>;
  operational_credit_costs: Record<string, number>;
  carte_nexus: CarteNexus;
  urgence: Record<string, { title: string; display: string; hourly?: number; amount?: number }>;
  reperes_tarifaires: {
    brevetMois: string;
    secondeMois: string;
    premiereSimpleMois: string;
    premiereDuoMois: string;
    terminaleSimpleMois: string;
    terminaleDuoMois: string;
    plateformeAn: string;
    stagesBase: string;
    parrainage: string;
  };
}

export type PricingLevel = 'terminale' | 'premiere' | 'seconde' | 'troisieme';

// ── Data ──

const data = pricingData as unknown as PricingData;

/** Strip all keys prefixed with `_` from an object (internal metadata). */
function stripInternal<T>(obj: T): T {
  const result = {} as Record<string, unknown>;
  for (const key of Object.keys(obj as object)) {
    if (!key.startsWith('_')) {
      result[key] = (obj as Record<string, unknown>)[key];
    }
  }
  return result as T;
}

// ── Accessors ──

export function getCampaign(): Campaign {
  return data.campaign;
}

export function getRules(): Rules {
  return data.rules;
}

export function getAllOffers(): AnnualOffer[] {
  return data.offers;
}

function normalizePricingToken(input: string | null | undefined): string | null {
  if (!input) return null;
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function normalizePricingLevel(input: string | null | undefined): PricingLevel | null {
  const normalized = normalizePricingToken(input);
  if (!normalized) return null;

  if (
    normalized === 'terminale' ||
    normalized === 'tle' ||
    normalized === 'term'
  ) {
    return 'terminale';
  }

  if (
    normalized === 'premiere' ||
    normalized === '1ere' ||
    normalized === '1re' ||
    normalized === '1erepremiere' ||
    normalized === 'premiere1'
  ) {
    return 'premiere';
  }

  if (
    normalized === 'seconde' ||
    normalized === '2de' ||
    normalized === '2nde' ||
    normalized === '2eme'
  ) {
    return 'seconde';
  }

  if (
    normalized === 'troisieme' ||
    normalized === '3eme' ||
    normalized === '3e' ||
    normalized === 'troiseme'
  ) {
    return 'troisieme';
  }

  return null;
}

export function getAnnualOffer(id: string): AnnualOffer | undefined {
  return data.offers.find((o) => o.id === id);
}

export function getOffersByLevel(level: string): AnnualOffer[] {
  const normalized = normalizePricingLevel(level);
  if (!normalized) return [];
  return data.offers.filter((o) => normalizePricingLevel(o.level) === normalized);
}

export function getOffersByTrack(track: string): AnnualOffer[] {
  return data.offers.filter((o) => o.track === track);
}

export function getOffersByAudience(audience: string): AnnualOffer[] {
  return data.offers.filter((o) => !o.audience || o.audience.includes(audience));
}

export function getOffersByLevelAndAudience(level: string, audience: string): AnnualOffer[] {
  const normalized = normalizePricingLevel(level);
  if (!normalized) return [];
  return data.offers.filter(
    (o) => normalizePricingLevel(o.level) === normalized && (!o.audience || o.audience.includes(audience)),
  );
}

export function getStageFormats(): StageFormat[] {
  return data.stage_formats.map(stripInternal);
}

/** Returns true if the format's price is validated by the business.
 *  Reads from internal raw data, NOT from the public StageFormat object. */
export function isFormatPriceValidated(formatOrId: StageFormat | string): boolean {
  const id = typeof formatOrId === 'string' ? formatOrId : formatOrId.format_id;
  const raw = data.stage_formats.find((f) => f.format_id === id) as StageFormatRaw | undefined;
  // A format is pending if it has _price_status: "pending_validation" in the raw JSON
  return (raw as Record<string, unknown> | undefined)?.['_price_status'] !== 'pending_validation';
}

export function getStageFormat(formatId: string): StageFormat | undefined {
  const raw = data.stage_formats.find((f) => f.format_id === formatId);
  return raw ? stripInternal(raw) : undefined;
}

/** Alias for getStageFormat */
export function getStage(formatId: string): StageFormat | undefined {
  return getStageFormat(formatId);
}

export function getStageCalendar(): StageCalendarEntry[] {
  return data.stage_calendar ?? [];
}

/**
 * Returns the next upcoming stage from the calendar (date_start >= today).
 * Auto-advances as time passes — no hardcoded stage name needed.
 */
export function getNextStage(referenceDate?: Date): { title: string; dates_display: string; date_start: string } | null {
  const now = referenceDate ?? new Date();
  // Compare YYYY-MM-DD strings to avoid UTC-vs-local timezone skew entirely.
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const calendar = getStageCalendar();
  const upcoming = calendar
    .filter((e) => e.date_start >= todayStr)
    .sort((a, b) => a.date_start.localeCompare(b.date_start));
  if (upcoming.length === 0) return null;
  const next = upcoming[0];
  return {
    title: next.title,
    dates_display: next.dates_display,
    date_start: next.date_start,
  };
}

export function getStageEditions(): StageEdition[] {
  return data.stage_editions;
}

export function getStageEdition(editionId: string): StageEdition | undefined {
  return data.stage_editions.find((e) => e.edition_id === editionId);
}

export function getPonctuelOffers(): PonctuelOffer[] {
  return data.ponctuel_offers;
}

export function getPonctuelOffer(id: string): PonctuelOffer | undefined {
  return data.ponctuel_offers.find((o) => o.id === id);
}

export function getCoachingOffers(): CoachingOffer[] {
  return data.coaching;
}

export function getCoachingOffer(id: string): CoachingOffer | undefined {
  return data.coaching.find((o) => o.id === id);
}

export function getPacks(): Pack[] {
  return data.packs;
}

export function getPack(id: string): Pack | undefined {
  return data.packs.find((p) => p.id === id);
}

export function getCandidatIndividuelModules(): CandidatIndividuelModules {
  return data.candidat_individuel_modules;
}

export function getIndicativePrograms(): IndicativeProgram[] {
  return data.indicative_programs;
}

export function getIndicativeProgram(id: string): IndicativeProgram | undefined {
  return data.indicative_programs.find((p) => p.id === id);
}

export function getCarte(): CarteNexus {
  return data.carte_nexus;
}

export function getUrgence(): PricingData['urgence'] {
  return data.urgence;
}

export function getReperes(): PricingData['reperes_tarifaires'] {
  return data.reperes_tarifaires;
}

// ── Pure derived functions ──

/** Compute deposit = round(price × deposit_pct / 100, rounding) */
export function computeDeposit(price: number): number {
  const { deposit_pct, rounding_tnd } = data.rules.payment;
  return Math.round((price * deposit_pct) / 100 / rounding_tnd) * rounding_tnd;
}

/** Compute standard schedule: deposit 30% + N equal installments */
export function computeSchedule(price: number, nInstallments?: number): { deposit: number; installments: number[]; lastInstallment: number } {
  const n = nInstallments ?? data.rules.payment.installments_default;
  const deposit = computeDeposit(price);
  const remaining = price - deposit;
  const installment = Math.floor(remaining / n);
  const last = remaining - installment * (n - 1);
  return {
    deposit,
    installments: Array(n - 1).fill(installment).concat([last]),
    lastInstallment: last,
  };
}

/** Build the displayed annual offer payment schedule from canonical fields. */
export function getAnnualOfferPaymentSchedule(offer: AnnualOffer): { deposit: number; installments: number[]; lastInstallment: number } | null {
  if (offer.deposit == null || offer.n_installments == null || offer.installment_amount == null) {
    return null;
  }

  const regularInstallments = Math.max(offer.n_installments - 1, 0);
  const lastInstallment = offer.last_installment ?? offer.installment_amount;
  return {
    deposit: offer.deposit,
    installments: [...Array(regularInstallments).fill(offer.installment_amount), lastInstallment],
    lastInstallment,
  };
}

/** Apply a discount percentage, capped at global max, respecting floor */
export function applyDiscount(price: number, discountPct: number, floorPerHour?: number, hours?: number): number {
  const cappedPct = Math.min(discountPct, data.rules.discounts.global_cap_pct);
  const discounted = Math.round(price * (1 - cappedPct / 100));
  if (floorPerHour != null && hours != null) {
    const minPrice = floorPerHour * hours;
    return Math.max(discounted, minPrice);
  }
  return discounted;
}

/** Resolve the unit price for a pack component */
export function resolveComponentPrice(component: PackComponent): number {
  if (component.value_override != null) return component.value_override;
  if (component.type === 'stage' && component.format_id) {
    const fmt = getStageFormat(component.format_id);
    return fmt ? fmt.price_per_student : 0;
  }
  if (component.type === 'ponctuel' && component.id) {
    const p = getPonctuelOffer(component.id);
    return p ? p.price_per_student : 0;
  }
  if (component.type === 'coaching' && component.id) {
    const c = getCoachingOffer(component.id);
    return c ? c.price : 0;
  }
  return 0;
}

/** Compute the sum of component unit prices for a pack */
export function resolvePackValue(pack: Pack): number {
  return pack.components.reduce((sum, c) => sum + c.qty * resolveComponentPrice(c), 0);
}

/** Get the effective price for an annual offer */
export function getEffectivePrice(offer: AnnualOffer): number | null {
  return offer.price_annual;
}

/** Apply Carte Nexus discount to a unit (stage/ponctuel/coaching) price */
export function applyCarteDiscount(unitPrice: number, hours: number | null): number {
  const carte = data.carte_nexus;
  const discounted = Math.round(unitPrice * (1 - carte.discount_pct / 100));
  if (hours != null && hours > 0) {
    const minPrice = carte.member_floor_per_student_hour * hours;
    return Math.max(discounted, minPrice);
  }
  return discounted;
}

// ── Special programs ──

export function getPreRentreePacks(productIds?: readonly string[]): PreRentreePack[] {
  if (!productIds) return data.pre_rentree_packs.map(stripInternal);

  const byId = new Map(data.pre_rentree_packs.map((pack) => [pack.id, pack]));
  return productIds.map((id) => {
    const pack = byId.get(id);
    if (!pack) {
      throw new Error(`Unknown Pré-rentrée pricing product: ${id}`);
    }
    return stripInternal(pack);
  });
}

export function getPreRentreeFoundationsProducts(
  productIds?: readonly string[],
): PreRentreeFoundationsProduct[] {
  if (!productIds) return data.pre_rentree_foundations.map(stripInternal);
  const byId = new Map(data.pre_rentree_foundations.map((product) => [product.id, product]));
  return productIds.map((id) => {
    const product = byId.get(id);
    if (!product) throw new Error(`Unknown Pré-rentrée Fondations pricing product: ${id}`);
    return stripInternal(product);
  });
}

export function getSpecialPrograms(): SpecialProgram[] {
  return data.special_programs;
}

export function getSpecialProgram(id: string): SpecialProgram | undefined {
  return data.special_programs.find((p) => p.id === id);
}

// ── ARIA addon ──

export function getAriaAddon(): AriaAddon {
  return data.aria_addon;
}

export function getAriaAddonPrice(): number {
  return data.aria_addon.price_monthly;
}

// ── Subscription tiers ──

export function getSubscriptionTiers(): SubscriptionTier[] {
  return data.subscription_tiers;
}

export function getSubscriptionTier(id: string): SubscriptionTier | undefined {
  return data.subscription_tiers.find((t) => t.id === id);
}

// ── Full data export (for tests) ──
export function getFullPricingData(): PricingData {
  return data;
}
