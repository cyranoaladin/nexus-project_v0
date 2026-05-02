// ═══════════════════════════════════════════════════════════════════════════════
// NPC Worker - AI Processing Service
// Connects worker jobs to Chutes.ai with validation
// ═══════════════════════════════════════════════════════════════════════════════

import { PrismaClient, AiJobType, CopySubmission } from '@prisma/client';
import {
  chutesClient,
  buildDiagnosisPrompt,
  buildMatrixPrompt,
  buildRoadmapPrompt,
  buildMentorPrompt,
  validatePedagogicalDiagnostic,
  validateCompetenceMatrixResult,
  validateRemediationRoadmapResult,
  validateMentorAdviceResult,
  generateFallbackDiagnostic,
  generateFallbackMatrix,
  generateFallbackRoadmap,
  generateFallbackMentorAdvice,
  NPC_LLM_MODE,
  type PedagogicalDiagnostic,
  type CompetenceMatrix,
  type RemediationRoadmap,
  type MentorAdvice,
} from '../../../lib/npc';

const prisma = new PrismaClient();

// ─── Processors ───

export async function processPedagogicalDiagnosis(
  jobId: string,
  submissionId: string
): Promise<{ success: true; output: unknown; tokensUsed: number } | { success: false; error: string }> {
  try {
    // Fetch submission with OCR text
    const submission = await prisma.copySubmission.findUnique({
      where: { id: submissionId },
      include: { pages: true, student: true },
    });

    if (!submission) {
      return { success: false, error: 'Submission not found' };
    }

    const ocrText = submission.pages.map(p => p.ocrText).filter(Boolean).join('\n\n');

    if (!ocrText) {
      return { success: false, error: 'No OCR text available' };
    }

    // Build prompt
    const prompt = buildDiagnosisPrompt({
      subject: submission.subject,
      gradeLevel: submission.gradeLevel || 'PREMIERE',
      ocrText,
      pageCount: submission.pages.length,
      title: submission.title,
      description: submission.description || undefined,
    });

    // Skip if stub/off mode
    if (NPC_LLM_MODE === 'off') {
      return { success: false, error: 'LLM_MODE_OFF' };
    }

    if (NPC_LLM_MODE === 'stub') {
      const stub = generateFallbackDiagnostic();
      return {
        success: true,
        output: stub,
        tokensUsed: 500,
      };
    }

    // Call Chutes.ai
    const result = await chutesClient.completeJson<PedagogicalDiagnostic>(
      [{ role: 'user', content: prompt }],
      'PedagogicalDiagnosticSchema',
      { temperature: 0.2, max_tokens: 8000 }
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Validate result
    const validation = validatePedagogicalDiagnostic(result.data);
    if (!validation.valid) {
      return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
    }

    return {
      success: true,
      output: validation.data,
      tokensUsed: result.tokens.total,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function processCompetenceMatrix(
  jobId: string,
  submissionId: string,
  diagnostic: PedagogicalDiagnostic
): Promise<{ success: true; output: unknown; tokensUsed: number } | { success: false; error: string }> {
  try {
    const submission = await prisma.copySubmission.findUnique({
      where: { id: submissionId },
      include: { pages: true },
    });

    if (!submission) {
      return { success: false, error: 'Submission not found' };
    }

    const ocrText = submission.pages.map(p => p.ocrText).filter(Boolean).join('\n\n');

    const prompt = buildMatrixPrompt({
      subject: submission.subject,
      gradeLevel: submission.gradeLevel || 'PREMIERE',
      ocrText,
      diagnostic: {
        strengths: diagnostic.strengths,
        weaknesses: diagnostic.weaknesses,
        overallLevel: diagnostic.overallLevel,
      },
    });

    if (NPC_LLM_MODE === 'off') {
      return { success: false, error: 'LLM_MODE_OFF' };
    }

    if (NPC_LLM_MODE === 'stub') {
      const stub = generateFallbackMatrix(submission.subject);
      return {
        success: true,
        output: stub,
        tokensUsed: 400,
      };
    }

    const result = await chutesClient.completeJson<CompetenceMatrix>(
      [{ role: 'user', content: prompt }],
      'CompetenceMatrixSchema',
      { temperature: 0.2, max_tokens: 6000 }
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const validation = validateCompetenceMatrixResult(result.data);
    if (!validation.valid) {
      return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
    }

    return {
      success: true,
      output: validation.data,
      tokensUsed: result.tokens.total,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function processRemediationRoadmap(
  jobId: string,
  submissionId: string,
  diagnostic: PedagogicalDiagnostic,
  matrix: CompetenceMatrix
): Promise<{ success: true; output: unknown; tokensUsed: number } | { success: false; error: string }> {
  try {
    const submission = await prisma.copySubmission.findUnique({
      where: { id: submissionId },
      include: { student: true },
    });

    if (!submission) {
      return { success: false, error: 'Submission not found' };
    }

    const prompt = buildRoadmapPrompt({
      subject: submission.subject,
      gradeLevel: submission.gradeLevel || 'PREMIERE',
      diagnostic: {
        weaknesses: diagnostic.weaknesses,
        keyRecommendations: diagnostic.keyRecommendations,
      },
      competenceMatrix: matrix,
      studentName: submission.student?.userId || 'Élève',
    });

    if (NPC_LLM_MODE === 'off') {
      return { success: false, error: 'LLM_MODE_OFF' };
    }

    if (NPC_LLM_MODE === 'stub') {
      const stub = generateFallbackRoadmap();
      return {
        success: true,
        output: stub,
        tokensUsed: 600,
      };
    }

    const result = await chutesClient.completeJson<RemediationRoadmap>(
      [{ role: 'user', content: prompt }],
      'RemediationRoadmapSchema',
      { temperature: 0.3, max_tokens: 8000 }
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const validation = validateRemediationRoadmapResult(result.data);
    if (!validation.valid) {
      return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
    }

    return {
      success: true,
      output: validation.data,
      tokensUsed: result.tokens.total,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function processMentorAdvice(
  jobId: string,
  submissionId: string,
  diagnostic: PedagogicalDiagnostic,
  matrix: CompetenceMatrix
): Promise<{ success: true; output: unknown; tokensUsed: number } | { success: false; error: string }> {
  try {
    const submission = await prisma.copySubmission.findUnique({
      where: { id: submissionId },
      include: { student: true },
    });

    if (!submission) {
      return { success: false, error: 'Submission not found' };
    }

    const prompt = buildMentorPrompt({
      studentName: submission.student?.userId || 'Élève',
      subject: submission.subject,
      diagnostic,
      competenceMatrix: matrix,
    });

    if (NPC_LLM_MODE === 'off') {
      return { success: false, error: 'LLM_MODE_OFF' };
    }

    if (NPC_LLM_MODE === 'stub') {
      const stub = generateFallbackMentorAdvice(submission.student?.userId || 'Élève');
      return {
        success: true,
        output: stub,
        tokensUsed: 300,
      };
    }

    const result = await chutesClient.completeJson<MentorAdvice>(
      [{ role: 'user', content: prompt }],
      'MentorAdviceSchema',
      { temperature: 0.4, max_tokens: 4000 }
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const validation = validateMentorAdviceResult(result.data);
    if (!validation.valid) {
      return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
    }

    return {
      success: true,
      output: validation.data,
      tokensUsed: result.tokens.total,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function processVisionOcr(
  _jobId: string,
  imageBase64: string,
  mimeType: string = 'image/png'
): Promise<{ success: true; output: unknown; tokensUsed: number } | { success: false; error: string }> {
  try {
    const result = await chutesClient.visionOcr(imageBase64, mimeType);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      output: {
        text: result.text,
        confidence: result.confidence,
      },
      tokensUsed: result.tokens.total,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
