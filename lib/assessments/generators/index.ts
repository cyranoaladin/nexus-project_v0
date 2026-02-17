/**
 * Bilan Generator — LLM Worker
 * 
 * Orchestrates the generation of personalized assessment reports (bilans)
 * using PromptFactory and Ollama LLM.
 */

import { prisma } from '@/lib/prisma';
import { ollamaChat } from '@/lib/ollama-client';
import { PromptFactory } from '../prompts';
import { Subject, Grade, Audience } from '../core/types';
import type { ScoringResult } from '../core/types';

interface BilanGenerationResult {
  studentMarkdown: string;
  parentsMarkdown: string;
  nexusMarkdown: string;
}

interface BilanPromptContext {
  studentName: string;
  globalScore: number;
  confidenceIndex: number;
  precisionIndex: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  metrics: unknown;
  diagnosticText: string;
  lucidityText: string;
  totalQuestions: number;
  totalAttempted: number;
  totalCorrect: number;
}

export class BilanGenerator {
  /**
   * Generate personalized bilans for an assessment
   * 
   * @param assessmentId - Assessment ID to generate bilans for
   * @throws Error if assessment not found or generation fails
   */
  static async generate(assessmentId: string): Promise<void> {
    console.log(`[BilanGenerator] Starting generation for ${assessmentId}`);

    try {
      // ─── Step 1: Fetch Assessment ────────────────────────────────────────

      const assessment = await prisma.assessment.findUnique({
        where: { id: assessmentId },
        select: {
          id: true,
          subject: true,
          grade: true,
          studentName: true,
          studentEmail: true,
          scoringResult: true,
          status: true,
        },
      });

      if (!assessment) {
        throw new Error(`Assessment ${assessmentId} not found`);
      }

      if (!assessment.scoringResult) {
        throw new Error(`Assessment ${assessmentId} has no scoring result`);
      }

      const scoringResult = assessment.scoringResult as unknown as ScoringResult;

      console.log(`[BilanGenerator] Assessment loaded: ${assessment.subject} ${assessment.grade}`);

      // ─── Step 2: Update Status to GENERATING ─────────────────────────────

      await prisma.assessment.update({
        where: { id: assessmentId },
        data: {
          status: 'GENERATING',
          progress: 75,
        },
      });

      // ─── Step 3: Generate Bilans in Parallel ─────────────────────────────

      const result = await this.generateBilans(
        assessment.subject as Subject,
        assessment.grade as Grade,
        assessment.studentName,
        scoringResult
      );

      console.log(`[BilanGenerator] Bilans generated successfully`);

      // ─── Step 4: Save Results ─────────────────────────────────────────────

      await prisma.assessment.update({
        where: { id: assessmentId },
        data: {
          studentMarkdown: result.studentMarkdown,
          parentsMarkdown: result.parentsMarkdown,
          nexusMarkdown: result.nexusMarkdown,
          status: 'COMPLETED',
          progress: 100,
        },
      });

      console.log(`[BilanGenerator] Completed for ${assessmentId}`);
    } catch (error) {
      console.error(`[BilanGenerator] LLM generation failed for ${assessmentId}:`, error);

      // P0 Rule: LLM failure must NOT block results.
      // Scoring + DomainScores + SSN are already persisted — set COMPLETED
      // so the result API can serve them. Track LLM failure separately.
      try {
        await prisma.assessment.update({
          where: { id: assessmentId },
          data: {
            status: 'COMPLETED',
            progress: 100,
            errorCode: 'LLM_GENERATION_FAILED',
            errorDetails: error instanceof Error ? error.message : 'Unknown error',
            retryCount: {
              increment: 1,
            },
          },
        });
        console.warn(`[BilanGenerator] ${assessmentId} set to COMPLETED despite LLM failure (scoring data preserved)`);
      } catch (updateError) {
        // Last resort: if even the status update fails, log but don't crash
        console.error(`[BilanGenerator] CRITICAL: Failed to update status for ${assessmentId}:`, updateError);
      }
      // Do NOT re-throw — the assessment is usable without LLM bilans
    }
  }

  /**
   * Generate bilans for all three audiences in parallel
   */
  private static async generateBilans(
    subject: Subject,
    grade: Grade,
    studentName: string,
    scoringResult: ScoringResult
  ): Promise<BilanGenerationResult> {
    // Generate bilans in parallel for performance
    const [studentBilan, parentsBilan, nexusBilan] = await Promise.all([
      this.generateBilanForAudience(subject, grade, Audience.ELEVE, studentName, scoringResult),
      this.generateBilanForAudience(subject, grade, Audience.PARENTS, studentName, scoringResult),
      this.generateBilanForAudience(subject, grade, Audience.NEXUS, studentName, scoringResult),
    ]);

    return {
      studentMarkdown: studentBilan,
      parentsMarkdown: parentsBilan,
      nexusMarkdown: nexusBilan,
    };
  }

  /**
   * Generate bilan for a specific audience
   */
  private static async generateBilanForAudience(
    subject: Subject,
    grade: Grade,
    audience: Audience,
    studentName: string,
    scoringResult: ScoringResult
  ): Promise<string> {
    console.log(`[BilanGenerator] Generating ${audience} bilan for ${subject} ${grade}`);

    try {
      // ─── Step 1: Get Prompt Template ─────────────────────────────────────

      const promptTemplate = PromptFactory.get({
        subject,
        grade,
        audience,
      });

      // ─── Step 2: Prepare Context ─────────────────────────────────────────

      const context = this.buildContext(studentName, scoringResult);

      // ─── Step 3: Build User Prompt ───────────────────────────────────────

      const userPrompt = this.buildUserPrompt(context);

      // ─── Step 4: Call Ollama ──────────────────────────────────────────────

      const generatedText = await ollamaChat({
        model: 'llama3.2:latest', // Use fast model for bilans
        messages: [
          {
            role: 'system',
            content: promptTemplate.systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7, // Slightly creative for narrative
        numPredict: 2000, // Max 2000 tokens for bilan
      });

      console.log(
        `[BilanGenerator] ${audience} bilan generated (${generatedText.length} chars)`
      );

      return generatedText;
    } catch (error) {
      console.error(`[BilanGenerator] Failed to generate ${audience} bilan:`, error);
      throw new Error(
        `Failed to generate ${audience} bilan: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build context object for prompt rendering
   */
  private static buildContext(studentName: string, scoringResult: ScoringResult): BilanPromptContext {
    return {
      studentName,
      globalScore: scoringResult.globalScore,
      confidenceIndex: scoringResult.confidenceIndex,
      precisionIndex: scoringResult.precisionIndex,
      strengths: scoringResult.strengths,
      weaknesses: scoringResult.weaknesses,
      recommendations: scoringResult.recommendations,
      metrics: scoringResult.metrics,
      diagnosticText: scoringResult.diagnosticText,
      lucidityText: scoringResult.lucidityText,
      totalQuestions: scoringResult.totalQuestions,
      totalAttempted: scoringResult.totalAttempted,
      totalCorrect: scoringResult.totalCorrect,
    };
  }

  /**
   * Build user prompt from context
   */
  private static buildUserPrompt(context: BilanPromptContext): string {
    return `
Voici les résultats de l'évaluation pour ${context.studentName} :

**Scores Globaux :**
- Score global : ${context.globalScore}/100
- Indice de confiance : ${context.confidenceIndex}/100
- Indice de précision : ${context.precisionIndex}/100

**Statistiques :**
- Questions totales : ${context.totalQuestions}
- Questions tentées : ${context.totalAttempted}
- Réponses correctes : ${context.totalCorrect}

**Points Forts :**
${context.strengths.map((s: string) => `- ${s}`).join('\n')}

**Points Faibles :**
${context.weaknesses.map((w: string) => `- ${w}`).join('\n')}

**Recommandations :**
${context.recommendations.map((r: string) => `- ${r}`).join('\n')}

**Diagnostic :**
${context.diagnosticText}

**Analyse de Lucidité :**
${context.lucidityText}

Génère maintenant un bilan personnalisé et motivant en suivant les instructions du prompt système.
    `.trim();
  }
}
