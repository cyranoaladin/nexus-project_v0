/**
 * Typed loader for pricing.canonical.json — single source of truth.
 * No other file should import the JSON directly.
 */
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
}

export interface AnnualOffer {
  id: string;
  level: string;
  track: string;
  title: string;
  subjects: string;
  hours_per_week: number | null;
  hours_per_year: number | null;
  group_max: number | null;
  group_min_open: number | null;
  price_annual_public: number | null;
  price_annual_campaign: number | null;
  price_per_student_hour: number | null;
  monthly_display: number | null;
  equiv_per_2h_session: number | null;
  badge: string | null;
  deposit: number | null;
  n_installments: number | null;
  installment_amount: number | null;
  last_installment: number | null;
  display?: string;
  included: string[];
}

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
  value: number;
  price: number;
  discount_pct: number;
  deposit_deductible_to_annual: boolean;
  deposit_carryover: boolean;
  payment: { deposit: number; solde_schedule: number[] };
}

export interface CarteNexus {
  id: string;
  title: string;
  price_annual: number;
  includes: string[];
  discount_pct: number;
  discount_applies_to: string[];
  discount_excludes: string[];
  non_cumulable: boolean;
  member_floor_per_student_hour: number;
}

export interface PricingData {
  version: string;
  _note?: string;
  currency: string;
  campaign: Campaign;
  rules: Rules;
  offers: AnnualOffer[];
  stage_formats: StageFormat[];
  stage_editions: StageEdition[];
  ponctuel_offers: PonctuelOffer[];
  coaching: CoachingOffer[];
  packs: Pack[];
  carte_nexus: CarteNexus;
  urgence: Record<string, { title: string; display: string; hourly?: number; amount?: number }>;
  reperes_tarifaires: Record<string, string>;
}

// ── Data ──

const data = pricingData as unknown as PricingData;

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

export function getAnnualOffer(id: string): AnnualOffer | undefined {
  return data.offers.find((o) => o.id === id);
}

export function getOffersByLevel(level: string): AnnualOffer[] {
  return data.offers.filter((o) => o.level === level);
}

export function getOffersByTrack(track: string): AnnualOffer[] {
  return data.offers.filter((o) => o.track === track);
}

export function getStageFormats(): StageFormat[] {
  return data.stage_formats;
}

export function getStageFormat(formatId: string): StageFormat | undefined {
  return data.stage_formats.find((f) => f.format_id === formatId);
}

/** Alias for getStageFormat — PROCEDURE §3 accessor */
export function getStage(formatId: string): StageFormat | undefined {
  return getStageFormat(formatId);
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

/** Check if campaign is still active — places-based model, no deadline */
export function isCampaignActive(): boolean {
  // Campaign availability is driven by group fill rate, not by a date.
  // Returns true as long as the campaign label exists.
  // Business logic for "group full" is handled at reservation time, not here.
  return Boolean(data.campaign.availability);
}

/** Get the effective price for an annual offer (campaign or public) */
export function getEffectivePrice(offer: AnnualOffer): number | null {
  if (offer.price_annual_campaign == null && offer.price_annual_public == null) return null;
  if (isCampaignActive() && offer.price_annual_campaign != null) return offer.price_annual_campaign;
  return offer.price_annual_public;
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

// ── Full data export (for tests) ──
export function getFullPricingData(): PricingData {
  return data;
}
