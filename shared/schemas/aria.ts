import { z } from 'zod';
import { zAttachment, zSubject } from './common';

export const AriaChatRequestSchema = z.object({
  message: z.string().min(1, 'Le message ne peut pas être vide.'),
  subject: zSubject,
  attachments: z.array(zAttachment).optional().default([]),
  forcePdf: z.boolean().optional().default(false),
  docTitle: z.string().max(120).optional(),
  docDescription: z.string().max(500).optional(),
});

export const AriaChatResponseSchema = z.object({
  response: z.string(),
  documentUrl: z.string().url().optional(),
});

export const AriaFeedbackSchema = z.object({
  messageId: z.string().min(1),
  feedback: z.boolean(),
});

export type AriaChatRequest = z.infer<typeof AriaChatRequestSchema>;
export type AriaChatResponse = z.infer<typeof AriaChatResponseSchema>;
export type AriaFeedback = z.infer<typeof AriaFeedbackSchema>;
