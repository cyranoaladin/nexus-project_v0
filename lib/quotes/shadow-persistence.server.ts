/**
 * Persists a ShadowComparisonLog row (mission "recâblage" §3/§7). The only
 * writer of this table — kept separate from lib/quotes/persistence.server.ts
 * (Quote domain) since shadow logs are not part of the contractual Quote
 * lifecycle and must never be confused with it.
 */
import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ShadowComparisonRecord } from './shadow-comparison';

export async function logShadowComparison(record: ShadowComparisonRecord): Promise<void> {
  await prisma.shadowComparisonLog.create({
    data: {
      situationChecksum: record.situationChecksum,
      divergenceCategory: record.divergenceCategory,
      legacySummary: record.legacySummary as unknown as Prisma.InputJsonValue,
      newSummary: record.newSummary as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Shadow mode's own stated contract (app/api/quotes/route.ts) is "never
 * blocks" the family-facing response — but the call site `await`s this
 * write, so a slow DB write previously had no bound: worst case, it added
 * its full duration to every family's request latency, silently
 * contradicting that contract (mission §4 finding). This wraps the same
 * write with a hard timeout so a hang can only ever cost this many
 * milliseconds, never more — resolved via the same isolated try/catch the
 * call site already has, not a new failure mode.
 */
export const SHADOW_LOG_TIMEOUT_MS = 2000;

export async function logShadowComparisonWithTimeout(record: ShadowComparisonRecord, timeoutMs: number = SHADOW_LOG_TIMEOUT_MS): Promise<void> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`logShadowComparison exceeded ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    await Promise.race([logShadowComparison(record), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
