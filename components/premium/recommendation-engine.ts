import {
  getCarte,
  getAnnualOfferPaymentSchedule,
  getOffersByLevel,
  getOffersByTrack,
  getPonctuelOffers,
  getStageFormats,
  normalizePricingLevel,
  type AnnualOffer,
} from '@/lib/pricing';
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

import { buildWhatsAppUrl } from '@/lib/whatsapp';
const WHATSAPP_URL = buildWhatsAppUrl();
const LEVEL_LABELS: Record<string, string> = {
  terminale: 'Terminale',
  premiere: 'Première',
  seconde: 'Seconde',
  troisieme: 'Troisième',
};

function buildOfferCard(offer: AnnualOffer): ExamCardProps {
  const price = offer.price_annual ?? 0;
  const payment = getAnnualOfferPaymentSchedule(offer);
  return {
    eyebrow: `${LEVEL_LABELS[normalizePricingLevel(offer.level) ?? ''] ?? offer.level} · ${offer.track === 'libre' ? 'Candidat libre' : 'Parcours présentiel'}`,
    title: offer.title,
    subtitle: offer.subjects,
    price,
    monthlyDisplay: offer.monthly_display ?? undefined,
    pricingDisplay: offer.pricing_display ?? undefined,
    hoursPerWeek: offer.hours_per_week ?? undefined,
    totalHours: offer.hours_per_year ?? undefined,
    groupMax: offer.group_max ?? 5,
    groupMinOpen: offer.group_min_open ?? 3,
    payment: payment ?? undefined,
    features: offer.included,
    ctaText: 'Voir l\'offre',
    ctaHref: '/offres',
  };
}

function buildStageCard(format: ReturnType<typeof getStageFormats>[number]): ExamCardProps {
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

function buildPonctuelCard(offer: ReturnType<typeof getPonctuelOffers>[number]): ExamCardProps {
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

export function buildRecommendationOutcome(answers: RecommendationAnswerSet): RecommendationOutcome {
  const level = normalizePricingLevel(answers.level);
  const need = answers.need;
  const track = answers.track;

  if (!need) {
    return {
      cards: [],
      emptyState: {
        title: 'Choisissez votre besoin',
        message: 'Indiquez si vous cherchez un accompagnement annuel, un stage, une préparation ponctuelle ou la plateforme en ligne.',
        actions: [
          { label: 'Demander un bilan gratuit', href: '/bilan-gratuit' },
          { label: 'Voir toutes les offres', href: '/offres' },
          { label: 'Écrire sur WhatsApp', href: WHATSAPP_URL, external: true },
        ],
      },
    };
  }

  if (need === 'annual') {
    if (!level) {
      return {
        cards: [],
        emptyState: {
          title: 'Sélectionnez un niveau',
          message: 'Nous avons besoin du niveau de l’élève pour vous orienter vers les parcours annuels adaptés.',
          actions: [
            { label: 'Demander un bilan gratuit', href: '/bilan-gratuit' },
            { label: 'Voir toutes les offres', href: '/offres' },
            { label: 'Écrire sur WhatsApp', href: WHATSAPP_URL, external: true },
          ],
        },
      };
    }

    const offers = track === 'libre'
      ? getOffersByTrack('libre').filter((offer) => normalizePricingLevel(offer.level) === level)
      : getOffersByLevel(level);

    const cards = offers.slice(0, 3).map(buildOfferCard);
    if (cards.length === 0) {
      return {
        cards: [],
        emptyState: {
          title: 'Aucune formule trouvée',
          message: 'Nous n’avons pas de formule publiée correspondant exactement à ce niveau pour le moment. Un bilan gratuit permet de vous orienter vers la meilleure alternative.',
          actions: [
            { label: 'Demander un bilan gratuit', href: '/bilan-gratuit' },
            { label: 'Voir toutes les offres', href: '/offres' },
            { label: 'Écrire sur WhatsApp', href: WHATSAPP_URL, external: true },
          ],
        },
      };
    }

    return { cards };
  }

  if (need === 'stage') {
    const cards = getStageFormats().slice(0, 3).map(buildStageCard);
    if (cards.length === 0) {
      return {
        cards: [],
        emptyState: {
          title: 'Stages non disponibles',
          message: 'Aucun format de stage n’est publié pour l’instant. Un bilan gratuit permet de trouver une alternative.',
          actions: [
            { label: 'Demander un bilan gratuit', href: '/bilan-gratuit' },
            { label: 'Voir toutes les offres', href: '/offres' },
            { label: 'Écrire sur WhatsApp', href: WHATSAPP_URL, external: true },
          ],
        },
      };
    }

    return { cards };
  }

  if (need === 'ponctuel') {
    const cards = getPonctuelOffers()
      .filter((offer) => !level || offer.public === 'Tous' || normalizePricingLevel(offer.public) === level)
      .slice(0, 3)
      .map(buildPonctuelCard);
    if (cards.length === 0) {
      return {
        cards: [],
        emptyState: {
          title: 'Aucune prépa ponctuelle trouvée',
          message: 'Nous n’avons pas de session ponctuelle correspondante sous ce filtre. Le bilan gratuit permet de clarifier la meilleure option.',
          actions: [
            { label: 'Demander un bilan gratuit', href: '/bilan-gratuit' },
            { label: 'Voir toutes les offres', href: '/offres' },
            { label: 'Écrire sur WhatsApp', href: WHATSAPP_URL },
          ],
        },
      };
    }

    return { cards };
  }

  if (need === 'platform') {
    const carte = getCarte();
    return {
      cards: [
        {
          eyebrow: 'Carte membre',
          title: carte.title,
          subtitle: 'Accès plateforme + remises + diagnostic',
          price: carte.price_annual,
          features: carte.includes,
          ctaText: 'Découvrir ARIA',
          ctaHref: '/plateforme-aria',
        },
      ],
    };
  }

  return {
    cards: [],
    emptyState: {
      title: 'Besoin non reconnu',
      message: 'Choisissez une formule annuelle, un stage, une préparation ponctuelle ou la plateforme.',
      actions: [
        { label: 'Demander un bilan gratuit', href: '/bilan-gratuit' },
        { label: 'Voir toutes les offres', href: '/offres' },
        { label: 'Écrire sur WhatsApp', href: WHATSAPP_URL, external: true },
      ],
    },
  };
}

export const recommendationActions = [
  { label: 'Demander un bilan gratuit', href: '/bilan-gratuit' },
  { label: 'Voir toutes les offres', href: '/offres' },
  { label: 'Écrire sur WhatsApp', href: WHATSAPP_URL, external: true },
] as const;
