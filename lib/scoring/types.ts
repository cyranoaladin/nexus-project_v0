import { z } from 'zod';

export const QcmMcqChoiceSchema = z.object({
  k: z.string().min(1),
  latex: z.string().optional(),
  correct: z.boolean().optional(),
});

export const QcmMcqItemSchema = z.object({
  id: z.string().min(1),
  domain: z.string().min(1),
  type: z.literal('mcq'),
  difficulty: z.enum(['A', 'B', 'C']),
  weight: z.number().int().positive(),
  prompt_latex: z.string().min(1),
  choices: z.array(QcmMcqChoiceSchema).min(2),
  explanation_latex: z.string().optional(),
});

export const QcmShortNumericSchema = z.object({
  id: z.string().min(1),
  domain: z.string().min(1),
  type: z.union([z.literal('numeric'), z.literal('short')]),
  difficulty: z.enum(['A', 'B', 'C']),
  weight: z.number().int().positive(),
  prompt_latex: z.string().min(1),
  answer_latex: z.string().min(1),
  explanation_latex: z.string().optional(),
});

export const QcmItemSchema = z.union([QcmMcqItemSchema, QcmShortNumericSchema]);
export type QcmItem = z.infer<typeof QcmItemSchema>;

export const PedagoLikertSchema = z.object({
  id: z.string().min(1),
  section: z.string().optional(),
  type: z.literal('likert'),
  label: z.string().min(1),
  scale: z.object({ min: z.number(), max: z.number(), labels: z.array(z.string()).optional() }).optional(),
  weight: z.number().optional(),
  mapsTo: z.string().min(1),
});

export const PedagoSingleSchema = z.object({
  id: z.string().min(1),
  section: z.string().optional(),
  type: z.literal('single'),
  label: z.string().min(1),
  options: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
  weight: z.number().optional(),
  mapsTo: z.string().min(1),
});

export const PedagoMultiSchema = z.object({
  id: z.string().min(1),
  section: z.string().optional(),
  type: z.literal('multi'),
  label: z.string().min(1),
  options: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
  weight: z.number().optional(),
  mapsTo: z.string().min(1),
});

export const PedagoTextSchema = z.object({
  id: z.string().min(1),
  section: z.string().optional(),
  type: z.literal('text'),
  label: z.string().min(1),
  mapsTo: z.string().optional(),
});

export const PedagoItemSchema = z.union([PedagoLikertSchema, PedagoSingleSchema, PedagoMultiSchema, PedagoTextSchema]);
export type PedagoItem = z.infer<typeof PedagoItemSchema>;
