/**
 * Assessment Submission API Types
 * 
 * Type definitions and Zod schemas for the universal assessment submission endpoint.
 */

import { z } from 'zod';
import { Subject } from '@/lib/assessments/core/types';

// ─── Request Schema ──────────────────────────────────────────────────────────

export const submitAssessmentSchema = z.object({
  subject: z.nativeEnum(Subject),
  grade: z.enum(['PREMIERE', 'TERMINALE']),
  studentData: z.object({
    email: z.string().email('Email invalide'),
    name: z.string().min(2, 'Nom trop court'),
    phone: z.string().optional(),
    schoolYear: z.string().optional(),
  }),
  answers: z.record(z.string(), z.string()), // questionId -> optionId
  duration: z.number().int().positive().optional(), // Duration in ms
  metadata: z
    .object({
      userAgent: z.string().optional(),
      startedAt: z.string().datetime().optional(),
      completedAt: z.string().datetime().optional(),
    })
    .optional(),
});

export type SubmitAssessmentRequest = z.infer<typeof submitAssessmentSchema>;

// ─── Response Schema ─────────────────────────────────────────────────────────

export const submitAssessmentResponseSchema = z.object({
  success: z.boolean(),
  assessmentId: z.string(),
  redirectUrl: z.string(),
  message: z.string().optional(),
});

export type SubmitAssessmentResponse = z.infer<typeof submitAssessmentResponseSchema>;

// ─── Status Response Schema ──────────────────────────────────────────────────

export const assessmentStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['PENDING', 'SCORING', 'GENERATING', 'COMPLETED', 'FAILED']),
  progress: z.number().min(0).max(100).optional(),
  message: z.string().optional(),
  result: z
    .object({
      globalScore: z.number(),
      confidenceIndex: z.number(),
      recommendations: z.array(z.string()),
    })
    .optional(),
});

export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;
