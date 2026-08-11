// ═══════════════════════════════════════════════════════════════════════════════
// NPC Worker - Main Entry Point
// Asynchronous AI job processor for Nexus Pedagogy Cockpit
// ═══════════════════════════════════════════════════════════════════════════════

import { PrismaClient, AiJobStatus, AiJobType } from '@prisma/client';
import {
  NPC_WORKER_POLL_INTERVAL_MS,
  NPC_WORKER_LOCK_DURATION_MS,
  NPC_MAX_RETRY_ATTEMPTS,
  NPC_LLM_MODE,
} from '../../lib/npc';
import {
  assertNpcStorageReady,
  readNpcStorageFile,
} from '../../lib/npc/storage-root';
import {
  finalizePedagogicalDiagnosis,
  markPedagogicalDiagnosisFailed,
  persistVisionOcrResult,
  validateSubmissionBeforeDiagnosis,
} from './submission-finalization';
try {
  assertNpcStorageReady({ capability: 'read-only' });
} catch {
  console.error('NPC_STORAGE_PREFLIGHT_FAILED');
  process.exit(1);
}

// The processor module owns a Prisma client too, so it must not be evaluated
// until the storage preflight has succeeded.
const aiService = import('./processors/ai-service');

// Initialize Prisma
const prisma = new PrismaClient();

// Worker instance ID for claim tracking
const WORKER_ID = process.env.HOSTNAME || `worker-${Date.now()}`;

// ═══════════════════════════════════════════════════════════════════════════════
// Job Processors Registry
// ═══════════════════════════════════════════════════════════════════════════════

interface JobProcessor {
  (jobId: string, inputData: unknown): Promise<{
    success: boolean;
    output?: unknown;
    error?: string;
    tokensUsed?: number;
  }>;
}

const processors: Record<AiJobType, JobProcessor> = {
  [AiJobType.VISION_OCR]: async (jobId, input) => {
    console.log(`[${jobId}] Processing VISION_OCR...`);
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    const { filePath, mimeType } = parsed as { pageId: string; submissionId: string; filePath: string; mimeType: string };
    // Read file from disk and convert to base64
    const fileBuffer = await readNpcStorageFile(filePath);
    const imageBase64 = fileBuffer.toString('base64');
    return (await aiService).processVisionOcr(
      jobId,
      imageBase64,
      mimeType || 'image/jpeg',
    );
  },
  [AiJobType.PEDAGOGICAL_DIAGNOSIS]: async (jobId, input) => {
    console.log(`[${jobId}] Processing PEDAGOGICAL_DIAGNOSIS...`);
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    const { submissionId } = parsed as { submissionId: string };
    return (await aiService).processPedagogicalDiagnosis(jobId, submissionId);
  },
  [AiJobType.COMPETENCE_MATRIX]: async (jobId, input) => {
    console.log(`[${jobId}] Processing COMPETENCE_MATRIX...`);
    const { submissionId, diagnostic } = input as { submissionId: string; diagnostic: unknown };
    return (await aiService).processCompetenceMatrix(
      jobId,
      submissionId,
      diagnostic as any,
    );
  },
  [AiJobType.REMEDIATION_ROADMAP]: async (jobId, input) => {
    console.log(`[${jobId}] Processing REMEDIATION_ROADMAP...`);
    const { submissionId, diagnostic, matrix } = input as {
      submissionId: string;
      diagnostic: unknown;
      matrix: unknown;
    };
    return (await aiService).processRemediationRoadmap(
      jobId,
      submissionId,
      diagnostic as any,
      matrix as any,
    );
  },
  [AiJobType.MENTOR_ADVICE]: async (jobId, input) => {
    console.log(`[${jobId}] Processing MENTOR_ADVICE...`);
    const { submissionId, diagnostic, matrix } = input as {
      submissionId: string;
      diagnostic: unknown;
      matrix: unknown;
    };
    return (await aiService).processMentorAdvice(
      jobId,
      submissionId,
      diagnostic as any,
      matrix as any,
    );
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Job Claiming
// ═══════════════════════════════════════════════════════════════════════════════

async function claimNextJob(): Promise<string | null> {
  try {
    // Find and claim the highest priority pending job
    const job = await prisma.$transaction(async (tx) => {
      // Find available job
      const pendingJob = await tx.aiProcessingJob.findFirst({
        where: {
          status: { in: [AiJobStatus.PENDING, AiJobStatus.QUEUED] },
          OR: [
            { nextRetryAt: null },
            { nextRetryAt: { lte: new Date() } },
          ],
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
        select: { id: true },
      });

      if (!pendingJob) return null;

      // Claim it
      const claimed = await tx.aiProcessingJob.update({
        where: {
          id: pendingJob.id,
          status: { in: [AiJobStatus.PENDING, AiJobStatus.QUEUED] },
        },
        data: {
          status: AiJobStatus.CLAIMED,
          claimedBy: WORKER_ID,
          claimedAt: new Date(),
        },
      });

      return claimed;
    });

    return job?.id || null;
  } catch (error) {
    console.error('[Worker] Error claiming job:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Job Processing
// ═══════════════════════════════════════════════════════════════════════════════

async function handleVisionOcrSuccess(
  jobId: string,
  inputData: unknown,
  ocrOutput: { text: string; confidence?: number }
): Promise<void> {
  try {
    const parsed = typeof inputData === 'string' ? JSON.parse(inputData) : inputData;
    const { pageId, submissionId } = parsed as {
      pageId: string;
      submissionId: string;
    };
    if (!pageId || !submissionId) {
      throw new Error('Missing pageId or submissionId in VISION_OCR inputData');
    }

    const persisted = await persistVisionOcrResult({
      prisma,
      submissionId,
      pageId,
      text: ocrOutput.text,
    });
    if (persisted === 'unavailable') return;
    console.log(`[${jobId}] Saved OCR text for page ${pageId} (${ocrOutput.text?.length ?? 0} chars)`);
  } catch (error) {
    console.error(`[${jobId}] Error in handleVisionOcrSuccess:`, error);
    throw error;
  }
}

async function handlePedagogicalDiagnosisSuccess(
  jobId: string,
  inputData: unknown,
  diagnosticOutput: unknown
): Promise<void> {
  const parsedInput = typeof inputData === 'string' ? JSON.parse(inputData) : inputData;
  const { submissionId } = parsedInput as { submissionId: string };
  if (!submissionId) {
    throw new Error('Missing submissionId in inputData');
  }

  const finalized = await finalizePedagogicalDiagnosis({
    prisma,
    submissionId,
    jobId,
    diagnosticOutput,
  });
  if (!finalized.ok) {
    throw new Error('NPC_SOURCE_INTEGRITY_FAILED');
  }
  console.log(`[${jobId}] Created PedagogicalReport ${finalized.reportId} for submission ${submissionId}`);
}

async function processJob(jobId: string): Promise<void> {
  const startTime = Date.now();

  try {
    // Fetch job details
    const job = await prisma.aiProcessingJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      console.error(`[${jobId}] Job not found`);
      return;
    }

    // Verify we still own this job
    if (job.claimedBy !== WORKER_ID) {
      console.warn(`[${jobId}] Job claimed by another worker`);
      return;
    }

    // Mark as processing
    await prisma.aiProcessingJob.update({
      where: { id: jobId },
      data: {
        status: AiJobStatus.PROCESSING,
        startedAt: new Date(),
      },
    });

    // Execute processor
    const processor = processors[job.type];
    if (!processor) {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    if (job.type === AiJobType.PEDAGOGICAL_DIAGNOSIS) {
      const parsedInput =
        typeof job.inputData === 'string'
          ? JSON.parse(job.inputData)
          : job.inputData;
      const { submissionId } = parsedInput as { submissionId?: string };
      if (!submissionId) throw new Error('Missing submissionId in inputData');
      const integrity = await validateSubmissionBeforeDiagnosis(prisma, submissionId);
      if (!integrity.ok) {
        await prisma.aiProcessingJob.update({
          where: { id: jobId },
          data: {
            status: AiJobStatus.FAILED,
            errorMessage: 'NPC_SOURCE_INTEGRITY_FAILED',
            completedAt: new Date(),
            processingDurationMs: Date.now() - startTime,
          },
        });
        return;
      }
    }

    const result = await processor(jobId, job.inputData);

    // Update job status
    if (result.success) {
      // Special post-processing
      if (job.type === AiJobType.VISION_OCR) {
        await handleVisionOcrSuccess(jobId, job.inputData, result.output as any);
      } else if (job.type === AiJobType.PEDAGOGICAL_DIAGNOSIS) {
        await handlePedagogicalDiagnosisSuccess(jobId, job.inputData, result.output as any);
      }

      await prisma.aiProcessingJob.update({
        where: { id: jobId },
        data: {
          status: AiJobStatus.COMPLETED,
          completedAt: new Date(),
          outputData: result.output as any,
          tokensUsed: result.tokensUsed,
          processingDurationMs: Date.now() - startTime,
        },
      });
      console.log(`[${jobId}] Completed in ${Date.now() - startTime}ms`);
    } else {
      throw new Error(result.error || 'Processing failed');
    }
  } catch (error) {
    console.error(`[${jobId}] Processing error:`, error);
    await handleJobFailure(jobId, error instanceof Error ? error.message : 'Unknown error');
  }
}

async function handleJobFailure(jobId: string, errorMessage: string): Promise<void> {
  try {
    const job = await prisma.aiProcessingJob.findUnique({
      where: { id: jobId },
      select: { retryCount: true, maxRetries: true, type: true, inputData: true },
    });

    if (!job) return;

    const shouldRetry = job.retryCount < job.maxRetries;

    if (shouldRetry) {
      const nextRetryAt = new Date(Date.now() + Math.pow(2, job.retryCount) * 60000); // Exponential backoff

      await prisma.aiProcessingJob.update({
        where: { id: jobId },
        data: {
          status: AiJobStatus.RETRYING,
          retryCount: { increment: 1 },
          nextRetryAt,
          errorMessage: errorMessage.slice(0, 1000), // Limit error message length
        },
      });
      console.log(`[${jobId}] Scheduled for retry ${job.retryCount + 1}/${job.maxRetries} at ${nextRetryAt.toISOString()}`);
    } else {
      await prisma.aiProcessingJob.update({
        where: { id: jobId },
        data: {
          status: AiJobStatus.FAILED,
          errorMessage: errorMessage.slice(0, 1000),
          completedAt: new Date(),
        },
      });

      // If this was a PEDAGOGICAL_DIAGNOSIS job, also update submission status
      if (job.type === AiJobType.PEDAGOGICAL_DIAGNOSIS) {
        const parsedInput =
          typeof job.inputData === 'string'
            ? JSON.parse(job.inputData)
            : job.inputData;
        const { submissionId } = parsedInput as { submissionId?: string };
        if (submissionId) {
          await markPedagogicalDiagnosisFailed(prisma, submissionId);
          console.log(`[${jobId}] Updated submission ${submissionId} to ANALYSIS_FAILED`);
        }
      }

      console.log(`[${jobId}] Failed after ${job.maxRetries} retries`);
    }
  } catch (error) {
    console.error(`[${jobId}] Error handling failure:`, error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Worker Loop
// ═══════════════════════════════════════════════════════════════════════════════

let isRunning = true;

async function workerLoop(): Promise<void> {
  console.log(`[Worker ${WORKER_ID}] Started - LLM_MODE: ${NPC_LLM_MODE}`);

  while (isRunning) {
    try {
      // Claim next job
      const jobId = await claimNextJob();

      if (jobId) {
        console.log(`[Worker] Claimed job ${jobId}`);
        await processJob(jobId);
      } else {
        // No jobs available, wait before polling again
        await sleep(NPC_WORKER_POLL_INTERVAL_MS);
      }
    } catch (error) {
      console.error('[Worker] Loop error:', error);
      await sleep(NPC_WORKER_POLL_INTERVAL_MS);
    }
  }

  console.log('[Worker] Stopped');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Lifecycle Management
// ═══════════════════════════════════════════════════════════════════════════════

async function shutdown(): Promise<void> {
  console.log('[Worker] Shutting down...');
  isRunning = false;

  // Release any claimed jobs
  try {
    const released = await prisma.aiProcessingJob.updateMany({
      where: {
        claimedBy: WORKER_ID,
        status: { in: [AiJobStatus.CLAIMED, AiJobStatus.PROCESSING] },
      },
      data: {
        status: AiJobStatus.QUEUED,
        claimedBy: null,
        claimedAt: null,
      },
    });
    console.log(`[Worker] Released ${released.count} claimed jobs`);
  } catch (error) {
    console.error('[Worker] Error releasing jobs:', error);
  }

  await prisma.$disconnect();
  console.log('[Worker] Shutdown complete');
  process.exit(0);
}

// Handle signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (error) => {
  console.error('[Worker] Uncaught exception:', error);
  shutdown();
});

// Start
workerLoop().catch((error) => {
  console.error('[Worker] Fatal error:', error);
  process.exit(1);
});
