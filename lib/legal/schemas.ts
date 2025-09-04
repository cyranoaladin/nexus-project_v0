import { z } from 'zod';

export const LegalSlugEnum = z.enum([
  'confidentialite',
  'cgu',
  'cgv',
  'mentions-legales',
  'a-propos',
]);

export const LegalUpdateSchema = z.object({
  slug: LegalSlugEnum,
  title: z.string().min(5).max(140),
  contentMd: z.string().min(100),
  placeholders: z.record(z.string(), z.string()).optional(),
});

export type LegalUpdateInput = z.infer<typeof LegalUpdateSchema>;
