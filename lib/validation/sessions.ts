/**
 * Session/Booking Validation Schemas
 *
 * Validation for session booking API endpoints.
 */

import { z } from 'zod';
import { idSchema } from './common';

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
  sessionId: z.string().cuid('Invalid session ID'),
  reason: z.string().trim().min(1, 'Cancellation reason is required').max(500),
});

export type CancelSessionInput = z.infer<typeof cancelSessionSchema>;

/**
 * Full session booking schema (POST /api/sessions/book)
 * For direct parent/student booking with complete validation
 */
export const bookFullSessionSchema = z.object({
  coachId: idSchema,
  studentId: idSchema,
  subject: z.enum(['MATHEMATIQUES', 'NSI', 'FRANCAIS', 'PHILOSOPHIE', 'HISTOIRE_GEO', 'ANGLAIS', 'ESPAGNOL', 'PHYSIQUE_CHIMIE', 'SVT', 'SES']),
  scheduledDate: z.string().min(1, 'Date is required').refine((date) => {
    // Compare YYYY-MM-DD strings to avoid UTC vs local timezone mismatch
    const todayStr = new Date().toISOString().split('T')[0];
    return date >= todayStr;
  }, 'Cannot book sessions in the past'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  duration: z.number().min(30).max(180), // 30 minutes to 3 hours
  type: z.enum(['INDIVIDUAL', 'GROUP', 'MASTERCLASS']).default('INDIVIDUAL'),
  modality: z.enum(['ONLINE', 'IN_PERSON', 'HYBRID']).default('ONLINE'),
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().max(500, 'Description too long').optional(),
  creditsToUse: z.number().min(0).max(10).optional().default(0),
}).refine((data) => {
  // Validate that end time is after start time
  const startTime = data.startTime.split(':').map(Number);
  const endTime = data.endTime.split(':').map(Number);
  const startMinutes = startTime[0] * 60 + startTime[1];
  const endMinutes = endTime[0] * 60 + endTime[1];
  return endMinutes > startMinutes;
}, {
  message: 'End time must be after start time',
  path: ['endTime']
}).refine((data) => {
  // Validate that duration matches start and end time
  const startTime = data.startTime.split(':').map(Number);
  const endTime = data.endTime.split(':').map(Number);
  const startMinutes = startTime[0] * 60 + startTime[1];
  const endMinutes = endTime[0] * 60 + endTime[1];
  const calculatedDuration = endMinutes - startMinutes;
  return calculatedDuration === data.duration;
}, {
  message: 'Duration must match the time difference between start and end time',
  path: ['duration']
});

export type BookFullSessionInput = z.infer<typeof bookFullSessionSchema>;

/**
 * Assistante/Staff session planning schema (POST /api/assistante/sessions)
 *
 * - Allows planning in the past (for backfilling).
 * - Supports weekly recurrence by duplicating independent SessionBooking rows.
 * - Supports "override" to bypass non-conflict validations (conflicts remain blocked).
 */
const sessionSubjectSchema = z.enum([
  'MATHEMATIQUES',
  'NSI',
  'FRANCAIS',
  'PHILOSOPHIE',
  'HISTOIRE_GEO',
  'ANGLAIS',
  'ESPAGNOL',
  'PHYSIQUE_CHIMIE',
  'SVT',
  'SES',
]);

export const assistantWeeklyRecurrenceSchema = z.object({
  frequency: z.literal('WEEKLY'),
  intervalWeeks: z.number().int().min(1).max(52).default(1),
  count: z.number().int().min(1).max(104).optional(),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine((data) => Boolean(data.count) !== Boolean(data.until), {
  message: 'Provide either count or until',
  path: ['count'],
});

export const assistantCreateSessionBookingSchema = z.object({
  coachId: idSchema,
  studentId: idSchema,
  subject: sessionSubjectSchema,
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  duration: z.number().int().min(15).max(8 * 60), // 15 minutes to 8 hours
  type: z.enum(['INDIVIDUAL', 'GROUP', 'MASTERCLASS']).default('INDIVIDUAL'),
  modality: z.enum(['ONLINE', 'IN_PERSON', 'HYBRID']).default('ONLINE'),
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().trim().max(500, 'Description too long').optional(),
  location: z.string().trim().max(200).optional(),
  override: z.boolean().optional().default(false),
  creditsUsed: z.number().int().min(0).max(10).optional().default(0),
  recurrence: assistantWeeklyRecurrenceSchema.optional(),
}).refine((data) => {
  const [sh, sm] = data.startTime.split(':').map(Number);
  const [eh, em] = data.endTime.split(':').map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  return endMinutes > startMinutes;
}, {
  message: 'End time must be after start time',
  path: ['endTime'],
}).refine((data) => {
  const [sh, sm] = data.startTime.split(':').map(Number);
  const [eh, em] = data.endTime.split(':').map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  return (endMinutes - startMinutes) === data.duration;
}, {
  message: 'Duration must match the time difference between start and end time',
  path: ['duration'],
});

export type AssistantCreateSessionBookingInput = z.infer<typeof assistantCreateSessionBookingSchema>;
