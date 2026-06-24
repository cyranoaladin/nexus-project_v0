import {
  getAnnualOffer,
  getAnnualOfferPaymentSchedule,
  getCarte,
  getCoachingOffer,
  getEffectivePrice,
  getPack,
  getPonctuelOffer,
  getStageFormat,
} from '@/lib/pricing';

export type SelectedOfferContext = {
  id: string;
  title: string;
  price: number;
  deposit?: number;
  installments?: number[];
  solde?: number;
  solde_schedule?: number[];
  full_at_booking?: boolean;
};

export function resolveProgrammeLabel(programme: string | null | undefined) {
  if (!programme) return null;

  const labels: Record<string, string> = {
    excellence: 'Excellence',
    plateforme: 'Plateforme',
    hybride: 'Hybride',
    immersion: 'Immersion',
    'pack-specialise': 'Pack spécialisé',
  };

  return labels[programme] ?? programme;
}

export function resolveSelectedOfferContext(id: string | null | undefined): SelectedOfferContext | null {
  if (!id) return null;

  const annual = getAnnualOffer(id);
  if (annual) {
    const price = getEffectivePrice(annual);
    const payment = getAnnualOfferPaymentSchedule(annual);
    if (!price) return null;
    return {
      id: annual.id,
      title: annual.title,
      price,
      deposit: payment?.deposit,
      installments: payment?.installments,
    };
  }

  const stage = getStageFormat(id);
  if (stage) {
    return {
      id: stage.format_id,
      title: stage.title,
      price: stage.price_per_student,
      deposit: stage.payment.deposit,
      solde: stage.payment.solde,
    };
  }

  const ponctuel = getPonctuelOffer(id);
  if (ponctuel) {
    return {
      id: ponctuel.id,
      title: ponctuel.title,
      price: ponctuel.price_per_student,
      deposit: ponctuel.payment.deposit,
      solde: ponctuel.payment.full_at_booking ? undefined : ponctuel.payment.solde,
      full_at_booking: ponctuel.payment.full_at_booking,
    };
  }

  const coaching = getCoachingOffer(id);
  if (coaching) {
    return {
      id: coaching.id,
      title: coaching.title,
      price: coaching.price,
      deposit: coaching.payment.full_at_booking ? coaching.price : coaching.payment.deposit,
      solde: coaching.payment.solde,
      solde_schedule: coaching.payment.solde_schedule,
      full_at_booking: coaching.payment.full_at_booking,
    };
  }

  const pack = getPack(id);
  if (pack) {
    return {
      id: pack.id,
      title: pack.title,
      price: pack.price,
      deposit: pack.payment.deposit,
      solde_schedule: pack.payment.solde_schedule,
    };
  }

  const carte = getCarte();
  if (carte.id === id) {
    return {
      id: carte.id,
      title: carte.title,
      price: carte.price_annual,
      full_at_booking: true,
      deposit: carte.price_annual,
    };
  }

  return null;
}
