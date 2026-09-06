import { serializeError } from '@/lib/utils/serialize-error';
/**
 * Canonical Bilan Generator
 * Unified LLM generation for all bilan sources (Diagnostic, Assessment, Stage)
 * Consolidates lib/bilan-generator.ts + lib/assessments/generators/index.ts
 */

import { ollamaChat } from '@/lib/ollama-client';
import { prisma } from '@/lib/prisma';
import { buildPromptForAudience } from './prompts';
import type { BilanSourceData,BilanStatus,BilanType,DomainScore } from './types';

/**
 * LLM_MODE controls generation behavior:
 * - 'live' (default): real Ollama generation
 * - 'stub': deterministic short bilans (tests/staging)
 * - 'off': skip generation, set COMPLETED with errorCode=GENERATION_SKIPPED
 */
type LlmMode = 'live' | 'stub' | 'off';

function getLlmMode(): LlmMode {
  const mode = process.env.LLM_MODE?.toLowerCase();
  if (mode === 'off' || mode === 'stub') return mode;
  return 'live';
}

/**
 * Result of bilan generation
 */
export interface GeneratedBilans {
  studentMarkdown: string;
  parentsMarkdown: string;
  nexusMarkdown: string;
  ragUsed: boolean;
  ragHitCount: number;
  ragCollections: string[];
  ragError?: boolean;
  engineVersion?: string;
}

/**
 * Input context for canonical generator
 */
export interface BilanGenerationContext {
  // Identification
  bilanId?: string; // For updates on existing bilan
  type: BilanType;
  subject: string;

  // Student info
  studentName: string;
  studentEmail: string;
  studentPhone?: string;

  // Source data (type-specific)
  sourceData: BilanSourceData;

  // Scores (normalized 0-100)
  globalScore?: number;
  confidenceIndex?: number;
  ssn?: number;
  uai?: number;
  domainScores?: DomainScore[];

  /** @deprecated Retrieval is unavailable; only false/omitted is supported. */
  enableRAG?: boolean;
  ragCollections?: string[];
  ragQuery?: string;

  // Versioning
  sourceVersion?: string;
}

/**
 * Canonical Bilan Generator
 * Unified interface for all bilan generation needs
 */
export class BilanGenerator {
  /**
   * Generate tri-destinataire bilans for a context
   */
  static async generate(context: BilanGenerationContext): Promise<GeneratedBilans> {
    if (context.enableRAG || context.ragCollections !== undefined || context.ragQuery !== undefined) {
      throw new Error('BILAN_RAG_UNAVAILABLE');
    }
    const llmMode = getLlmMode();

    // LLM_MODE=off: skip generation
    if (llmMode === 'off') {
      return {
        studentMarkdown: '',
        parentsMarkdown: '',
        nexusMarkdown: '',
        ragUsed: false,
        ragHitCount: 0,
        ragCollections: [],
        engineVersion: 'LLM_MODE_OFF',
      };
    }

    // LLM_MODE=stub: deterministic generation
    if (llmMode === 'stub') {
      return this.generateStub(context);
    }

    // Live generation from the supplied diagnostic context
    return this.generateLive(context);
  }

  /**
   * Generate and save bilans to database
   */
  static async generateAndSave(
    context: BilanGenerationContext
  ): Promise<{ success: boolean; error?: string; result?: GeneratedBilans }> {
    try {
      const llmMode = getLlmMode();

      // LLM_MODE=off: skip and mark
      if (llmMode === 'off') {
        if (context.bilanId) {
          await prisma.bilan.update({
            where: { id: context.bilanId },
            data: {
              status: 'COMPLETED' as BilanStatus,
              progress: 100,
              errorCode: 'GENERATION_SKIPPED',
              errorDetails: 'LLM_MODE=off — generation skipped',
            },
          });
        }
        return { success: true, result: await this.generate(context) };
      }

      // Update to GENERATING status
      if (context.bilanId) {
        await prisma.bilan.update({
          where: { id: context.bilanId },
          data: { status: 'GENERATING' as BilanStatus, progress: 50 },
        });
      }

      // Generate
      const result = await this.generate(context);

      // Save and complete
      if (context.bilanId) {
        await prisma.bilan.update({
          where: { id: context.bilanId },
          data: {
            studentMarkdown: result.studentMarkdown,
            parentsMarkdown: result.parentsMarkdown,
            nexusMarkdown: result.nexusMarkdown,
            ragUsed: result.ragUsed,
            ragCollections: result.ragCollections,
            engineVersion: result.engineVersion || 'canonical-v1',
            status: 'COMPLETED' as BilanStatus,
            progress: 100,
            errorCode: null,
            errorDetails: null,
          },
        });
      }

      return { success: true, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[BilanGenerator] Generation failed:', serializeError(errorMessage));

      // Update to FAILED status
      if (context.bilanId) {
        await prisma.bilan.update({
          where: { id: context.bilanId },
          data: {
            status: 'FAILED' as BilanStatus,
            errorCode: 'GENERATION_FAILED',
            errorDetails: errorMessage,
          },
        });
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Live generation with Ollama. RAG stays disabled until the external v2
   * contract defines a governed bilan identity and corpus capability.
   */
  private static async generateLive(context: BilanGenerationContext): Promise<GeneratedBilans> {
    const ragContext = '';

    // Generate for each audience
    const [studentMarkdown, parentsMarkdown, nexusMarkdown] = await Promise.all([
      this.generateForAudience('student', context, ragContext),
      this.generateForAudience('parents', context, ragContext),
      this.generateForAudience('nexus', context, ragContext),
    ]);

    return {
      studentMarkdown,
      parentsMarkdown,
      nexusMarkdown,
      ragUsed: false,
      ragHitCount: 0,
      ragCollections: [],
      ragError: false,
      engineVersion: 'ollama-qwen2.5:32b',
    };
  }

  /**
   * Generate markdown for a specific audience
   */
  private static async generateForAudience(
    audience: 'student' | 'parents' | 'nexus',
    context: BilanGenerationContext,
    ragContext: string
  ): Promise<string> {
    const prompt = buildPromptForAudience(audience, context, ragContext);

    const content = await ollamaChat({
      model: 'qwen2.5:32b',
      messages: [
        {
          role: 'system',
          content: `Tu es un expert pédagogique spécialisé en ${context.subject}. Tu rédiges des bilans personnalisés pour ${audience}.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      numPredict: 2000,
    });

    return content || '';
  }

  /**
   * Stub generation for tests/staging
   */
  private static generateStub(context: BilanGenerationContext): GeneratedBilans {
    const { studentName, subject, globalScore = 0 } = context;
    const shortName = studentName.split(' ')[0];

    return {
      studentMarkdown: `# Bilan ${subject} — ${shortName}\n\nScore: ${globalScore}/100\n\nTu progresses bien ! Continue à travailler régulièrement.`,
      parentsMarkdown: `# Bilan ${subject} — ${studentName}\n\nScore global: ${globalScore}/100\n\nVotre enfant progresse. Nous recommandons un suivi régulier.`,
      nexusMarkdown: `# Bilan ${subject} — ${studentName}\n\nScore: ${globalScore}/100\n\nForces: à définir. Axes: à définir.`,
      ragUsed: false,
      ragHitCount: 0,
      ragCollections: [],
      engineVersion: 'stub-v1',
    };
  }
}

/**
 * Convenience function for quick generation
 */
export async function generateBilans(
  context: BilanGenerationContext
): Promise<GeneratedBilans> {
  return BilanGenerator.generate(context);
}

/**
 * Generate and save with error handling
 */
export async function generateAndSaveBilans(
  context: BilanGenerationContext
): Promise<{ success: boolean; error?: string; result?: GeneratedBilans }> {
  return BilanGenerator.generateAndSave(context);
}
