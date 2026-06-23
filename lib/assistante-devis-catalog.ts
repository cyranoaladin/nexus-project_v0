import {
  getAllOffers,
  getAnnualOfferPaymentSchedule,
  getCoachingOffers,
  getFullPricingData,
  getPacks,
  getPonctuelOffers,
  getSpecialPrograms,
  getStageFormats,
  getUrgence,
  type AnnualOffer,
  type CoachingOffer,
  type Pack,
  type PonctuelOffer,
  type SpecialProgram,
  type StageFormat,
} from '@/lib/pricing';

export type AssistanteDevisSourceType =
  | 'annual_offer'
  | 'stage_format'
  | 'ponctuel_offer'
  | 'coaching_offer'
  | 'pack'
  | 'special_program'
  | 'urgence';

export interface AssistanteDevisOffer {
  sourceType: AssistanteDevisSourceType;
  sourceId: string;
  label: string;
  annual?: number | null;
  monthly?: number | null;
  display?: string;
  annualDisplay?: string;
  paiement?: string;
  echeancier?: number[];
  desc?: string;
  inc?: string[];
  category: string;
}

export interface AssistanteDevisCatalogMeta {
  source: 'data/pricing.canonical.json';
  loader: 'lib/pricing.ts';
  version: string;
  currency: string;
  counts: Record<AssistanteDevisSourceType, number>;
}

export type AssistanteDevisCatalog = {
  _meta: AssistanteDevisCatalogMeta;
} & Record<string, AssistanteDevisOffer | AssistanteDevisCatalogMeta>;

function formatTnd(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} TND`;
}

function compactNumbers(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === 'number');
}

function annualSchedule(offer: AnnualOffer): number[] {
  const payment = getAnnualOfferPaymentSchedule(offer);
  if (!payment) return compactNumbers([offer.price_annual]);
  return [payment.deposit, ...payment.installments];
}

function annualOfferToDevis(offer: AnnualOffer): AssistanteDevisOffer {
  const annual = offer.price_annual;
  return {
    sourceType: 'annual_offer',
    sourceId: offer.id,
    label: offer.title,
    annual,
    monthly: offer.monthly_display,
    annualDisplay: annual != null ? `${formatTnd(annual)} / an` : undefined,
    paiement: offer.deposit != null ? `${formatTnd(offer.deposit)} reservation + mensualites` : undefined,
    echeancier: annualSchedule(offer),
    desc: offer.subjects,
    inc: offer.included,
    category: `annual:${offer.track}:${offer.level}`,
  };
}

function stageFormatToDevis(format: StageFormat): AssistanteDevisOffer {
  return {
    sourceType: 'stage_format',
    sourceId: format.format_id,
    label: `Stage - ${format.title}`,
    display: formatTnd(format.price_per_student),
    paiement: `${formatTnd(format.payment.deposit)} reservation + ${formatTnd(format.payment.solde)} solde`,
    echeancier: compactNumbers([format.payment.deposit, format.payment.solde]),
    desc: `${format.hours} h, groupe de ${format.group_max} max`,
    inc: [`${format.hours} h`, `Groupe de ${format.group_max} max`, `Seuil ouverture ${format.group_min_open}`],
    category: 'stage',
  };
}

function ponctuelOfferToDevis(offer: PonctuelOffer): AssistanteDevisOffer {
  return {
    sourceType: 'ponctuel_offer',
    sourceId: offer.id,
    label: offer.title,
    display: formatTnd(offer.price_per_student),
    paiement: offer.payment.full_at_booking
      ? 'Paiement a la reservation'
      : `${formatTnd(offer.payment.deposit)} reservation + ${formatTnd(offer.payment.solde)} solde`,
    echeancier: compactNumbers([offer.payment.deposit, offer.payment.solde]),
    desc: offer.description,
    inc: [
      offer.public,
      offer.hours != null ? `${offer.hours} h` : null,
      offer.group_max != null ? `Groupe de ${offer.group_max} max` : null,
    ].filter((item): item is string => Boolean(item)),
    category: 'ponctuel',
  };
}

function coachingOfferToDevis(offer: CoachingOffer): AssistanteDevisOffer {
  return {
    sourceType: 'coaching_offer',
    sourceId: offer.id,
    label: offer.title,
    display: formatTnd(offer.price),
    paiement: offer.payment.full_at_booking
      ? 'Paiement a la reservation'
      : `${formatTnd(offer.payment.deposit)} reservation`,
    echeancier: compactNumbers([
      offer.payment.deposit,
      offer.payment.solde,
      ...(offer.payment.solde_schedule ?? []),
    ]),
    desc: offer.format,
    inc: [offer.effectif, offer.deductible ? 'Deductible selon conditions catalogue' : null].filter(
      (item): item is string => Boolean(item),
    ),
    category: 'coaching',
  };
}

function packToDevis(pack: Pack): AssistanteDevisOffer {
  return {
    sourceType: 'pack',
    sourceId: pack.id,
    label: pack.title,
    display: formatTnd(pack.price),
    paiement: `${formatTnd(pack.payment.deposit)} reservation + calendrier catalogue`,
    echeancier: [pack.payment.deposit, ...pack.payment.solde_schedule],
    desc: pack.public,
    inc: pack.components.map((component) => `${component.qty} x ${component.type}`),
    category: 'pack',
  };
}

function specialProgramToDevis(program: SpecialProgram): AssistanteDevisOffer {
  return {
    sourceType: 'special_program',
    sourceId: program.id,
    label: program.title,
    display: formatTnd(program.price_per_student),
    paiement: `${formatTnd(program.payment.deposit)} reservation + ${formatTnd(program.payment.solde)} solde`,
    echeancier: compactNumbers([program.payment.deposit, program.payment.solde]),
    desc: `${program.hours} h, groupe de ${program.group_max} max`,
    inc: [`${program.hours} h`, `Groupe de ${program.group_max} max`],
    category: 'special',
  };
}

function urgenceToDevis(key: string, offer: { title: string; display: string; hourly?: number; amount?: number }): AssistanteDevisOffer {
  return {
    sourceType: 'urgence',
    sourceId: key,
    label: offer.title,
    annual: offer.amount ?? offer.hourly ?? null,
    display: offer.display,
    paiement: 'Selon validation equipe',
    echeancier: compactNumbers([offer.amount ?? offer.hourly]),
    desc: 'Accompagnement en ligne d urgence',
    inc: [offer.display],
    category: 'urgence',
  };
}

export function getAssistanteDevisCatalog(): AssistanteDevisCatalog {
  const pricing = getFullPricingData();
  const catalog: AssistanteDevisCatalog = {
    _meta: {
      source: 'data/pricing.canonical.json',
      loader: 'lib/pricing.ts',
      version: pricing.version,
      currency: pricing.currency,
      counts: {
        annual_offer: 0,
        stage_format: 0,
        ponctuel_offer: 0,
        coaching_offer: 0,
        pack: 0,
        special_program: 0,
        urgence: 0,
      },
    },
  };

  for (const offer of getAllOffers()) {
    catalog[offer.id] = annualOfferToDevis(offer);
    catalog._meta.counts.annual_offer += 1;
  }

  for (const format of getStageFormats()) {
    catalog[`stage:${format.format_id}`] = stageFormatToDevis(format);
    catalog._meta.counts.stage_format += 1;
  }

  for (const offer of getPonctuelOffers()) {
    catalog[`ponctuel:${offer.id}`] = ponctuelOfferToDevis(offer);
    catalog._meta.counts.ponctuel_offer += 1;
  }

  for (const offer of getCoachingOffers()) {
    catalog[`coaching:${offer.id}`] = coachingOfferToDevis(offer);
    catalog._meta.counts.coaching_offer += 1;
  }

  for (const pack of getPacks()) {
    catalog[`pack:${pack.id}`] = packToDevis(pack);
    catalog._meta.counts.pack += 1;
  }

  for (const program of getSpecialPrograms()) {
    catalog[`special:${program.id}`] = specialProgramToDevis(program);
    catalog._meta.counts.special_program += 1;
  }

  for (const [key, offer] of Object.entries(getUrgence())) {
    catalog[`urgence:${key}`] = urgenceToDevis(key, offer);
    catalog._meta.counts.urgence += 1;
  }

  return catalog;
}
