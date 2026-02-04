/**
 * Session Report Validation Schemas
 *
 * Validation for session report form and API endpoints.
 */

import { z } from 'zod';
import { idSchema } from './common';

/**
 * Engagement level enum
 */
export const engagementLevelEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export type EngagementLevel = z.infer<typeof engagementLevelEnum>;

/**
 * Session report form schema
 * Used for client-side form validation with React Hook Form
 */
export const sessionReportSchema = z.object({
  summary: z.string().trim().min(20, "Le résumé doit contenir au moins 20 caractères"),
  topicsCovered: z.string().trim().min(10, "Veuillez décrire les sujets abordés"),
  performanceRating: z.number().int().min(1, "La note doit être au minimum 1").max(5, "La note doit être au maximum 5"),
  progressNotes: z.string().trim().min(10, "Veuillez ajouter des notes de progression"),
  recommendations: z.string().trim().min(10, "Veuillez ajouter des recommandations"),
  attendance: z.boolean(),
  engagementLevel: engagementLevelEnum.optional(),
  homeworkAssigned: z.string().trim().optional(),
  nextSessionFocus: z.string().trim().optional(),
});

export type SessionReportFormData = z.infer<typeof sessionReportSchema>;

/**
 * Report submission schema for API endpoint
 * Used for validating POST requests to /api/coach/sessions/[sessionId]/report
 */
export const reportSubmissionSchema = z.object({
  summary: z.string().trim().min(20, "Le résumé doit contenir au moins 20 caractères"),
  topicsCovered: z.string().trim().min(10, "Veuillez décrire les sujets abordés"),
  performanceRating: z.number().int().min(1, "La note doit être au minimum 1").max(5, "La note doit être au maximum 5"),
  progressNotes: z.string().trim().min(10, "Veuillez ajouter des notes de progression"),
  recommendations: z.string().trim().min(10, "Veuillez ajouter des recommandations"),
  attendance: z.boolean(),
  engagementLevel: engagementLevelEnum.optional(),
  homeworkAssigned: z.string().trim().optional(),
  nextSessionFocus: z.string().trim().optional(),
});

export type ReportSubmissionInput = z.infer<typeof reportSubmissionSchema>;

/**
 * Session report with ID (for GET requests)
 */
export const sessionReportWithIdSchema = sessionReportSchema.extend({
  id: idSchema,
  sessionId: idSchema,
  studentId: idSchema,
  coachId: idSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SessionReportData = z.infer<typeof sessionReportWithIdSchema>;
