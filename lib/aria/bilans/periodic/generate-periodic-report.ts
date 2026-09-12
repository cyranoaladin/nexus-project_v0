/**
 * ARIA periodic bilan — pure report generation (P7b-1).
 *
 * Aggregates real `LearningEvidence` into a tri-audience bilan: per-domain
 * activity/success within the reporting period, cumulative mastery per
 * practiced skill (never windowed — mastery reflects the student's CURRENT
 * command, same reasoning as `mastery-level.ts`), and rendered markdown for
 * student/parent/staff.
 *
 * Deliberately pure (no Prisma, no I/O) and — critically — never reads
 * `AriaMessage`/`AriaConversation`: a bilan is built exclusively from the
 * append-only evidence ledger, per the mission's confidentiality boundary
 * (a bilan must never leak the student's private chat, verbatim or
 * otherwise). This file's own source is asserted chat-free by
 * `__tests__/lib/aria/bilans/generate-periodic-report.test.ts`.
 */
import type { AriaSkillGraph } from '../../curriculum/skill-graph';
import { computeMastery, type MasteryLevel } from '../../domain/mastery/mastery-level';

export interface PeriodicEvidencePoint {
  readonly skillId: string;
  readonly outcome: 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT';
  readonly observedAt: Date;
}

export interface PeriodicDomainReport {
  readonly domainId: string;
  readonly domainLabel: string;
  readonly attemptCount: number;
  readonly correctCount: number;
  /** `null` when `attemptCount === 0` — nothing was practiced in this domain during the period. */
  readonly successRate: number | null;
}

export interface AriaPeriodicBilanReport {
  /** 0-100, attempt-weighted average across domains with activity; `null` when nothing was practiced. */
  readonly globalScore: number | null;
  readonly domainScores: readonly PeriodicDomainReport[];
  readonly masteredSkillCount: number;
  readonly practicedSkillCount: number;
  readonly totalAttemptsInPeriod: number;
  readonly studentMarkdown: string;
  readonly parentsMarkdown: string;
  readonly nexusMarkdown: string;
}

export interface GeneratePeriodicReportInput {
  readonly courseLabel: string;
  readonly skillGraph: AriaSkillGraph;
  readonly studentFirstName: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  /** All evidence for this student+course up to (and including) `periodEnd` — not pre-windowed. */
  readonly evidenceUpToPeriodEnd: readonly PeriodicEvidencePoint[];
}

const OUTCOME_WEIGHT: Readonly<Record<PeriodicEvidencePoint['outcome'], number>> = Object.freeze({
  CORRECT: 1,
  PARTIALLY_CORRECT: 0.5,
  INCORRECT: 0,
});

function isInPeriod(point: PeriodicEvidencePoint, periodStart: Date, periodEnd: Date): boolean {
  return point.observedAt >= periodStart && point.observedAt <= periodEnd;
}

export function generateAriaPeriodicBilanReport(input: GeneratePeriodicReportInput): AriaPeriodicBilanReport {
  const { skillGraph, periodStart, periodEnd, evidenceUpToPeriodEnd, courseLabel, studentFirstName } = input;

  const evidenceBySkillId = new Map<string, PeriodicEvidencePoint[]>();
  for (const point of evidenceUpToPeriodEnd) {
    const list = evidenceBySkillId.get(point.skillId) ?? [];
    list.push(point);
    evidenceBySkillId.set(point.skillId, list);
  }

  const domainScores: PeriodicDomainReport[] = [];
  let totalAttemptsInPeriod = 0;
  let weightedScoreSum = 0;
  let masteredSkillCount = 0;
  let practicedSkillCount = 0;
  const practicedSkillLabels: string[] = [];
  const masteredSkillLabels: string[] = [];

  const skillLabelsPracticedInPeriodByDomainId = new Map<string, string[]>();

  for (const domain of skillGraph.domains) {
    let attemptCount = 0;
    let correctWeight = 0;
    const skillLabelsInPeriod: string[] = [];

    for (const competency of domain.competencies) {
      const evidence = evidenceBySkillId.get(competency.rawSkillId) ?? [];
      if (evidence.length > 0) {
        practicedSkillCount += 1;
        practicedSkillLabels.push(competency.label);
        const level: MasteryLevel = computeMastery(evidence);
        if (level === 'MASTERED') {
          masteredSkillCount += 1;
          masteredSkillLabels.push(competency.label);
        }
      }

      let attemptedInPeriod = false;
      for (const point of evidence) {
        if (!isInPeriod(point, periodStart, periodEnd)) continue;
        attemptCount += 1;
        correctWeight += OUTCOME_WEIGHT[point.outcome];
        attemptedInPeriod = true;
      }
      if (attemptedInPeriod) skillLabelsInPeriod.push(competency.label);
    }

    skillLabelsPracticedInPeriodByDomainId.set(domain.rawDomainId, skillLabelsInPeriod);
    const successRate = attemptCount > 0 ? correctWeight / attemptCount : null;
    domainScores.push({
      domainId: domain.rawDomainId,
      domainLabel: domain.label,
      attemptCount,
      correctCount: Math.round(correctWeight),
      successRate,
    });

    totalAttemptsInPeriod += attemptCount;
    if (attemptCount > 0) {
      weightedScoreSum += (successRate ?? 0) * 100 * attemptCount;
    }
  }

  const globalScore = totalAttemptsInPeriod > 0 ? weightedScoreSum / totalAttemptsInPeriod : null;

  const periodLabel = `du ${formatDate(periodStart)} au ${formatDate(periodEnd)}`;
  const activeDomains = domainScores.filter((domain) => domain.attemptCount > 0);

  const studentMarkdown = renderStudentMarkdown({
    studentFirstName,
    courseLabel,
    periodLabel,
    totalAttemptsInPeriod,
    activeDomains,
    masteredSkillLabels,
    skillLabelsPracticedInPeriodByDomainId,
  });

  const parentsMarkdown = renderParentsMarkdown({
    courseLabel,
    periodLabel,
    totalAttemptsInPeriod,
    globalScore,
    activeDomains,
    masteredSkillCount,
    practicedSkillCount,
  });

  const nexusMarkdown = renderNexusMarkdown({
    courseLabel,
    periodLabel,
    totalAttemptsInPeriod,
    globalScore,
    domainScores,
  });

  return {
    globalScore,
    domainScores,
    masteredSkillCount,
    practicedSkillCount,
    totalAttemptsInPeriod,
    studentMarkdown,
    parentsMarkdown,
    nexusMarkdown,
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function renderStudentMarkdown(args: {
  readonly studentFirstName: string;
  readonly courseLabel: string;
  readonly periodLabel: string;
  readonly totalAttemptsInPeriod: number;
  readonly activeDomains: readonly PeriodicDomainReport[];
  readonly masteredSkillLabels: readonly string[];
  readonly skillLabelsPracticedInPeriodByDomainId: ReadonlyMap<string, readonly string[]>;
}): string {
  const {
    studentFirstName,
    courseLabel,
    periodLabel,
    totalAttemptsInPeriod,
    activeDomains,
    masteredSkillLabels,
    skillLabelsPracticedInPeriodByDomainId,
  } = args;

  if (totalAttemptsInPeriod === 0) {
    return [
      `## Ton bilan ${courseLabel} — ${periodLabel}`,
      '',
      `Salut ${studentFirstName}, tu n'as pas encore pratiqué avec ARIA sur cette période. Lance-toi sur une compétence de ton programme pour ton prochain bilan !`,
    ].join('\n');
  }

  const lines = [
    `## Ton bilan ${courseLabel} — ${periodLabel}`,
    '',
    `Salut ${studentFirstName}, voici comment s'est passée ta période : tu as fait ${totalAttemptsInPeriod} exercice${totalAttemptsInPeriod > 1 ? 's' : ''} avec ARIA.`,
    '',
  ];
  for (const domain of activeDomains) {
    const pct = Math.round((domain.successRate ?? 0) * 100);
    const skillLabels = skillLabelsPracticedInPeriodByDomainId.get(domain.domainId) ?? [];
    lines.push(
      `- **${domain.domainLabel}** (${skillLabels.join(', ')}) : ${domain.attemptCount} exercice${domain.attemptCount > 1 ? 's' : ''}, ${pct}% de réussite`,
    );
  }
  if (masteredSkillLabels.length > 0) {
    lines.push('', `Bravo, tu maîtrises maintenant : ${masteredSkillLabels.join(', ')}. Continue comme ça !`);
  }
  return lines.join('\n');
}

function renderParentsMarkdown(args: {
  readonly courseLabel: string;
  readonly periodLabel: string;
  readonly totalAttemptsInPeriod: number;
  readonly globalScore: number | null;
  readonly activeDomains: readonly PeriodicDomainReport[];
  readonly masteredSkillCount: number;
  readonly practicedSkillCount: number;
}): string {
  const { courseLabel, periodLabel, totalAttemptsInPeriod, globalScore, activeDomains, masteredSkillCount, practicedSkillCount } = args;

  if (totalAttemptsInPeriod === 0) {
    return [
      `## Bilan ARIA — ${courseLabel} — ${periodLabel}`,
      '',
      `Votre enfant n'a pas utilisé ARIA en pratique sur cette période. Nous vous recommandons de l'encourager à s'y remettre avant le prochain bilan.`,
    ].join('\n');
  }

  const lines = [
    `## Bilan ARIA — ${courseLabel} — ${periodLabel}`,
    '',
    `Sur cette période, votre enfant a réalisé ${totalAttemptsInPeriod} exercice${totalAttemptsInPeriod > 1 ? 's' : ''} avec ARIA, pour un taux de réussite global de ${Math.round(globalScore ?? 0)}%.`,
    `${practicedSkillCount} compétence${practicedSkillCount > 1 ? 's ont' : ' a'} été pratiquée${practicedSkillCount > 1 ? 's' : ''}, dont ${masteredSkillCount} désormais maîtrisée${masteredSkillCount > 1 ? 's' : ''}.`,
    '',
  ];
  for (const domain of activeDomains) {
    const pct = Math.round((domain.successRate ?? 0) * 100);
    lines.push(`- **${domain.domainLabel}** : ${pct}% de réussite (${domain.attemptCount} exercice${domain.attemptCount > 1 ? 's' : ''})`);
  }
  return lines.join('\n');
}

function renderNexusMarkdown(args: {
  readonly courseLabel: string;
  readonly periodLabel: string;
  readonly totalAttemptsInPeriod: number;
  readonly globalScore: number | null;
  readonly domainScores: readonly PeriodicDomainReport[];
}): string {
  const { courseLabel, periodLabel, totalAttemptsInPeriod, globalScore, domainScores } = args;
  const lines = [
    `## [Interne] Bilan ARIA périodique — ${courseLabel} — ${periodLabel}`,
    '',
    `totalAttemptsInPeriod=${totalAttemptsInPeriod}; globalScore=${globalScore === null ? 'null' : globalScore.toFixed(2)}`,
    '',
  ];
  for (const domain of domainScores) {
    lines.push(
      `- domainId=${domain.domainId}; attemptCount=${domain.attemptCount}; correctCount=${domain.correctCount}; successRate=${domain.successRate === null ? 'null' : domain.successRate.toFixed(3)}`,
    );
  }
  return lines.join('\n');
}
