/**
 * Recommendation engine — pure computation, no pricing imports.
 *
 * Accepts pre-loaded pricing data as a parameter so it can run
 * both server-side (for pre-computation) and client-side (for
 * interactive wizard) without importing the full canonical JSON.
 */
import type { ExamCardProps } from './ExamCard';

export interface RecommendationAnswerSet {
  level?: string;
  track?: string;
  need?: string;
}

export interface RecommendationAction {
  label: string;
  href: string;
  external?: boolean;
}

export interface RecommendationEmptyState {
  title: string;
  message: string;
  actions: RecommendationAction[];
}

export interface RecommendationOutcome {
  cards: ExamCardProps[];
  emptyState?: RecommendationEmptyState;
}

// ── Data shapes passed in from the server ──

export interface RecommendationOffer {
  id: string;
  level: string;
  track: string;
  title: string;
  subjects: string;
  hours_per_week: number | null;
  hours_per_year: number | null;
  group_max: number | null;
  group_min_open: number | null;
  price_annual: number | null;
  included: string[];
  pricing_display?: 'monthly_first' | 'annual';
  payment?: { deposit: number; installments: number[]; lastInstallment: number; depositPct: number };
  normalizedLevel: string | null;
}

export interface RecommendationStageFormat {
  title: string;
  hours: number;
  group_max: number;
  group_min_open: number;
  price_per_student: number;
  payment: { deposit: number; solde: number };
}

export interface RecommendationPonctuel {
  title: string;
  description: string;
  public: string;
  price_per_student: number;
  group_max: number | null;
  group_min_open: number | null;
  payment: { full_at_booking?: boolean; deposit: number; solde: number };
  normalizedPublic: string | null;
}

export interface RecommendationCarte {
  title: string;
  price_annual: number;
  includes: string[];
}

export interface RecommendationData {
  offers: RecommendationOffer[];
  stageFormats: RecommendationStageFormat[];
  ponctuelOffers: RecommendationPonctuel[];
  carte: RecommendationCarte;
  whatsappUrl: string;
}

// ── Internal helpers ──

const LEVEL_LABELS: Record<string, string> = {
  terminale: 'Terminale',
  premiere: 'Première',
  seconde: 'Seconde',
  troisieme: 'Troisième',
};

function buildOfferCard(offer: RecommendationOffer): ExamCardProps {
  const price = offer.price_annual ?? 0;
  return {
    eyebrow: `${LEVEL_LABELS[offer.normalizedLevel ?? ''] ?? offer.level} · ${offer.track === 'libre' ? 'Candidat libre' : 'Parcours présentiel'}`,
    title: offer.title,
    subtitle: offer.subjects,
    price,
    pricingDisplay: offer.pricing_display ?? undefined,
    hoursPerWeek: offer.hours_per_week ?? undefined,
    totalHours: offer.hours_per_year ?? undefined,
    groupMax: offer.group_max ?? 5,
    groupMinOpen: offer.group_min_open ?? 3,
    payment: offer.payment,
    features: offer.included,
    ctaText: 'Voir l\'offre',
    ctaHref: '/offres',
  };
}

function buildStageCard(format: RecommendationStageFormat): ExamCardProps {
  return {
    eyebrow: `Stages · ${format.title}`,
    title: format.title,
    subtitle: `${format.hours}h de travail concentré`,
    price: format.price_per_student,
    groupMax: format.group_max,
    groupMinOpen: format.group_min_open,
    payment: { deposit: format.payment.deposit, solde: format.payment.solde },
    ctaText: 'Pré-inscription',
    ctaHref: '/stages',
  };
}

function buildPonctuelCard(offer: RecommendationPonctuel): ExamCardProps {
  return {
    eyebrow: `Prépa épreuves · ${offer.public}`,
    title: offer.title,
    subtitle: offer.description,
    price: offer.price_per_student,
    groupMax: offer.group_max ?? 5,
    groupMinOpen: offer.group_min_open ?? 3,
    payment: offer.payment.full_at_booking
      ? undefined
      : { deposit: offer.payment.deposit, solde: offer.payment.solde },
    ctaText: 'Demander un bilan',
    ctaHref: '/bilan-gratuit',
  };
}

function makeActions(whatsappUrl: string): RecommendationAction[] {
  return [
    { label: 'Demander un bilan gratuit', href: '/bilan-gratuit' },
    { label: 'Voir toutes les offres', href: '/offres' },
    { label: 'Écrire sur WhatsApp', href: whatsappUrl, external: true },
  ];
}

// ── Main entry point ──

export function buildRecommendationOutcome(
  answers: RecommendationAnswerSet,
  data: RecommendationData,
): RecommendationOutcome {
  const level = answers.level ?? null;
  const need = answers.need;
  const track = answers.track;
  const actions = makeActions(data.whatsappUrl);

  if (!need) {
    return { cards: [], emptyState: { title: 'Choisissez votre besoin', message: 'Indiquez si vous cherchez un accompagnement annuel, un stage, une préparation ponctuelle ou la plateforme en ligne.', actions } };
  }

  if (need === 'annual') {
    if (!level) {
      return { cards: [], emptyState: { title: 'Sélectionnez un niveau', message: 'Nous avons besoin du niveau de l\'élève pour vous orienter vers les parcours annuels adaptés.', actions } };
    }
    const offers = track === 'libre'
      ? data.offers.filter((o) => o.track === 'libre' && o.normalizedLevel === level)
      : data.offers.filter((o) => o.normalizedLevel === level);
    const cards = offers.slice(0, 3).map(buildOfferCard);
    if (cards.length === 0) {
      return { cards: [], emptyState: { title: 'Aucune formule trouvée', message: 'Nous n\'avons pas de formule publiée correspondant exactement à ce niveau pour le moment. Un bilan gratuit permet de vous orienter vers la meilleure alternative.', actions } };
    }
    return { cards };
  }

  if (need === 'stage') {
    const cards = data.stageFormats.slice(0, 3).map(buildStageCard);
    if (cards.length === 0) {
      return { cards: [], emptyState: { title: 'Stages non disponibles', message: 'Aucun format de stage n\'est publié pour l\'instant. Un bilan gratuit permet de trouver une alternative.', actions } };
    }
    return { cards };
  }

  if (need === 'ponctuel') {
    const cards = data.ponctuelOffers
      .filter((o) => !level || o.public === 'Tous' || o.normalizedPublic === level)
      .slice(0, 3)
      .map(buildPonctuelCard);
    if (cards.length === 0) {
      return { cards: [], emptyState: { title: 'Aucune prépa ponctuelle trouvée', message: 'Nous n\'avons pas de session ponctuelle correspondante sous ce filtre. Le bilan gratuit permet de clarifier la meilleure option.', actions } };
    }
    return { cards };
  }

  if (need === 'platform') {
    return {
      cards: [{
        eyebrow: 'Carte membre',
        title: data.carte.title,
        subtitle: 'Accès plateforme + remises + diagnostic',
        price: data.carte.price_annual,
        features: data.carte.includes,
        ctaText: 'Découvrir ARIA',
        ctaHref: '/plateforme-aria',
      }],
    };
  }

  return { cards: [], emptyState: { title: 'Besoin non reconnu', message: 'Choisissez une formule annuelle, un stage, une préparation ponctuelle ou la plateforme.', actions } };
}

export function getRecommendationActions(whatsappUrl: string): readonly RecommendationAction[] {
  return makeActions(whatsappUrl);
}
