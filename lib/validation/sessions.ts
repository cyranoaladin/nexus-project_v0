/**
 * Session/Booking Validation Schemas
 *
 * Validation for session booking API endpoints.
 */

import { z } from 'zod';
import { idSchema } from './common';
import { tunisTodayUtcMidnight } from '@/lib/planning/series';

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
 * Parent/Student self-service booking schema (POST /api/sessions/book).
 *
 * Tâche 12 (docs/superpowers/plans/2026-09-06-core-family-academic-planning.md) :
 * `studentId`/`coachId` restent, VOLONTAIREMENT, les mêmes noms de champ
 * publics que l'ancien `bookFullSessionSchema` — mais leurs VALEURS sont
 * désormais des identités canoniques (`Student.id`/`CoachProfile.id`), jamais
 * `User.id`. `bookFullSessionSchema` ci-dessus reste inchangé (et ses propres
 * tests aussi) : ce schéma est un NOUVEAU contrat, pas une réécriture sur
 * place, pour ne pas casser une couverture de test qui ne concerne plus la
 * route qui l'utilisait.
 *
 * `assignmentId` + `academicCourseKey` remplacent l'ancienne matière
 * générique `subject` — même raisonnement que
 * `assistantCreateSessionBookingSchema` : `CoachStudentAssignment
 * .academicCourseKeys` est l'autorité du périmètre de cours (Tâche 9), et la
 * matérialisation (`lib/planning/series.ts`) dérive elle-même la matière
 * historique (`SessionBooking.subject`) depuis `academicCourseKey`.
 *
 * Aucune récurrence, aucune dérogation possible pour cet acteur (voir la
 * branche `PARENT_STUDENT` de `PlanningInvariantRequester`,
 * lib/planning/invariants.ts) — toujours une occurrence unique.
 */
export const parentStudentBookSessionSchema = z.object({
  studentId: idSchema,
  coachId: idSchema,
  assignmentId: idSchema,
  academicCourseKey: z.string().trim().min(1, 'academicCourseKey is required'),
  scheduledDate: z.string().min(1, 'Date is required').refine((date) => {
    // Compare YYYY-MM-DD strings anchored on the Tunis calendar day (same
    // convention as `lib/planning/series.ts`/`invariants.ts`), not the raw
    // UTC day: near the UTC day boundary (23:00-24:00 UTC = 00:00-01:00
    // Tunis, fixed UTC+1, no DST since 2009) the two disagree, and a raw
    // UTC comparison would accept a date already elapsed in Tunis wall time.
    const todayStr = tunisTodayUtcMidnight().toISOString().split('T')[0];
    return date >= todayStr;
  }, 'Cannot book sessions in the past'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  duration: z.number().min(30).max(180), // 30 minutes to 3 hours
  type: z.enum(['INDIVIDUAL', 'GROUP', 'MASTERCLASS']).default('INDIVIDUAL'),
  modality: z.enum(['ONLINE', 'IN_PERSON', 'HYBRID']).default('ONLINE'),
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().max(500, 'Description too long').optional(),
}).refine((data) => {
  const startTime = data.startTime.split(':').map(Number);
  const endTime = data.endTime.split(':').map(Number);
  const startMinutes = startTime[0] * 60 + startTime[1];
  const endMinutes = endTime[0] * 60 + endTime[1];
  return endMinutes > startMinutes;
}, {
  message: 'End time must be after start time',
  path: ['endTime']
}).refine((data) => {
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

export type ParentStudentBookSessionInput = z.infer<typeof parentStudentBookSessionSchema>;

/**
 * Assistante/Staff governed planning schema (POST /api/assistante/sessions)
 *
 * Task 11 (docs/superpowers/plans/2026-09-06-core-family-academic-planning.md) :
 * matérialise une `PlanningSeries` (une occurrence unique = une série avec
 * `recurrenceCount: 1`) via `lib/planning/series.ts`, qui applique intégralement
 * les invariants de la Tâche 10 (`lib/planning/invariants.ts`) — cette
 * validation ne fait donc QUE la mise en forme, jamais une règle métier
 * dupliquée (conflits, disponibilité, périmètre pédagogique...).
 *
 * - `coachProfileId`/`studentProfileId` sont des identités canoniques
 *   (`CoachProfile.id`/`Student.id`), jamais des `User.id` bruts.
 * - `assignmentId` + `academicCourseKey` remplacent l'ancienne matière
 *   générique `subject` — la Tâche 9 a fait de `CoachStudentAssignment
 *   .academicCourseKeys` l'autorité du périmètre de cours.
 * - `override` est un objet énuméré `{ code, reason }`, jamais un booléen
 *   générique : seul ADMIN peut en fournir un (vérifié côté route via le
 *   rôle de session, puis re-vérifié structurellement par
 *   `PlanningInvariantRequester`).
 * - Allows planning in the past (for backfilling).
 * - Supports weekly recurrence by materializing one governed series.
 */
export const assistantWeeklyRecurrenceSchema = z.object({
  frequency: z.literal('WEEKLY'),
  intervalWeeks: z.number().int().min(1).max(52).default(1),
  count: z.number().int().min(1).max(104).optional(),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine((data) => Boolean(data.count) !== Boolean(data.until), {
  message: 'Provide either count or until',
  path: ['count'],
});

/** Code de dérogation ADMIN énuméré — reflète `PlanningOverrideCode` (lib/planning/invariants.ts). */
export const planningOverrideRequestSchema = z.object({
  code: z.literal('COACH_CAPABILITY_NOT_DECLARED'),
  reason: z.string().trim().min(1, 'La justification de la dérogation est requise').max(500),
});

export const assistantCreateSessionBookingSchema = z.object({
  coachProfileId: idSchema,
  studentProfileId: idSchema,
  assignmentId: idSchema,
  academicCourseKey: z.string().trim().min(1, 'academicCourseKey is required'),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  duration: z.number().int().min(15).max(8 * 60), // 15 minutes to 8 hours
  type: z.enum(['INDIVIDUAL', 'GROUP', 'MASTERCLASS']).default('INDIVIDUAL'),
  modality: z.enum(['ONLINE', 'IN_PERSON', 'HYBRID']).default('ONLINE'),
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().trim().max(500, 'Description too long').optional(),
  location: z.string().trim().max(200).optional(),
  override: planningOverrideRequestSchema.optional(),
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

/**
 * Édition future-only d'une `PlanningSeries` (PUT /api/assistante/planning/series/[seriesId]).
 *
 * CAS optimiste via `expectedRevision`, même idiome que
 * `lib/curriculum/student-academic-profile.ts`. Les occurrences passées ne
 * sont jamais touchées ; seules les occurrences futures sont annulées puis
 * rematérialisées selon le nouveau planning fourni ici.
 */
export const planningSeriesEditSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  localStartTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  localEndTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  duration: z.number().int().min(15).max(8 * 60),
  type: z.enum(['INDIVIDUAL', 'GROUP', 'MASTERCLASS']).default('INDIVIDUAL'),
  modality: z.enum(['ONLINE', 'IN_PERSON', 'HYBRID']).default('ONLINE'),
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().trim().max(500, 'Description too long').optional(),
  location: z.string().trim().max(200).optional(),
  override: planningOverrideRequestSchema.optional(),
  recurrence: assistantWeeklyRecurrenceSchema.optional(),
}).refine((data) => {
  const [sh, sm] = data.localStartTime.split(':').map(Number);
  const [eh, em] = data.localEndTime.split(':').map(Number);
  return (eh * 60 + em) > (sh * 60 + sm);
}, { message: 'End time must be after start time', path: ['localEndTime'] })
  .refine((data) => {
    const [sh, sm] = data.localStartTime.split(':').map(Number);
    const [eh, em] = data.localEndTime.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm) === data.duration;
  }, { message: 'Duration must match the time difference between start and end time', path: ['duration'] });

export type PlanningSeriesEditInput = z.infer<typeof planningSeriesEditSchema>;

export const planningSeriesCancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
