import type { CreateInvoiceRequest, InvoicePaymentMethodType, TaxRegime } from './types';

export const NEXUS_VAT_RATE = 0.06;
export const ARIA_MONTHLY_VALUE = 129_000;

export type NexusInvoicePackageId = 'duo-premiere' | 'francais-sprint-eaf' | 'custom';

export type NexusInvoicePackage = {
  id: NexusInvoicePackageId;
  label: string;
  subtitle: string;
  frenchHours: number;
  mathHours: number;
  priceTtc: number;
  normalPriceTtc: number;
};

export type NexusMixedPayment = {
  method: Extract<InvoicePaymentMethodType, 'BANK_TRANSFER' | 'CHEQUE' | 'CASH'>;
  amount: number;
  reference: string;
};

export type NexusInvoiceTotalsInput = {
  priceTtc: number;
  normalPriceTtc: number;
  adjustmentTtc: number;
  payments: NexusMixedPayment[];
  ariaMonths: number;
  ariaMonthlyValue: number;
};

export type NexusInvoiceTotals = {
  priceTtc: number;
  adjustmentTtc: number;
  netTtc: number;
  netHt: number;
  vat: number;
  normalPriceTtc: number;
  packageDiscount: number;
  paid: number;
  due: number;
  ariaOfferedValue: number;
};

export type NexusInvoiceRequestInput = NexusInvoiceTotalsInput & {
  customerName: string;
  customerInfo: string;
  invoiceNumber?: string;
  invoiceDate: string;
  packageLabel: string;
  packageSubtitle: string;
  frenchHours: number;
  mathHours: number;
  adjustmentLabel: string;
  notes: string;
};

export type NexusCreateInvoiceRequest = Omit<CreateInvoiceRequest, 'items'> & {
  number?: string;
  issuedAt?: string;
  items: Array<CreateInvoiceRequest['items'][number] & { total: number }>;
};

export const NEXUS_INVOICE_PACKAGES: NexusInvoicePackage[] = [
  {
    id: 'duo-premiere',
    label: 'Duo Première — Français + Maths',
    subtitle: 'Les deux épreuves anticipées dans une seule formule cohérente.',
    frenchHours: 16,
    mathHours: 14,
    priceTtc: 1_149_000,
    normalPriceTtc: 1_188_000,
  },
  {
    id: 'francais-sprint-eaf',
    label: 'Français Première — Sprint EAF',
    subtitle: "Préparation ciblée à l'écrit et à l'oral du Français.",
    frenchHours: 16,
    mathHours: 0,
    priceTtc: 649_000,
    normalPriceTtc: 649_000,
  },
  {
    id: 'custom',
    label: 'Forfait personnalisé',
    subtitle: 'Configuration libre selon le volume horaire retenu.',
    frenchHours: 0,
    mathHours: 0,
    priceTtc: 0,
    normalPriceTtc: 0,
  },
];

export function tndToMillimes(value: number): number {
  return Math.round(value * 1000);
}

export function millimesToTnd(value: number): number {
  return value / 1000;
}

export function formatTnd(value: number): string {
  return `${millimesToTnd(value).toLocaleString('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} TND`;
}

export function calculateNexusInvoiceTotals(input: NexusInvoiceTotalsInput): NexusInvoiceTotals {
  const priceTtc = Math.max(0, Math.round(input.priceTtc));
  const adjustmentTtc = Math.min(Math.max(0, Math.round(input.adjustmentTtc)), priceTtc);
  const netTtc = priceTtc - adjustmentTtc;
  const netHt = Math.round(netTtc / (1 + NEXUS_VAT_RATE));
  const vat = netTtc - netHt;
  const normalPriceTtc = Math.max(priceTtc, Math.round(input.normalPriceTtc));
  const packageDiscount = Math.max(0, normalPriceTtc - priceTtc);
  const paid = Math.min(
    netTtc,
    input.payments.reduce((sum, payment) => sum + Math.max(0, Math.round(payment.amount)), 0)
  );
  const due = Math.max(0, netTtc - paid);
  const ariaOfferedValue =
    Math.max(0, Math.round(input.ariaMonths)) * Math.max(0, Math.round(input.ariaMonthlyValue));

  return {
    priceTtc,
    adjustmentTtc,
    netTtc,
    netHt,
    vat,
    normalPriceTtc,
    packageDiscount,
    paid,
    due,
    ariaOfferedValue,
  };
}

export function buildPaymentSummary(payments: NexusMixedPayment[]): string[] {
  return payments
    .filter((payment) => payment.amount > 0)
    .map((payment) => {
      const label = payment.method === 'BANK_TRANSFER'
        ? 'Virement bancaire'
        : payment.method === 'CHEQUE'
          ? 'Chèque'
          : 'Espèces';
      const reference = payment.reference.trim();
      return `${label} : ${formatTnd(payment.amount)}${reference ? ` (${reference})` : ''}`;
    });
}

export function buildNexusInvoiceRequest(input: NexusInvoiceRequestInput): NexusCreateInvoiceRequest {
  const totals = calculateNexusInvoiceTotals(input);
  const paymentSummary = buildPaymentSummary(input.payments);
  const nonZeroPayments = input.payments.filter((payment) => payment.amount > 0);
  const distinctPaymentMethods = new Set(nonZeroPayments.map((payment) => payment.method));
  const taxRegime: TaxRegime = 'TVA_INCLUSE';
  const packageDiscountNote = totals.packageDiscount > 0
    ? `Prix forfaitaire incluant une remise commerciale de ${formatTnd(totals.packageDiscount)} par rapport au tarif normal.`
    : null;
  const mainDescription = [
    input.packageSubtitle,
    `Français : ${input.frenchHours || 0}h · Mathématiques : ${input.mathHours || 0}h`,
    packageDiscountNote,
  ].filter(Boolean).join('\n');

  const items: NexusCreateInvoiceRequest['items'] = [
    {
      label: input.packageLabel,
      description: mainDescription,
      qty: 1,
      unitPrice: input.priceTtc,
      total: input.priceTtc,
    },
  ];

  items.push({
    label: 'Accès plateforme EAF — ARIA offert',
    description: [
      `Valeur normale : ${formatTnd(input.ariaMonthlyValue)} / mois · ${input.ariaMonths} mois`,
      'Accès ARIA offert à titre commercial, non facturé.',
    ].join('\n'),
    qty: Math.max(1, Math.round(input.ariaMonths || 1)),
    unitPrice: 0,
    total: 0,
  });

  // TODO: Normalize mixed payments into a dedicated table when the invoice schema evolves.
  const paymentDetailsNotes = [
    paymentSummary.length > 0 ? `Paiements mixtes : ${paymentSummary.join(' | ')}` : null,
    `Net payé : ${formatTnd(totals.paid)}`,
    `Reste à payer : ${formatTnd(totals.due)}`,
  ].filter(Boolean).join('\n');
  const notes = [
    input.notes,
    paymentDetailsNotes,
  ].filter(Boolean).join('\n');

  return {
    number: input.invoiceNumber?.trim() || undefined,
    issuedAt: input.invoiceDate,
    customer: {
      name: input.customerName.trim(),
      address: input.customerInfo.trim() || null,
    },
    items,
    discountTotal: totals.adjustmentTtc,
    taxRegime,
    paymentMethod: distinctPaymentMethods.size === 1 ? nonZeroPayments[0]?.method ?? null : null,
    paymentDetails: paymentDetailsNotes ? { notes: paymentDetailsNotes } : null,
    notes,
    issuer: {
      name: 'M&M ACADEMY (NEXUS RÉUSSITE)',
      address: 'Centre Urbain Nord, Immeuble VENUS, Appt C13, 1082 – Tunis',
      mf: '1948837 N/A/M/000',
      phone: '+216 99 19 28 29',
      email: 'contact@nexusreussite.academy',
      web: 'nexusreussite.academy',
      slogan: 'Viser. Atteindre. Dépasser.',
    },
  };
}
