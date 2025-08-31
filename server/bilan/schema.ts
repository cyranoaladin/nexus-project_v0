import { z } from 'zod';

export const BilanOutSchema = z.object({
  intro_text: z.string(),
  diagnostic_text: z.string(),
  profile_text: z.string(),
  roadmap_text: z.string(),
  offers_text: z.string(),
  conclusion_text: z.string(),
  table_domain_rows: z.array(z.object({
    domain: z.string(),
    points: z.number(),
    max: z.number(),
    masteryPct: z.number(),
    remark: z.string().optional(),
  })),
});

export type BilanOut = z.infer<typeof BilanOutSchema>;
