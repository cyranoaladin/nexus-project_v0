/**
 * Maps a computed quote scenario into the `QuotePDFData` shape the
 * existing generic PDF renderer (lib/quote/pdf.ts, wired through
 * POST /api/assistante/quotes/pdf) already accepts. Pure client-safe
 * mapping — no DB, no fs, no server-only import — every input already
 * lives in the assistante workspace's own state (the computed scenario,
 * the selected lead, the created quote's id/validUntil).
 */
import type { QuoteRegulatoryMaturity } from '@prisma/client';
import type { QuotePDFData } from '@/lib/quote/pdf';
import { getLegacyRegulatoryDisclaimer } from './regulatory-maturity';
import { SUBJECT_LABELS } from './subject-labels';
import type { QuoteScenario, SituationInput } from './schemas';

const LEVEL_LABELS: Record<SituationInput['level'], string> = {
  premiere: 'Première',
  terminale: 'Terminale',
};

export interface QuotePdfAdapterInput {
  situation: SituationInput;
  scenario: QuoteScenario;
  quoteId: string;
  validUntil: Date;
  advisorName: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  studentLabel?: string;
  /** Required, never defaulted silently — see LEGACY_REGULATORY_DISCLAIMER above. */
  regulatoryMaturity: QuoteRegulatoryMaturity;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * The quote engine's payment model is a 25% acompte + N regular monthly
 * installments, the last absorbing the rounding remainder (décision D4,
 * docs/audit-devis-candidats-libres.md §5). One row per line keeps the
 * PDF's échéancier table unambiguous instead of collapsing it into a
 * single summarized line that could read like a lump sum.
 */
function buildInstallments(scenario: QuoteScenario): QuotePDFData['offer']['ech'] {
  const regularCount = scenario.months - 1;
  return [
    { label: 'Acompte (25%, non remboursable sauf non-ouverture du groupe)', amount: scenario.deposit },
    ...Array.from({ length: regularCount }, (_, index) => ({
      label: `Mensualité ${index + 1}/${scenario.months}`,
      amount: scenario.monthlyTotal,
    })),
    { label: `Mensualité ${scenario.months}/${scenario.months}`, amount: scenario.lastInstallmentAmount },
  ];
}

function buildIncludedLines(scenario: QuoteScenario): string[] {
  const lines = scenario.lines.map((line) =>
    line.hoursPerMonth != null && line.hoursPerMonth > 0
      ? `${line.label} — ${line.hoursPerMonth} h/mois`
      : line.label,
  );
  return [...lines, ...(scenario.includedFeatures ?? [])];
}

export function buildQuotePdfData(input: QuotePdfAdapterInput): QuotePDFData {
  const {
    situation,
    scenario,
    quoteId,
    validUntil,
    advisorName,
    leadName,
    leadEmail,
    leadPhone,
    studentLabel,
    regulatoryMaturity,
  } = input;
  const levelLabel = LEVEL_LABELS[situation.level];
  const specialiteLabels = situation.specialites.map((subject) => SUBJECT_LABELS[subject] ?? subject);

  return {
    quoteNumber: quoteId,
    generatedAt: formatDate(new Date()),
    validUntil: formatDate(validUntil),
    studentName: studentLabel ?? 'Non renseigné',
    parentName: leadName,
    whatsapp: leadPhone,
    email: leadEmail,
    advisor: advisorName,
    level: levelLabel,
    status: 'Estimation',
    establishment: 'Non renseigné',
    languages: 'Non renseigné',
    currentLevel: levelLabel,
    specialites: specialiteLabels,
    options: [],
    modalite: 'Candidat individuel',
    objectif: 'Baccalauréat général — candidat individuel',
    budget: `${scenario.monthlyTotal} TND / mois`,
    mode: `Acompte ${scenario.deposit} TND (25%) + ${scenario.months} mensualités`,
    reduction: 'Aucune',
    reductionLabels: [],
    hasDirectionOverride: false,
    regulatoryDisclaimer: getLegacyRegulatoryDisclaimer(regulatoryMaturity) ?? undefined,
    publicAnnual: scenario.grandTotal,
    monthlyDisplay: `${scenario.monthlyTotal} TND / mois`,
    economie: null,
    offer: {
      label: `Devis ${scenario.tier}`,
      desc: 'Parcours candidat individuel personnalisé (bac général)',
      annualDisplay: `${scenario.grandTotal} TND / an`,
      inc: buildIncludedLines(scenario),
      ech: buildInstallments(scenario),
    },
    alternatives: [],
  };
}
