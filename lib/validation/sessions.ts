/**
 * Session/Booking Validation Schemas
 *
 * Validation for session booking API endpoints.
 */

import { z } from 'zod';
import { idSchema, dateRangeSchema } from './common';

/**
 * Session booking schema (POST /api/sessions/book)
 */
export const bookSessionSchema = z.object({
  sessionId: idSchema,
  studentId: idSchema,
  notes: z.string().trim().max(500).optional(),
});

export type BookSessionInput = z.infer<typeof bookSessionSchema>;

/**
 * Session creation schema (POST /api/admin/sessions)
 */
export const createSessionSchema = z.object({
  coachId: idSchema,
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  description: z.string().trim().max(1000).optional(),
  scheduledAt: z.coerce.date(),
  duration: z.number().int().min(30).max(480), // 30 min to 8 hours
  maxStudents: z.number().int().min(1).max(20).default(1),
  location: z.string().trim().max(200).optional(),
  onlineLink: z.string().url().optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

/**
 * Session update schema (PATCH /api/admin/sessions/:id)
 */
export const updateSessionSchema = createSessionSchema.partial();

export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

/**
 * Session list filters (GET /api/sessions)
 */
export const listSessionsSchema = z.object({
  coachId: idSchema.optional(),
  studentId: idSchema.optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type ListSessionsParams = z.infer<typeof listSessionsSchema>;

/**
 * Session cancellation schema (POST /api/sessions/:id/cancel)
 */
export const cancelSessionSchema = z.object({
  reason: z.string().trim().min(1, 'Cancellation reason is required').max(500),
});

export type CancelSessionInput = z.infer<typeof cancelSessionSchema>;
