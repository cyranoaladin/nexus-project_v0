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
      // depositPct is derived per-offer from the canonical deposit/price_annual
      // fields, never assumed — several offer families (candidat individuel,
      // and since 2026-09 the "scolarisé" annual offers) are sans acompte.
      const depositPct =
        payment && offer.price_annual ? Math.round((payment.deposit / offer.price_annual) * 100) : rules.payment.deposit_pct_annual;
      return {
        id: offer.id, level: offer.level, track: offer.track, title: offer.title,
        subjects: offer.subjects, hours_per_week: offer.hours_per_week, hours_per_year: offer.hours_per_year,
        group_max: offer.group_max, group_min_open: offer.group_min_open, price_annual: offer.price_annual,
        included: offer.included, pricing_display: offer.pricing_display,
        price_qualifier: offer.price_qualifier,
        hours_per_month_is_ceiling: offer.hours_per_month_is_ceiling,
        payment: payment ? { ...payment, depositPct } : undefined,
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
