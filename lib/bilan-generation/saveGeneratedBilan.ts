// ─────────────────────────────────────────────────────────────────────────────
// lib/bilan-generation/saveGeneratedBilan.ts
// Persists the generated bilan to the DB: parentsMarkdown + generation metadata.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { GenerationResult } from './types';

export async function saveGeneratedBilan(
  bilanId: string,
  result: GenerationResult,
): Promise<void> {
  const metadata = {
    model: result.model,
    generatedAt: new Date().toISOString(),
    qualityStatus: result.qualityStatus,
    qualityIssues: result.qualityIssues,
    workflowVersion: result.workflowVersion,
    durationMs: result.durationMs,
  };

  const bilan = await prisma.bilan.findUnique({
    where: { id: bilanId },
    select: { sourceData: true },
  });

  if (!bilan) {
    logger.error({ bilanId }, '[saveGeneratedBilan] Bilan not found');
    throw new Error(`Bilan ${bilanId} not found`);
  }

  const currentSource = (bilan.sourceData as Record<string, unknown>) ?? {};

  await prisma.bilan.update({
    where: { id: bilanId },
    data: {
      parentsMarkdown: result.markdown,
      sourceData: {
        ...currentSource,
        generationMetadata: metadata,
      },
    },
  });

  logger.info(
    { bilanId, qualityStatus: result.qualityStatus, durationMs: result.durationMs },
    '[saveGeneratedBilan] Saved successfully',
  );
}
