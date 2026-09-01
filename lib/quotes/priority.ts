/**
 * Deterministic subject-priority scoring (CDC §18).
 *
 * priority = coefficient (exam weight)
 *          x difficultyFactor (diagnosed tier)
 *          x urgencyFactor (time remaining before the exam)
 *          x prerequisiteFactor (foundational vs ponctuelle-only subject)
 *          x confidenceFactor (mis-calibrated confidence penalty)
 *
 * Every factor is a named, documented, tested constant — never an ad-hoc
 * cascade of `if` on product IDs. Pure, no React, no DB.
 */
import type { DiagnosticTier } from './schemas';
import type { ExamProfileSubject } from './exam-profile';
import type { DiagnosticSubjectResult } from './diagnostic';

export const DIFFICULTY_FACTOR: Record<DiagnosticTier, number> = {
  A_RECTIFIER: 1.5,
  A_INSTALLER: 1.3,
  A_CONSOLIDER: 1.0,
  NON_EVALUE: 0.9,
  SOLIDE: 0.3,
};

export const CONFIDENCE_PENALTY_FACTOR = 1.2;
export const FOUNDATIONAL_SUBJECT_FACTOR = 1.1;
export const PONCTUELLE_ONLY_SUBJECT_FACTOR = 0.9;

/**
 * pedagogicalUrgencyMonths defaults to a full year (Sept -> June).
 *
 * ADR-MID-YEAR-BILLING-MODEL.md: this value affects subject PRIORITY ORDER
 * only. It must never reach the payment schedule (deposit/installments) —
 * a mid-year enrollment stays a full annual contract regardless of how
 * many months remain before the exam.
 */
export function urgencyFactor(pedagogicalUrgencyMonths = 10): number {
  const clamped = Math.max(1, Math.min(10, pedagogicalUrgencyMonths));
  return 1 + (1 - clamped / 10) * 0.5;
}

export interface SubjectPriority {
  subject: ExamProfileSubject['subject'];
  label: string;
  coefficient: number;
  tier: DiagnosticTier;
  score: number;
  priorityLabel: 'haute' | 'moyenne' | 'basse';
  /**
   * A SOLIDE tier means autonomous work is recommended instead of regular
   * accompaniment — the volume mapper (pricing.ts) must not assign hours
   * to a subject where this is true, no matter how favorable other
   * factors are.
   */
  excludeFromRegularSupport: boolean;
}

export function scoreSubjects(
  profile: ExamProfileSubject[],
  diagnostic: DiagnosticSubjectResult[],
  pedagogicalUrgencyMonths = 10,
): SubjectPriority[] {
  const diagBySubject = new Map(diagnostic.map((d) => [d.subject, d]));
  const urgency = urgencyFactor(pedagogicalUrgencyMonths);

  const scored = profile.map((subject) => {
    const diag = diagBySubject.get(subject.subject);
    const tier: DiagnosticTier = diag?.tier ?? 'NON_EVALUE';
    const prerequisite = subject.defaultCandidateForRegularSupport
      ? FOUNDATIONAL_SUBJECT_FACTOR
      : PONCTUELLE_ONLY_SUBJECT_FACTOR;
    const confidence = diag?.overconfident ? CONFIDENCE_PENALTY_FACTOR : 1;
    const score = subject.coefficient * DIFFICULTY_FACTOR[tier] * urgency * prerequisite * confidence;

    // A SOLIDE subject never gets regular support — autonomous work is
    // recommended instead (CDC §18/§48). A ponctuelle-only subject (HG,
    // LVA/LVB, enseignement scientifique, spécialité abandonnée) only
    // enters the recommendation when the diagnostic shows a real,
    // specific weakness (A_INSTALLER or A_RECTIFIER) — never "because
    // there's budget left" or on a NON_EVALUE default.
    const isWeakEnoughForPonctuelleSupport = tier === 'A_INSTALLER' || tier === 'A_RECTIFIER';
    const excludeFromRegularSupport =
      tier === 'SOLIDE' || (!subject.defaultCandidateForRegularSupport && !isWeakEnoughForPonctuelleSupport);

    return {
      subject: subject.subject,
      label: subject.label,
      coefficient: subject.coefficient,
      tier,
      score,
      // Provisional — real labels are assigned by rank below.
      priorityLabel: 'basse' as const,
      excludeFromRegularSupport,
    };
  });

  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const includable = ranked.filter((s) => !s.excludeFromRegularSupport);
  const highCount = Math.max(1, Math.ceil(includable.length / 3));
  const mediumCount = Math.max(0, Math.ceil(includable.length / 3));

  const labelBySubject = new Map<string, 'haute' | 'moyenne' | 'basse'>();
  includable.forEach((s, index) => {
    if (index < highCount) labelBySubject.set(s.subject, 'haute');
    else if (index < highCount + mediumCount) labelBySubject.set(s.subject, 'moyenne');
    else labelBySubject.set(s.subject, 'basse');
  });

  return scored.map((s) => ({
    ...s,
    priorityLabel: labelBySubject.get(s.subject) ?? 'basse',
  }));
}
