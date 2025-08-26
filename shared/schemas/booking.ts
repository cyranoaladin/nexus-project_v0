import { z } from 'zod';
import { zISODate, zSubject, zTimeHHMM } from './common';

export const BookingRequestSchema = z.object({
  coachId: z.string().min(1),
  studentId: z.string().min(1),
  parentId: z.string().min(1).nullable().optional(),
  subject: zSubject,
  scheduledDate: zISODate,
  startTime: zTimeHHMM,
  endTime: zTimeHHMM.optional(),
  duration: z.number().int().positive().max(11 * 60), // <= 11h safety
  type: z.enum(['INDIVIDUAL', 'GROUP', 'MASTERCLASS']).default('INDIVIDUAL'),
  modality: z.enum(['ONLINE', 'IN_PERSON', 'HYBRID']).default('ONLINE'),
  title: z.string().min(1),
  description: z.string().max(500).optional(),
  creditsToUse: z.number().int().positive(),
});

export const BookingResponseSchema = z.object({
  success: z.literal(true),
  sessionId: z.string().min(1),
  bookingId: z.string().min(1).optional(),
}).or(z.object({ success: z.literal(false).optional(), error: z.string() }));

export type BookingRequest = z.infer<typeof BookingRequestSchema>;
export type BookingResponse = z.infer<typeof BookingResponseSchema>;

