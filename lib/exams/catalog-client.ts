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
import { examPolicySchema, type ExamPolicy } from './schema';

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
