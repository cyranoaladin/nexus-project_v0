/**
 * F50: Canonical Bilan Generator
 * Unified LLM generation for all bilan sources (Diagnostic, Assessment, Stage)
 * Consolidates lib/bilan-generator.ts + lib/assessments/generators/index.ts
 */

import { ollamaChat } from '@/lib/ollama-client';
import { ragSearch, buildRAGContext } from '@/lib/rag-client';
import { prisma } from '@/lib/prisma';
import type { BilanType, BilanStatus, BilanSourceData, DomainScore } from './types';
import { buildPromptForAudience } from './prompts';

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

  // RAG options
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
    const llmMode = getLlmMode();
    console.log(`[BilanGenerator] type=${context.type} subject=${context.subject} mode=${llmMode}`);

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

    // Live generation with RAG
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
      console.error('[BilanGenerator] Generation failed:', errorMessage);

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
   * Live generation with Ollama + optional RAG
   */
  private static async generateLive(context: BilanGenerationContext): Promise<GeneratedBilans> {
    let ragUsed = false;
    let ragHitCount = 0;
    let ragCollections: string[] = [];
    let ragError = false;

    // Build RAG context if enabled
    let ragContext = '';
    if (context.enableRAG && context.ragQuery) {
      try {
        // Search across multiple collections sequentially
        const collections = context.ragCollections || ['methodologie', 'suites', 'derivation', 'probabilites'];
        const allHits: Awaited<ReturnType<typeof ragSearch>> = [];
        for (const collection of collections.slice(0, 3)) {
          const hits = await ragSearch({
            query: context.ragQuery,
            collection,
            k: 3,
          });
          allHits.push(...hits);
        }
        ragContext = buildRAGContext(allHits);
        ragUsed = true;
        ragHitCount = allHits.length;
        ragCollections = collections.slice(0, 3);
      } catch (error) {
        console.warn('[BilanGenerator] RAG failed, continuing without:', error);
        ragError = true;
      }
    }

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
      ragUsed,
      ragHitCount,
      ragCollections,
      ragError,
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
