/**
 * Shared types for the quote domain engine (CDC §13).
 *
 * These are the DTOs every consumer speaks: the public /devis-bac wizard,
 * the staff workspace, the APIs, and the persistence layer. The engine
 * itself (recommendation.ts, optimizer.ts, priority.ts, ...) is pure
 * TypeScript — no React, no Prisma, no fetch. Zod validation of untrusted
 * input (API payloads) lives at the API boundary, not here; these are the
 * shapes that validation produces.
 */

import type { Subject } from '@prisma/client';

/**
 * Sentinel priority score for lines that must never be dropped by the
 * optimizer (Pilotage, a matched canonical pack). Deliberately a large
 * finite number, not Infinity/-Infinity — JSON.stringify silently turns
 * both into `null`, which would corrupt every API response and DB row
 * carrying this field.
 */
export const ALWAYS_INCLUDED_PRIORITY_SCORE = Number.MAX_SAFE_INTEGER;

export type CandidateLevel = 'premiere' | 'terminale';

export type SubjectId =
  | 'francais'
  | 'maths-anticipees'
  | 'eds1'
  | 'eds2'
  | 'philosophie'
  | 'grand-oral'
  | 'histoire-geographie'
  | 'lva'
  | 'lvb'
  | 'enseignement-scientifique'
  | 'specialite-abandonnee';

export interface SituationInput {
  level: CandidateLevel;
  examSession: number;
  /**
   * Two specialties still carried into Terminale (or planned, for a
   * Première candidate). Reuses the existing Prisma `Subject` enum
   * (Student.specialties) rather than free-text labels.
   */
  specialites: [Subject, Subject];
  /** The Première specialty dropped after the year, if any (terminale candidates only). */
  specialiteAbandonnee?: Subject;
  /** Langue vivante A / B, when known — drives the diagnostic mapping for those ponctuelles. */
  langueA?: Subject;
  langueB?: Subject;
}

/** true = confirmed applies, false = confirmed does not apply, undefined = not answered. */
export type EligibilityAnswers = Record<string, boolean | undefined>;

export type DiagnosticTier = 'SOLIDE' | 'A_CONSOLIDER' | 'A_INSTALLER' | 'A_RECTIFIER' | 'NON_EVALUE';

export interface DiagnosticSubjectProjection {
  subject: SubjectId;
  tier: DiagnosticTier;
  /** 0-100, null when NON_EVALUE. */
  percentage: number | null;
  /** true when the candidate answered with unwarranted confidence on this subject — feeds the priority score. */
  overconfident: boolean;
}

/** Minimal, stable projection of a CandidateDiagnostic — never the raw diagnostic record. */
export interface DiagnosticProjection {
  diagnosticId: string;
  checksum: string;
  subjects: DiagnosticSubjectProjection[];
}

export type BudgetStrategy = 'RESPECT_BUDGET' | 'BEST_BALANCE' | 'MOST_COMPLETE';

export interface BudgetInput {
  monthlyBudgetTnd: number;
  strategy: BudgetStrategy;
}

export type LineModality = 'PILOTAGE' | 'GROUPE' | 'DUO' | 'INDIVIDUEL' | 'PACK';

export interface RecommendedLine {
  subject: SubjectId | 'pilotage' | 'pack';
  label: string;
  modality: LineModality;
  hoursPerMonth: number | null;
  unitPriceMonthly: number;
  priorityScore: number;
  priorityLabel: 'haute' | 'moyenne' | 'basse';
  reason: string;
  offerId?: string;
}

export interface NotRecommendedSubject {
  subject: SubjectId;
  reason: string;
}

export type GroupHeadcountRequirement = Pick<
  RecommendedLine,
  'subject' | 'hoursPerMonth' | 'unitPriceMonthly'
>;

export type ScenarioTier = 'ESSENTIEL' | 'RECOMMANDE' | 'COMPLET';

export interface QuoteScenario {
  tier: ScenarioTier;
  lines: RecommendedLine[];
  notRecommended: NotRecommendedSubject[];
  monthlyTotal: number;
  grandTotal: number;
  months: number;
  matchedOfferId: string | null;
  /** Canonical public inclusions copied when a scenario matches a packaged offer. */
  includedFeatures?: string[];
  /**
   * Group-based subjects covered by a PACK line. The pack collapse keeps
   * its canonical commercial line and price, but must not erase the
   * per-subject headcount confirmations required before emission.
   */
  groupHeadcountRequirements?: GroupHeadcountRequirement[];
}

export type BacAccelereEligibilityOutcome =
  | 'ELIGIBLE'
  | 'NOT_ELIGIBLE_STANDARD_TWO_SESSION_PATH'
  | 'ELIGIBILITY_REQUIRES_HUMAN_REVIEW';

export interface RecommendationResult {
  pricingVersion: string;
  examPolicyVersion: string;
  examSession: number;
  scenarios: QuoteScenario[];
  bacAccelereEligibility?: BacAccelereEligibilityOutcome;
}
