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
