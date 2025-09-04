import { z } from 'zod';

// Legacy lightweight schema used earlier (kept for reference)
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

// New unified premium schema (as per brief)
export const DomainScore = z.object({ domain: z.string(), percent: z.number().min(0).max(100) });
export const BilanPremiumV1 = z.object({
  meta: z.object({
    variant: z.enum(["parent","eleve"]),
    matiere: z.enum(["Maths","NSI"]),
    niveau: z.enum(["Première","Terminale"]),
    statut: z.enum(["fr","candidat_libre"]),
    createdAtISO: z.string().datetime(),
  }),
  eleve: z.object({
    firstName: z.string(),
    lastName: z.string(),
    etab: z.string().optional(),
  }),
  academic: z.object({
    globalPercent: z.number().min(0).max(100),
    scoresByDomain: z.array(DomainScore).min(1),
    forces: z.array(z.string()).default([]),
    faiblesses: z.array(z.string()).default([]),
    lacunesCritiques: z.array(z.string()).default([]),
  }),
  pedagogue: z.object({
    style: z.enum(["Visuel","Auditif","Kinesthesique"]),
    autonomie: z.enum(["faible","moyenne","bonne"]),
    organisation: z.enum(["faible","moyenne","bonne"]),
    stress: z.enum(["faible","moyen","élevé"]),
    flags: z.array(z.string()).default([]),
  }),
  plan: z.object({
    horizonMois: z.number().min(1).max(12),
    hebdoHeures: z.number().min(1).max(40),
    etapes: z.array(z.string()).min(1),
  }),
  offres: z.object({
    primary: z.string(),
    alternatives: z.array(z.string()).default([]),
    reasoning: z.string(),
  }),
  rag: z.object({
    citations: z.array(z.object({ title: z.string(), src: z.string(), snippet: z.string() })).default([]),
  }).optional(),
});
export type BilanPremium = z.infer<typeof BilanPremiumV1>;
