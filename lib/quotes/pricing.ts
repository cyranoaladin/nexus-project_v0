/**
 * Maps subject priorities onto canonical volumes and prices (CDC §19).
 *
 * Reads exclusively from lib/pricing.ts (the single source of truth) — no
 * price or hour threshold is invented here beyond the *mapping* from
 * priority to one of the canonical module tiers. Pure, no React, no DB.
 */
import { getCandidatIndividuelModules, getRules } from '@/lib/pricing';
import type { SubjectPriority } from './priority';
import type { NotRecommendedSubject, RecommendedLine } from './schemas';

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
      priorityScore: Number.POSITIVE_INFINITY, // always included, never dropped by the optimizer
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

    lines.push({
      subject: subject.subject,
      label: subject.label,
      modality: 'GROUPE',
      hoursPerMonth: hours,
      unitPriceMonthly: groupeModule.price_per_student_monthly,
      priorityScore: subject.score,
      priorityLabel: subject.priorityLabel,
      reason: `Priorité ${subject.priorityLabel} (coefficient ${subject.coefficient}, bilan : ${subject.tier.toLowerCase().replace(/_/g, ' ')}).`,
    });
  }

  return { lines, notRecommended };
}
