/**
 * Maps a PERSISTED Quote row (Quote & { lines }) into the QuotePDFData shape
 * the existing generic PDF renderer (lib/quote/pdf.ts) already accepts —
 * mission "vers un produit complet" §4 (closing the candidat-individuel /
 * PDF integration gap, without a second PDF engine or a second quote
 * model). Separate file from pdf-adapter.ts (client-safe, no DB) because
 * this one reads collectQuoteEmissionBlockers (emission-guard.ts,
 * `import 'server-only'`) and is only ever called from a server route.
 *
 * Deliberately reads ONLY what's already frozen on the Quote/QuoteLine
 * rows and (when present) snapshotCarte — never recomputes pricing or
 * rules from the current catalogue/config (the mission's explicit
 * requirement: "à partir de la révision et des snapshots persistés du
 * Quote, et non d'une recomposition"). Never reads snapshotRegles into the
 * DTO (costPolicy/margin data must never reach a PDF).
 */
import 'server-only';
import type { Quote, QuoteLine } from '@prisma/client';
import type { QuotePDFData, QuoteCarteExamenPdfData, QuoteCarteExamenEpreuvePdfData } from '@/lib/quote/pdf';
import { collectQuoteEmissionBlockers } from './emission-guard';
import { A_VERIFIER } from '@/lib/exams/a-verifier';

const EPREUVE_STATUT_LABELS: Record<string, string> = {
  A_PRESENTER: 'À présenter',
  CONSERVEE: 'Conservée',
  DISPENSEE: 'Dispensée',
  RECONDUITE: 'Reconduite — à vérifier',
};

const MODALITY_LABELS: Record<string, string> = {
  PILOTAGE: 'Pilotage',
  GROUPE: 'Petit groupe',
  DUO: 'Duo',
  INDIVIDUEL: 'Individuel',
  PACK: 'Parcours combiné',
};

function formatDate(value: Date): string {
  return value.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Same payment-model shape as pdf-adapter.ts::buildInstallments, but read
 * from the persisted Quote row instead of a live QuoteScenario — both
 * engines write the exact same deposit/monthlyTotal/grandTotal/
 * lastInstallmentAmount/paymentPolicy columns (lib/quotes/persistence.
 * server.ts::createQuote), so this single function is correct for legacy
 * AND candidat-individuel quotes alike.
 *
 * P11 (SVC_SECOND_GROUPE, "100% à la réservation, pas d'échéancier
 * annuel") is now wired end-to-end (mission "vers un produit complet",
 * lot de fermeture P11 — lib/quotes/pipeline.ts branches on
 * carte.parcours.parcoursPrincipal==='P11_SECOND_GROUPE' before any
 * standard subject-priority pricing runs, and
 * lib/quotes/pricing-engine.ts::buildSecondGroupeScenarios sets
 * paymentPolicy='PAY_IN_FULL_AT_BOOKING' explicitly). `quote.paymentPolicy`
 * is the single unambiguous discriminant — never re-derived from
 * `months===1` or `deposit===null` (the latter means something else
 * entirely: an historical pre-D4 row, see below), which is exactly the
 * ambiguity this column was added to remove.
 */
function buildInstallmentsFromQuote(quote: Quote, lines: QuoteLine[]): QuotePDFData['offer']['ech'] {
  if (quote.paymentPolicy === 'PAY_IN_FULL_AT_BOOKING') {
    return [{ label: 'Paiement intégral à la réservation (P11 — pas d\'échéancier annuel)', amount: quote.grandTotal }];
  }
  if (quote.deposit == null) {
    // Historical rows predating décision D4 (0% acompte model) — with
    // paymentPolicy now the authoritative discriminant, a null deposit
    // AND no explicit paymentPolicy can only mean this — an old row
    // created before this column existed. The ONLY thing a null
    // Quote.deposit means today for any OTHER row (schema.prisma's own
    // doc comment) — same disclosure the family page already gives.
    return [{ label: 'Montant unique — échéancier historique (émis avant la mise à jour de l\'échéancier)', amount: quote.grandTotal }];
  }
  const regularAmount = quote.monthlyTotal;
  const lastAmount = quote.lastInstallmentAmount ?? quote.monthlyTotal;
  // Every line shares the same `months` value (persistence.server.ts::
  // createQuote applies input.scenario.months uniformly) — the authoritative
  // installment count, never re-derived by dividing amounts (a
  // deposit/monthlyTotal/lastInstallmentAmount combination need not divide
  // evenly; the real invariant is a fixed month count, not an amount ratio).
  const totalMonths = lines[0]?.months ?? 10;
  const regularCount = Math.max(0, totalMonths - 1);
  // Commercial decision 2026-09-02 (URGENT FAIR HOTFIX, supersedes D4):
  // candidat-individuel is now sans acompte — 10 mensualités identiques.
  // quote.deposit is the real discriminant (never the paymentPolicy enum
  // name, which is not renamed here — no DB migration authorized for this
  // hotfix): deposit===0 shows no acompte row at all, only the 10 real
  // mensualités, exactly matching the family-facing wording required.
  // deposit>0 is preserved as-is for any historical row still carrying a
  // real acompte (backward-compatible read path, never rewritten).
  const acompteRow = quote.deposit > 0 ? [{ label: 'Acompte (non remboursable sauf non-ouverture du groupe)', amount: quote.deposit }] : [];
  return [
    ...acompteRow,
    ...Array.from({ length: regularCount }, (_, index) => ({
      label: `Mensualité ${index + 1}/${totalMonths}`,
      amount: regularAmount,
    })),
    { label: `Mensualité ${totalMonths}/${totalMonths}`, amount: lastAmount },
  ];
}

function buildIncludedLinesFromQuote(lines: QuoteLine[]): string[] {
  return lines
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((line) => {
      const modality = MODALITY_LABELS[line.modality] ?? line.modality;
      const hours = line.hoursPerMonth != null && line.hoursPerMonth > 0 ? ` — ${line.hoursPerMonth} h/mois` : '';
      return `${line.subject}${hours} (${modality})`;
    });
}

interface SnapshotCarteEpreuveShape {
  libelle?: unknown;
  matiere?: unknown;
  statut?: unknown;
  coefficientEffectif?: unknown;
  sourceReglementaire?: unknown;
}

interface SnapshotCarteInnerShape {
  parcours?: { parcoursPrincipal?: unknown };
  epreuves?: unknown;
  avertissementsGeneraux?: unknown;
}

/**
 * Matches exactly what app/api/assistante/candidat-individuel/profils/[id]/
 * quote/route.ts persists: `{ carte: result.carte, emissionAutomatiqueAutorisee,
 * necessiteVerificationHumaine }` — the two booleans are duplicated at the
 * TOP level (read by emission-guard.ts::parseSnapshotCarte, the same field
 * names, so this PDF's "revue humaine nécessaire" badge always agrees with
 * the actual emission gate, never a second source of truth), while the
 * exam-card detail (épreuves/parcours/avertissements) lives nested under
 * `.carte` (the raw CarteExamenResult, lib/exams/carte.ts).
 */
interface SnapshotCarteShape {
  carte?: SnapshotCarteInnerShape;
  necessiteVerificationHumaine?: unknown;
}

/** Defensive, non-throwing parse — a malformed/legacy-shaped snapshot must never crash PDF generation, only omit the carte section. */
function parseCarteExamenForPdf(raw: unknown): QuoteCarteExamenPdfData | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const snapshot = raw as SnapshotCarteShape;
  const carte = snapshot.carte;
  if (carte == null || typeof carte !== 'object') return null;

  const epreuvesRaw = Array.isArray(carte.epreuves) ? (carte.epreuves as SnapshotCarteEpreuveShape[]) : [];
  const epreuves: QuoteCarteExamenEpreuvePdfData[] = epreuvesRaw.map((epreuve) => {
    const coefficientRaw = epreuve.coefficientEffectif;
    const coefficient =
      coefficientRaw === A_VERIFIER
        ? 'À vérifier'
        : typeof coefficientRaw === 'number'
          ? String(coefficientRaw)
          : 'À vérifier';
    return {
      libelle: typeof epreuve.libelle === 'string' ? epreuve.libelle : 'Épreuve',
      matiere: typeof epreuve.matiere === 'string' ? epreuve.matiere : '',
      statut: EPREUVE_STATUT_LABELS[String(epreuve.statut)] ?? String(epreuve.statut ?? 'À présenter'),
      coefficient,
      source: typeof epreuve.sourceReglementaire === 'string' ? epreuve.sourceReglementaire : 'Référentiel session',
    };
  });

  return {
    parcoursLabel: typeof carte.parcours?.parcoursPrincipal === 'string' ? carte.parcours.parcoursPrincipal : 'Non renseigné',
    necessiteVerificationHumaine: snapshot.necessiteVerificationHumaine === true,
    epreuves,
    avertissements: Array.isArray(carte.avertissementsGeneraux) ? carte.avertissementsGeneraux.filter((a): a is string => typeof a === 'string') : [],
  };
}

export interface QuotePdfFromPersistedQuoteInput {
  quote: Quote & { lines: QuoteLine[] };
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  studentName: string;
  advisorName: string;
}

/**
 * Builds the PDF DTO for ANY persisted Quote — legacy or candidat-
 * individuel, both populate the exact same Quote/QuoteLine columns
 * (persistence.server.ts::createQuote). The candidat-individuel-specific
 * additions (carteExamen page, brouillon banner) activate automatically
 * from what the row actually carries (profilId/snapshotCarte), never from
 * a caller-supplied "which engine" flag.
 *
 * Callers of this function MUST restrict it to quote.profilId != null
 * (candidat-individuel-sourced rows) — the legacy flow keeps using its own
 * established client-driven path (buildQuotePdfData + POST /api/assistante/
 * quotes/pdf), untouched by this addition.
 */
export function buildQuotePdfDataFromPersistedQuote(input: QuotePdfFromPersistedQuoteInput): QuotePDFData {
  const { quote, parentName, parentEmail, parentPhone, studentName, advisorName } = input;

  const blockers = collectQuoteEmissionBlockers(quote);
  const isDraft = blockers.length > 0;
  const carteExamen = parseCarteExamenForPdf(quote.snapshotCarte);

  return {
    quoteNumber: quote.id,
    generatedAt: formatDate(new Date()),
    validUntil: formatDate(quote.validUntil),
    studentName,
    parentName,
    whatsapp: parentPhone,
    email: parentEmail,
    advisor: advisorName,
    level: carteExamen?.parcoursLabel ?? 'Candidat individuel',
    status: quote.status,
    establishment: 'Non renseigné',
    languages: 'Non renseigné',
    currentLevel: carteExamen?.parcoursLabel ?? 'Candidat individuel',
    specialites: [],
    options: [],
    modalite: 'Candidat individuel',
    objectif: 'Baccalauréat général — candidat individuel',
    budget: `${quote.budget} TND / mois`,
    mode:
      quote.paymentPolicy === 'PAY_IN_FULL_AT_BOOKING'
        ? 'Paiement intégral à la réservation (P11)'
        : quote.deposit == null
          ? 'Paiement intégral à la réservation (P11)'
          : quote.deposit > 0
            ? `Acompte ${quote.deposit} TND + mensualités`
            : 'Sans acompte · mensualités',
    reduction: 'Aucune',
    reductionLabels: [],
    hasDirectionOverride: false,
    regulatoryDisclaimer: isDraft
      ? 'Ce document est un brouillon interne : la carte d\'examen n\'a pas encore franchi toutes les conditions d\'émission automatique. Ne jamais transmettre en l\'état à une famille — une revue humaine explicite est nécessaire avant toute émission définitive.'
      : undefined,
    draftBannerTitle: isDraft ? 'BROUILLON INTERNE — NE PAS ENVOYER' : undefined,
    publicAnnual: quote.grandTotal,
    monthlyDisplay: `${quote.monthlyTotal} TND / mois`,
    economie: null,
    carteExamen: carteExamen ?? undefined,
    offer: {
      label: `Devis ${quote.id}`,
      desc: 'Parcours candidat individuel personnalisé (bac général)',
      annualDisplay: `${quote.grandTotal} TND / an`,
      inc: buildIncludedLinesFromQuote(quote.lines),
      ech: buildInstallmentsFromQuote(quote, quote.lines),
    },
    alternatives: [],
  };
}
