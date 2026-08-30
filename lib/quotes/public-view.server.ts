import 'server-only';

import { getQuoteByPublicToken, markQuoteConsultedIfSent, type QuoteLookupResult } from './persistence.server';
import { collectQuoteEmissionBlockers } from './emission-guard';
import { serializeError } from '@/lib/utils/serialize-error';
import { prisma } from '@/lib/prisma';
import {
  buildPersistedQuoteInstallments,
  humanizeLineSubject,
  humanizePersistedQuoteParcours,
  humanizeQuoteStatus,
} from './pdf-adapter.server';
import { formatLanguageLabels, SUBJECT_LABELS } from './exam-profile';
import { SPECIALITE_ABANDONNEE_WARNING } from './pricing';
import { canTransition } from './status';

const FAMILY_MODALITY_LABELS: Record<string, string> = {
  PILOTAGE: 'Pilotage Nexus',
  GROUPE: 'Petit groupe',
  DUO: 'Duo',
  INDIVIDUEL: 'Individuel',
  PACK: 'Parcours combiné',
};

const FAMILY_LEVEL_LABELS: Record<string, string> = {
  PREMIERE: 'Première',
  TERMINALE: 'Terminale',
};

export interface FamilyQuoteView {
  statusLabel: string;
  canAccept: boolean;
  hasPdf: boolean;
  examSession: number;
  validUntil: string;
  currency: 'TND';
  responsable: { name: string; email: string; phone: string | null } | null;
  eleve: { firstName: string | null; lastName: string | null; displayName: string } | null;
  profil: {
    level: string;
    parcours: string | null;
    specialites: string[];
    specialiteAbandonnee: string | null;
    langues: string[];
  } | null;
  mensualite: number;
  totalAnnuel: number;
  acompte: number | null;
  nombreMensualites: number;
  echeancier: Array<{ label: string; amount: number }>;
  lines: Array<{
    subject: string;
    format: string;
    hoursPerMonth: number | null;
    unitPrice: number;
    months: number;
    lineTotal: number;
  }>;
  warnings: string[];
}

export interface FamilyQuoteViewResult {
  quote: FamilyQuoteView | null;
  reason?: QuoteLookupResult['reason'];
}

/**
 * Single family-facing quote read path for both the HTML page and JSON API.
 * Recording a first consultation is best-effort: an audit write must never
 * make an otherwise valid family link unavailable.
 *
 * Gate added by mission "vers un produit complet" §4/§6: a candidat-
 * individuel-sourced quote (profilId set) must never be viewable through
 * its signed link while it's still an internal brouillon —
 * collectQuoteEmissionBlockers is the SAME single canonical gate already
 * used for send/accept (lib/quotes/emission-guard.ts), never a second
 * check duplicating its logic. Scoped strictly to profilId != null: every
 * legacy quote (profilId null) keeps its exact prior behavior — this is
 * additive, not a change to the live legacy family-consultation flow.
 * Returns the generic NOT_FOUND reason (never a distinct "not ready" one)
 * so a guessed/leaked token for an unready quote can't be distinguished
 * from an invalid one.
 */
export async function getQuoteForFamilyView(rawToken: string): Promise<QuoteLookupResult> {
  const result = await getQuoteByPublicToken(rawToken);
  if (!result.quote) return result;

  if (result.quote.profilId != null && collectQuoteEmissionBlockers(result.quote).length > 0) {
    return { quote: null, reason: 'NOT_FOUND' };
  }

  if (result.quote.status !== 'DEVIS_ENVOYE') return result;

  try {
    const consultedAt = await markQuoteConsultedIfSent(result.quote.id);
    if (consultedAt) {
      return {
        ...result,
        quote: { ...result.quote, status: 'DEVIS_CONSULTE', consultedAt },
      };
    }
  } catch (error) {
    console.error('[quotes/public-view] auto-consult transition failed', serializeError(error));
  }

  return result;
}

function safeFamilySubject(subject: string, profil: Parameters<typeof humanizeLineSubject>[1]): string {
  const humanized = humanizeLineSubject(subject, profil);
  return /\b(?:MOD|SVC|P\d{1,2})_[A-Z0-9_]+\b/.test(humanized)
    ? 'Accompagnement pédagogique'
    : humanized;
}

/**
 * Strict family DTO used by the public HTML and JSON surfaces. The raw
 * persisted aggregate remains server-only for the PDF adapter; adding a
 * field to Quote or QuoteLine cannot make it public by accident.
 */
export async function getFamilyQuoteView(rawToken: string): Promise<FamilyQuoteViewResult> {
  const result = await getQuoteForFamilyView(rawToken);
  if (!result.quote) return { quote: null, reason: result.reason };

  const quote = result.quote;
  const responsable = quote.contactLeadId
    ? await prisma.contactLead.findUnique({
        where: { id: quote.contactLeadId },
        select: { name: true, email: true, phone: true },
      })
    : null;
  const installmentCount = Math.max(0, ...quote.lines.map((line) => line.months));
  const warnings = quote.lines.some((line) => line.reason.includes(SPECIALITE_ABANDONNEE_WARNING))
    ? [SPECIALITE_ABANDONNEE_WARNING]
    : [];
  const student = quote.student?.user ?? null;
  const studentDisplayName = student
    ? [student.firstName, student.lastName].filter(Boolean).join(' ').trim()
    : '';
  const profil = quote.profil;

  return {
    quote: {
      statusLabel: humanizeQuoteStatus(quote.status),
      canAccept: canTransition(quote.status, 'ACCEPTE'),
      hasPdf: quote.profilId != null,
      examSession: quote.examSession,
      validUntil: new Date(quote.validUntil).toISOString(),
      currency: 'TND',
      responsable,
      eleve: student
        ? { firstName: student.firstName, lastName: student.lastName, displayName: studentDisplayName || 'Élève' }
        : null,
      profil: profil
        ? {
            level: FAMILY_LEVEL_LABELS[profil.level] ?? 'Niveau à confirmer',
            parcours: humanizePersistedQuoteParcours(quote),
            specialites: [SUBJECT_LABELS[profil.specialite1], SUBJECT_LABELS[profil.specialite2]],
            specialiteAbandonnee: profil.specialiteAbandonnee
              ? SUBJECT_LABELS[profil.specialiteAbandonnee]
              : null,
            langues: formatLanguageLabels(profil.langueA, profil.langueB),
          }
        : null,
      mensualite: quote.monthlyTotal,
      totalAnnuel: quote.grandTotal,
      acompte: quote.deposit ?? null,
      nombreMensualites: installmentCount,
      echeancier: buildPersistedQuoteInstallments(quote, quote.lines),
      lines: quote.lines
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((line) => ({
          subject: safeFamilySubject(line.subject, profil),
          format: FAMILY_MODALITY_LABELS[line.modality] ?? 'Format à confirmer',
          hoursPerMonth: line.hoursPerMonth,
          unitPrice: line.unitPrice,
          months: line.months,
          lineTotal: line.lineTotal,
        })),
      warnings,
    },
  };
}
