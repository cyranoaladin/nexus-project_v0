// ─────────────────────────────────────────────────────────────────────────────
// lib/bilan-generation/index.ts
// Main orchestrator: normalize → profile → prompt → generate → validate → save
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from '@/lib/logger';
import { buildBilanPedagogicalProfile } from './buildBilanPedagogicalProfile';
import { buildBilanPrompt } from './buildBilanPrompt';
import { generateBilanMarkdownWithMistral } from './generateBilanWithMistral';
import { validateGeneratedBilan } from './validateGeneratedBilan';
import { saveGeneratedBilan } from './saveGeneratedBilan';
import type { NormalizedBilanInput, GenerationResult } from './types';

export * from './types';
export { adaptMathsPremiereStagePrintemps } from './adapters/mathsPremiereStagePrintemps';
export { buildBilanPedagogicalProfile } from './buildBilanPedagogicalProfile';
export { buildBilanPrompt } from './buildBilanPrompt';
export { generateBilanMarkdownWithMistral } from './generateBilanWithMistral';
export { validateGeneratedBilan } from './validateGeneratedBilan';
export { saveGeneratedBilan } from './saveGeneratedBilan';

const WORKFLOW_VERSION = '2.0.0';

export type GenerateBilanOptions = {
  input: NormalizedBilanInput;
  save?: boolean;
  retryOnFail?: boolean;
};

/**
 * Full workflow: build profile → prompt → generate → validate → (optionally) save.
 */
export async function generateBilan(
  options: GenerateBilanOptions,
): Promise<GenerationResult> {
  const { input, save = true, retryOnFail = true } = options;

  logger.info(
    { bilanId: input.bilanId, studentId: input.student.id, kind: input.context.bilanKind },
    '[bilan-generation] Starting workflow',
  );

  // Step 1: Build pedagogical profile
  const profile = buildBilanPedagogicalProfile(input);

  // Step 2: Build prompt
  const messages = buildBilanPrompt(profile, input);

  // Step 3: Call Mistral
  const { markdown, model, durationMs } = await generateBilanMarkdownWithMistral(messages, 0.3);

  // Step 4: Validate
  let { qualityStatus, issues } = validateGeneratedBilan(markdown, input, profile);

  // Step 5: Retry once on FAIL (excluding RATE_LIMITED)
  let finalMarkdown = markdown;
  let finalDurationMs = durationMs;

  if (qualityStatus === 'FAIL' && retryOnFail) {
    logger.warn(
      { bilanId: input.bilanId, issues },
      '[bilan-generation] Validation failed, retrying once',
    );

    // Corrective prompt: append validation feedback
    const correctionHint = [
      messages[1].content,
      `\n\nAVERTISSEMENT : une première génération avait été produite mais elle ne respectait pas les critères suivants : ${issues.join(', ')}.`,
      `Produis un bilan entièrement nouveau, structuré avec des titres ## (jamais **gras**), contenant au moins 4 conseils actionnables, 2 points d'appui et 2 axes de progrès.`,
    ].join('\n');

    const messagesWithCorrection: import('@/lib/llm/mistral').MistralChatMessage[] = [
      messages[0],
      { role: 'user', content: correctionHint },
    ];

    const retry = await generateBilanMarkdownWithMistral(messagesWithCorrection, 0.25);
    finalMarkdown = retry.markdown;
    finalDurationMs += retry.durationMs;

    const retryValidation = validateGeneratedBilan(finalMarkdown, input, profile);
    qualityStatus = retryValidation.qualityStatus;
    issues = retryValidation.issues;

    logger.info(
      { bilanId: input.bilanId, qualityStatus, issueCount: issues.length },
      '[bilan-generation] Retry validation result',
    );
  }

  const result: GenerationResult = {
    markdown: finalMarkdown,
    model,
    qualityStatus,
    qualityIssues: issues,
    durationMs: finalDurationMs,
    workflowVersion: WORKFLOW_VERSION,
  };

  // Step 6: Save if requested (and not hard failure)
  if (save && qualityStatus !== 'FAIL') {
    await saveGeneratedBilan(input.bilanId, result);
  } else if (qualityStatus === 'FAIL') {
    logger.error(
      { bilanId: input.bilanId, issues },
      '[bilan-generation] Quality gate FAIL — not saved',
    );
  }

  return result;
}
