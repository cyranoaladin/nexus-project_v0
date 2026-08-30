import { z } from 'zod';

export const ariaChatRequestSchema = z
  .object({
    clientRequestId: z.string().uuid(),
    courseKey: z.string().min(1),
    skillId: z.string().min(1).optional(),
    resourceId: z.string().min(1).optional(),
    conversationId: z.string().min(1).optional(),
    content: z
      .string()
      .min(1, 'Message requis')
      .max(1500, 'Message trop long')
      .refine((value) => value.trim().length > 0, 'Message vide non autorisé'),
  })
  .strict();

export type AriaChatRequest = z.infer<typeof ariaChatRequestSchema>;
