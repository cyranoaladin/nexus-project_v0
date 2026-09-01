/**
 * Client-safe subset of lib/exams/catalog.ts — no 'server-only' guard.
 *
 * Unlike lib/pricing-client.ts, this does NOT trim the data (the exam-rules
 * JSON is small, no bundle-size concern) — it re-validates the exact same
 * committed JSON through the exact same Zod schema. The only reason this
 * file exists separately from catalog.ts is so a 'use client' wizard
 * component can call it without pulling in the server-only guard. Any
 * drift between the two loaders would be caught by their shared
 * schema/JSON source — there is nothing to keep "in sync" here.
 */
import bacGeneral2026 from '@/data/exams/bac-general-2026.json';
import bacGeneral2027 from '@/data/exams/bac-general-2027.json';
import bacGeneral2028 from '@/data/exams/bac-general-2028.json';
import { examPolicySchema, type ExamPolicy, type EligibilityCondition } from './schema';
import { requireResolved } from './a-verifier';

const REGISTRY: Record<number, unknown> = {
  2026: bacGeneral2026,
  2027: bacGeneral2027,
  2028: bacGeneral2028,
};

const validatedCache = new Map<number, ExamPolicy>();

/** Returns null for an unsupported session. Callers MUST fail closed. */
export function getExamPolicyClient(session: number): ExamPolicy | null {
  const cached = validatedCache.get(session);
  if (cached) return cached;
  const raw = REGISTRY[session];
  if (!raw) return null;
  const parsed = examPolicySchema.parse(raw);
  validatedCache.set(session, parsed);
  return parsed;
}

/** Throws for contexts that require a guaranteed policy. */
export function requireExamPolicyClient(session: number): ExamPolicy {
  const policy = getExamPolicyClient(session);
  if (!policy) {
    throw new Error(`No exam policy registered for session ${session}.`);
  }
  return policy;
}

export function getSupportedSessionsClient(): number[] {
  return Object.keys(REGISTRY)
    .map(Number)
    .sort((a, b) => a - b);
}

/** Returns null for an unsupported session (mirrors getExamPolicyClient's fail-closed contract). */
export function getSessionStatusClient(session: number): ExamPolicy['status'] | null {
  const policy = getExamPolicyClient(session);
  return policy ? policy.status : null;
}

/**
 * The single currently-sellable (status ACTIVE) session — for public
 * wizards that only ever offer one session at a time (mission P0-A
 * dedupe: replaces a hardcoded `SUPPORTED_SESSION = 2027` in
 * components/quotes/DevisWizard.tsx and its siblings). Fails closed if
 * zero or more than one session is ACTIVE — a data/exams/*.json edit
 * that changes which session is active is reflected here automatically,
 * never a year to hunt down and update by hand across components.
 */
export function getSellableSessionClient(): number {
  const active = getSupportedSessionsClient().filter((session) => getSessionStatusClient(session) === 'ACTIVE');
  if (active.length !== 1) {
    throw new Error(
      `Expected exactly one ACTIVE exam session, found ${active.length}: ${active.join(', ') || 'none'}.`,
    );
  }
  return active[0];
}

/**
 * The Article 3 ("Bac accéléré") auto-checkable eligibility conditions —
 * the single point of truth (same source lib/exams/catalog.ts::
 * checkSameSessionEligibility evaluates against), for a public wizard that
 * only ever offers the family a checkbox for auto-checkable conditions
 * (mission P0-A dedupe: replaces a hardcoded ELIGIBILITY_QUESTIONS list in
 * components/quotes/DevisWizard.tsx). Never re-derive or approximate this
 * list elsewhere — see lib/exams/catalog.ts's own header comment on
 * checkSameSessionEligibility.
 */
export function getAutoCheckableEligibilityConditionsClient(session: number): EligibilityCondition[] {
  const policy = requireExamPolicyClient(session);
  const rules = requireResolved(policy.candidatIndividuelRules, `session ${policy.session} candidatIndividuelRules`);
  return rules.sameSessionEligibility.conditions.filter((c) => c.autoCheckable);
}
