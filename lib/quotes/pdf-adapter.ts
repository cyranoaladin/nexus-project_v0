/**
 * Maps a computed quote scenario into the `QuotePDFData` shape the
 * existing generic PDF renderer (lib/quote/pdf.ts, wired through
 * POST /api/assistante/quotes/pdf) already accepts. Pure client-safe
 * mapping — no DB, no fs, no server-only import — every input already
 * lives in the assistante workspace's own state (the computed scenario,
 * the selected lead, the created quote's id/validUntil).
 */
import type { Subject } from '@prisma/client';
import type { QuotePDFData } from '@/lib/quote/pdf';
import type { QuoteScenario, SituationInput } from './schemas';

const LEVEL_LABELS: Record<SituationInput['level'], string> = {
  premiere: 'Première',
  terminale: 'Terminale',
};

/**
 * Duplicated from lib/quotes/exam-profile.ts's SUBJECT_LABELS (same reason
 * components/quotes/DevisWizard.tsx duplicates it): exam-profile.ts also
 * value-imports lib/exams/catalog.ts, which has `import 'server-only'` at
 * module scope. This adapter is imported directly (as a value, for
 * buildQuotePdfData) by the client component DevisWorkspace.tsx, so pulling
 * in exam-profile.ts here would drag the server-only module into the
 * client bundle and fail the build — keep in sync manually.
 */
const SUBJECT_LABELS: Record<Subject, string> = {
  MATHEMATIQUES: 'Mathématiques',
  MATHS_EXPERTES: 'Mathématiques expertes',
  NSI: 'NSI',
  FRANCAIS: 'Français',
  PHILOSOPHIE: 'Philosophie',
  HISTOIRE_GEO: 'Histoire-Géographie',
  ANGLAIS: 'Anglais',
  ESPAGNOL: 'Espagnol',
  PHYSIQUE_CHIMIE: 'Physique-Chimie',
  SVT: 'SVT',
  SES: 'SES',
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
}

function formatDate(value: Date): string {
  return value.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * The quote engine's `payment` model is deposit:0 + N equal monthly
 * installments (mission decision, see CDC on payment model) — one row per
 * month keeps the PDF's échéancier table unambiguous instead of collapsing
 * it into a single summarized line that could read like a lump sum.
 */
function buildInstallments(scenario: QuoteScenario): QuotePDFData['offer']['ech'] {
  return Array.from({ length: scenario.months }, (_, index) => ({
    label: `Mensualité ${index + 1}/${scenario.months}`,
    amount: scenario.monthlyTotal,
  }));
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
  const { situation, scenario, quoteId, validUntil, advisorName, leadName, leadEmail, leadPhone, studentLabel } =
    input;
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
    mode: `Mensualités égales (${scenario.months} mois, sans acompte)`,
    reduction: 'Aucune',
    reductionLabels: [],
    hasDirectionOverride: false,
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
