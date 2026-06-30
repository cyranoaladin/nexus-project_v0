import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import type { Metadata } from 'next';
import {
  getAllOffers,
  getAnnualOfferPaymentSchedule,
  getCarte,
  getPonctuelOffers,
  getRules,
  getStageFormats,
  normalizePricingLevel,
} from '@/lib/pricing';
import type { RecommendationData } from '@/components/premium/recommendation-engine';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { RecommandationClient } from './RecommandationClient';

export const metadata: Metadata = {
  title: 'Trouver ma formule — Diagnostic personnalisé | Nexus Réussite',
  description:
    'Répondez à 3 questions pour découvrir la formule Nexus Réussite la plus adaptée à votre profil. Parcours annuels, stages, plateforme, candidat libre et coaching.',
  alternates: { canonical: '/recommandation' },
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
    title: 'Trouver ma formule | Nexus Réussite',
    description:
      '3 questions pour identifier le meilleur parcours : niveau, statut, besoin. Résultats immédiats.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

function buildRecommendationData(): RecommendationData {
  const rules = getRules();
  const carte = getCarte();
  return {
    offers: getAllOffers().map((offer) => {
      const payment = getAnnualOfferPaymentSchedule(offer);
      return {
        id: offer.id, level: offer.level, track: offer.track, title: offer.title,
        subjects: offer.subjects, hours_per_week: offer.hours_per_week, hours_per_year: offer.hours_per_year,
        group_max: offer.group_max, group_min_open: offer.group_min_open, price_annual: offer.price_annual,
        included: offer.included, pricing_display: offer.pricing_display,
        payment: payment ? { ...payment, depositPct: rules.payment.deposit_pct_annual } : undefined,
        normalizedLevel: normalizePricingLevel(offer.level),
      };
    }),
    stageFormats: getStageFormats().map((f) => ({
      title: f.title, hours: f.hours, group_max: f.group_max, group_min_open: f.group_min_open,
      price_per_student: f.price_per_student, payment: { deposit: f.payment.deposit, solde: f.payment.solde },
    })),
    ponctuelOffers: getPonctuelOffers().map((o) => ({
      title: o.title, description: o.description, public: o.public, price_per_student: o.price_per_student,
      group_max: o.group_max, group_min_open: o.group_min_open,
      payment: { full_at_booking: o.payment.full_at_booking, deposit: o.payment.deposit, solde: o.payment.solde },
      normalizedPublic: normalizePricingLevel(o.public),
    })),
    carte: { title: carte.title, price_annual: carte.price_annual, includes: carte.includes },
    whatsappUrl: buildWhatsAppUrl(),
  };
}

export default function RecommandationPage() {
  return <RecommandationClient recommendationData={buildRecommendationData()} />;
}
