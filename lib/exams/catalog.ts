/**
 * Typed, versioned loader for the exam-rules canonical data (data/exams/*.json).
 *
 * Mirrors lib/pricing.ts's discipline: no component or page reads the JSON
 * directly, every regulatory fact used by the quote engine goes through this
 * module, and every session is validated against lib/exams/schema.ts before
 * it can be used.
 *
 * FAIL CLOSED: an unsupported/unknown session returns null, never a fallback
 * or an assumed default policy (CDC §60 — "fail closed sur une session
 * réglementaire inconnue").
 */
import 'server-only';
import bacGeneral2027 from '@/data/exams/bac-general-2027.json';
import { examPolicySchema, type ExamPolicy } from './schema';

const REGISTRY: Record<number, unknown> = {
  2027: bacGeneral2027,
};

const validatedCache = new Map<number, ExamPolicy>();

function loadAndValidate(session: number): ExamPolicy | null {
  const cached = validatedCache.get(session);
  if (cached) return cached;

  const raw = REGISTRY[session];
  if (!raw) return null;

  // A schema failure here is a bug in the committed JSON, not an unknown
  // session — it must surface loudly (throw), not be swallowed into null.
  const parsed = examPolicySchema.parse(raw);
  validatedCache.set(session, parsed);
  return parsed;
}

/** Returns null for an unsupported session. Callers MUST fail closed. */
export function getExamPolicy(session: number): ExamPolicy | null {
  return loadAndValidate(session);
}

/** Throws for contexts that require a guaranteed policy (scripts, tests). */
export function requireExamPolicy(session: number): ExamPolicy {
  const policy = getExamPolicy(session);
  if (!policy) {
    throw new Error(
      `No exam policy registered for session ${session}. Supported sessions: ${getSupportedSessions().join(', ')}`,
    );
  }
  return policy;
}

export function getSupportedSessions(): number[] {
  return Object.keys(REGISTRY)
    .map(Number)
    .sort((a, b) => a - b);
}

export function getEpreuve(policy: ExamPolicy, id: string) {
  return policy.epreuves.find((e) => e.id === id);
}

export function hasPracticalPartDispensation(policy: ExamPolicy, specialiteCode: string): boolean {
  return policy.candidatIndividuelRules.dispensePartiePratique.specialitesConcernees.includes(specialiteCode);
}

// ── Same-session ("Bac accéléré") eligibility ──
//
// This is the single point of truth for the Article 3 exception. It must
// never be re-derived or approximated elsewhere (JSX, the recommendation
// wizard, the assistant workspace) — every consumer calls this function.

/** true = condition confirmed to apply, false = confirmed not to apply, undefined = not answered. */
export type EligibilityAnswer = boolean | undefined;
export type EligibilityAnswers = Record<string, EligibilityAnswer>;

export type SameSessionEligibilityResult =
  | { outcome: 'ELIGIBLE'; matchedConditionIds: string[] }
  | { outcome: 'NOT_ELIGIBLE_STANDARD_TWO_SESSION_PATH' }
  | { outcome: 'ELIGIBILITY_REQUIRES_HUMAN_REVIEW'; reason: string };

/**
 * Evaluates the Article 3 same-session exception from candidate answers.
 *
 * Deliberately conservative: a non-auto-checkable condition (force majeure,
 * retour en formation, résidence temporaire à l'étranger, etc.) can NEVER
 * resolve to ELIGIBLE on its own — those require an official académie
 * determination. Only an explicitly confirmed auto-checkable condition
 * (age >= 20, enfant à charge, échec antérieur, déjà titulaire d'un bac,
 * diplôme étranger comparable) can produce ELIGIBLE. Anything unanswered or
 * ambiguous resolves to human review, never a guess.
 */
export function checkSameSessionEligibility(
  policy: ExamPolicy,
  answers: EligibilityAnswers,
): SameSessionEligibilityResult {
  const conditions = policy.candidatIndividuelRules.sameSessionEligibility.conditions;
  const autoCheckable = conditions.filter((c) => c.autoCheckable);
  const nonAutoCheckable = conditions.filter((c) => !c.autoCheckable);

  const flaggedNonAuto = nonAutoCheckable.filter((c) => answers[c.id] === true);
  if (flaggedNonAuto.length > 0) {
    return {
      outcome: 'ELIGIBILITY_REQUIRES_HUMAN_REVIEW',
      reason: `Condition(s) nécessitant une confirmation officielle de l'académie : ${flaggedNonAuto
        .map((c) => c.id)
        .join(', ')}.`,
    };
  }

  const matched = autoCheckable.filter((c) => answers[c.id] === true);
  if (matched.length > 0) {
    return { outcome: 'ELIGIBLE', matchedConditionIds: matched.map((c) => c.id) };
  }

  const unanswered = autoCheckable.filter((c) => answers[c.id] === undefined);
  if (unanswered.length > 0) {
    return {
      outcome: 'ELIGIBILITY_REQUIRES_HUMAN_REVIEW',
      reason: 'Réponse manquante pour au moins une condition vérifiable.',
    };
  }

  return { outcome: 'NOT_ELIGIBLE_STANDARD_TWO_SESSION_PATH' };
}
