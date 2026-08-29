/**
 * Maps subject priorities onto canonical volumes and prices (CDC §19).
 *
 * Reads exclusively from lib/pricing.ts (the single source of truth) — no
 * price or hour threshold is invented here beyond the *mapping* from
 * priority to one of the canonical module tiers. Pure, no React, no DB.
 */
import { getCandidatIndividuelModules, getRules } from '@/lib/pricing';
import type { SubjectPriority } from './priority';
import { ALWAYS_INCLUDED_PRIORITY_SCORE, type NotRecommendedSubject, type RecommendedLine } from './schemas';
// T5R6 — re-exported for every existing server-side consumer of this
// module; the constant itself lives in the client-safe ./warnings (this
// file transitively imports lib/pricing.ts's `'server-only'`, so it can
// never be imported directly from a 'use client' component).
import { SPECIALITE_ABANDONNEE_WARNING } from './warnings';
export { SPECIALITE_ABANDONNEE_WARNING };

/**
 * Priority -> hour volume decision table. A documented, centralized
 * business rule (CDC §19) — never re-derived ad hoc per consumer.
 *   - A subject excluded by the priority engine (SOLIDE, or a
 *     ponctuelle-only subject without a real diagnosed weakness) gets 0h.
 *   - Otherwise the volume scales with both the diagnosed tier and
 *     whether the subject is foundational (EDS/anticipées/philosophie) or
 *     ponctuelle-only — a ponctuelle-only subject never jumps straight to
 *     the maximum tier, even at A_RECTIFIER.
 */
function volumeForSubject(subject: SubjectPriority, isFoundational: boolean): 0 | 4 | 8 | 12 {
  if (subject.excludeFromRegularSupport) return 0;
  switch (subject.tier) {
    case 'A_RECTIFIER':
      return isFoundational ? 12 : 8;
    case 'A_INSTALLER':
      return isFoundational ? 8 : 4;
    case 'A_CONSOLIDER':
      return isFoundational ? 4 : 0; // ponctuelle+A_CONSOLIDER is already excluded upstream
    case 'NON_EVALUE':
      return isFoundational ? 4 : 0; // ponctuelle+NON_EVALUE is already excluded upstream
    case 'SOLIDE':
      return 0;
  }
}

function notRecommendedReason(subject: SubjectPriority, isFoundational: boolean): string {
  if (subject.tier === 'SOLIDE') {
    return `${subject.label} : bilan solide → travail autonome recommandé pour le moment.`;
  }
  if (!isFoundational) {
    return `${subject.label} : évaluation ponctuelle sans fragilité identifiée → pas d'accompagnement régulier recommandé actuellement.`;
  }
  return `${subject.label} : aucun accompagnement régulier nécessaire selon le diagnostic actuel.`;
}

export interface IdealRecommendation {
  lines: RecommendedLine[];
  notRecommended: NotRecommendedSubject[];
}

/**
 * Builds the pedagogically ideal recommendation (before any budget
 * constraint) — always includes Pilotage, one module line per subject that
 * needs regular support, and a bounded Grand Oral line when relevant.
 */
export function buildIdealRecommendation(
  subjectPriorities: SubjectPriority[],
  foundationalSubjects: Set<string>,
): IdealRecommendation {
  const modules = getCandidatIndividuelModules();
  const rules = getRules();
  const petitGroupeByHours = new Map(modules.petit_groupe.map((m) => [m.hours_per_month, m]));

  const lines: RecommendedLine[] = [
    {
      subject: 'pilotage',
      label: modules.pilotage.title,
      modality: 'PILOTAGE',
      hoursPerMonth: 0,
      unitPriceMonthly: modules.pilotage.price_monthly,
      priorityScore: ALWAYS_INCLUDED_PRIORITY_SCORE,
      priorityLabel: 'haute',
      reason: 'Cadrage stratégique, calendrier et suivi — socle de tout parcours candidat individuel.',
    },
  ];
  const notRecommended: NotRecommendedSubject[] = [];

  for (const subject of subjectPriorities) {
    const isFoundational = foundationalSubjects.has(subject.subject);

    if (subject.subject === 'grand-oral' && !subject.excludeFromRegularSupport) {
      const policy = rules.grand_oral_policy;
      const forfaitTotal = policy.total_hours_max * modules.individuel.price_per_hour_min;
      // Amortized over the 10 mensualités, like every other candidat
      // individuel service — the family sees one flat monthly price, not a
      // separate one-off charge. The forfait total (not x10) is what's
      // actually owed across the year.
      const amortizedMonthly = Math.round(forfaitTotal / 10);
      lines.push({
        subject: 'grand-oral',
        label: 'Grand Oral',
        modality: 'INDIVIDUEL',
        hoursPerMonth: null,
        unitPriceMonthly: amortizedMonthly,
        priorityScore: subject.score,
        priorityLabel: subject.priorityLabel,
        reason: `Préparation Grand Oral bornée à ${policy.total_hours_max} h sur l'année (${policy.included_sessions} séances), soit ${forfaitTotal} TND réparti sur 10 mensualités.`,
      });
      continue;
    }

    const hours = volumeForSubject(subject, isFoundational);
    if (hours === 0) {
      notRecommended.push({ subject: subject.subject, reason: notRecommendedReason(subject, isFoundational) });
      continue;
    }

    const groupeModule = petitGroupeByHours.get(hours);
    if (!groupeModule) {
      throw new Error(`No canonical petit_groupe module for ${hours}h/month`);
    }

    const baseReason = `Priorité ${subject.priorityLabel} (coefficient ${subject.coefficient}, bilan : ${subject.tier.toLowerCase().replace(/_/g, ' ')}).`;
    lines.push({
      subject: subject.subject,
      label: subject.label,
      modality: 'GROUPE',
      hoursPerMonth: hours,
      unitPriceMonthly: groupeModule.price_per_student_monthly,
      priorityScore: subject.score,
      priorityLabel: subject.priorityLabel,
      reason: subject.subject === 'specialite-abandonnee' ? `${baseReason} ${SPECIALITE_ABANDONNEE_WARNING}` : baseReason,
    });
  }

  return { lines, notRecommended };
}

/**
 * Candidat-libre échéancier — 25% d'acompte + 10 mensualités, la dernière
 * absorbant l'écart d'arrondi (décision D4, docs/audit-devis-candidats-
 * libres.md §5, tranchée définitivement par la mission finale du
 * 2026-08-24). Distinct du modèle générique du catalogue (30% + 9,
 * lib/pricing.ts computeSchedule/computeDeposit) : le candidat libre a son
 * propre taux et son propre nombre de mensualités, mais réutilise la même
 * convention d'arrondi (rounding_tnd) pour rester cohérent avec le reste
 * du catalogue plutôt que d'inventer une deuxième règle d'arrondi.
 *
 * Invariant garanti par construction : deposit + installmentAmount ×
 * (nInstallments - 1) + lastInstallmentAmount === totalNet, toujours,
 * jamais un écart d'un dinar (vérifié par test, voir
 * __tests__/lib/quotes/pricing.test.ts).
 */
export const CANDIDAT_LIBRE_DEPOSIT_PCT = 25;
export const CANDIDAT_LIBRE_N_INSTALLMENTS = 10;

export interface CandidatLibreSchedule {
  deposit: number;
  installmentAmount: number;
  lastInstallmentAmount: number;
  nInstallments: number;
}

export function computeCandidatLibreSchedule(totalNet: number): CandidatLibreSchedule {
  const { rounding_tnd } = getRules().payment;
  const deposit = Math.round((totalNet * CANDIDAT_LIBRE_DEPOSIT_PCT) / 100 / rounding_tnd) * rounding_tnd;
  const remaining = totalNet - deposit;
  const installmentAmount = Math.floor(remaining / CANDIDAT_LIBRE_N_INSTALLMENTS);
  const lastInstallmentAmount = remaining - installmentAmount * (CANDIDAT_LIBRE_N_INSTALLMENTS - 1);
  return { deposit, installmentAmount, lastInstallmentAmount, nInstallments: CANDIDAT_LIBRE_N_INSTALLMENTS };
}
