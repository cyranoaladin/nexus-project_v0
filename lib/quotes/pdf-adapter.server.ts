/**
 * Maps an ALREADY-PERSISTED Quote (post creation, with
 * deposit/lastInstallmentAmount/parcours already frozen) into the
 * existing generic QuotePDFData shape (lib/quote/pdf.ts's renderQuotePDF
 * — the one and only PDF renderer). Companion to pdf-adapter.ts (which
 * maps an EPHEMERAL, pre-persistence QuoteScenario for the assistante
 * workspace's live preview) — this one is for rendering a PDF of a quote
 * that already exists in the DB (Track A, Section 11's candidat-individuel
 * flow). No new renderer, no new engine.
 *
 * PDF_NO_INTERNAL_ENUMS / PDF_NO_TECHNICAL_LEAK: every string value here
 * is either a human label (mapped through a lookup table, never a raw
 * enum literal) or a number formatted inline — no id/checksum/version
 * field is ever interpolated into a rendered string.
 */
import 'server-only';
import type { Quote, QuoteLine } from '@prisma/client';
import type { QuotePDFData } from '@/lib/quote/pdf';

export interface PersistedQuotePdfContext {
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  advisorName: string;
  /** Human label — never the raw CandidateLevel/Prisma enum. */
  levelLabel: string;
  /** Human labels — never the raw Subject enum values. */
  specialiteLabels: string[];
  studentLabel?: string;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * quote.deposit is the real payment-schedule discriminant (2026-09-02
 * commercial decision: 0 for every current candidat-individuel quote) —
 * never the paymentPolicy enum's value name. deposit=0 renders no acompte
 * row at all; deposit>0 (a legacy row) renders exactly one.
 */
function buildInstallments(quote: Quote, linesCount: number): QuotePDFData['offer']['ech'] {
  const totalMonths = linesCount > 0 ? 10 : 10; // candidat-individuel is always a 10-month year
  const hasDeposit = quote.deposit != null && quote.deposit > 0;
  const acompteRow = hasDeposit
    ? [{ label: 'Acompte (non remboursable sauf non-ouverture du groupe)', amount: quote.deposit! }]
    : [];
  const regularCount = totalMonths - (hasDeposit ? 1 : 0) - 1;
  const regularAmount = quote.monthlyTotal;
  const lastAmount = quote.lastInstallmentAmount ?? quote.monthlyTotal;

  return [
    ...acompteRow,
    ...Array.from({ length: regularCount }, (_, index) => ({
      label: `Mensualité ${index + 1}/${totalMonths - (hasDeposit ? 1 : 0)}`,
      amount: regularAmount,
    })),
    {
      label: `Mensualité ${totalMonths - (hasDeposit ? 1 : 0)}/${totalMonths - (hasDeposit ? 1 : 0)}`,
      amount: lastAmount,
    },
  ];
}

function buildIncludedLines(lines: QuoteLine[]): string[] {
  return lines
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((line) => (line.hoursPerMonth != null && line.hoursPerMonth > 0 ? `${line.subject} — ${line.hoursPerMonth} h/mois` : line.subject));
}

export function buildQuotePdfDataFromPersistedQuote(
  quote: Quote,
  lines: QuoteLine[],
  context: PersistedQuotePdfContext,
): QuotePDFData {
  const hasDeposit = quote.deposit != null && quote.deposit > 0;

  return {
    quoteNumber: quote.id,
    generatedAt: formatDate(quote.createdAt),
    validUntil: formatDate(quote.validUntil),
    studentName: context.studentLabel ?? 'Non renseigné',
    parentName: context.leadName,
    whatsapp: context.leadPhone,
    email: context.leadEmail,
    advisor: context.advisorName,
    level: context.levelLabel,
    status: 'Estimation',
    establishment: 'Non renseigné',
    languages: 'Non renseigné',
    currentLevel: context.levelLabel,
    specialites: context.specialiteLabels,
    options: [],
    modalite: 'Candidat individuel',
    objectif: 'Baccalauréat général — candidat individuel',
    budget: `${quote.monthlyTotal} TND / mois`,
    mode: hasDeposit
      ? `Acompte ${quote.deposit} TND + mensualités`
      : 'Sans acompte · mensualités',
    reduction: 'Aucune',
    reductionLabels: [],
    hasDirectionOverride: false,
    publicAnnual: quote.grandTotal,
    monthlyDisplay: `${quote.monthlyTotal} TND / mois`,
    economie: null,
    offer: {
      label: 'Devis candidat individuel',
      desc: 'Parcours candidat individuel personnalisé (bac général)',
      annualDisplay: `${quote.grandTotal} TND / an`,
      inc: buildIncludedLines(lines),
      ech: buildInstallments(quote, lines.length),
    },
    alternatives: [],
  };
}
