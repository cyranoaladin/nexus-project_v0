/**
 * Shared Zod request schemas for the /api/quotes/* routes — kept in one
 * place so the situation/budget shape can't drift between the recommend
 * and create endpoints (CDC §43: `.strict()`, bounded, no unknown fields).
 */
import { z } from 'zod';
import { Subject } from '@prisma/client';

export const subjectEnum = z.nativeEnum(Subject);

export const situationSchema = z
  .object({
    level: z.enum(['premiere', 'terminale']),
    examSession: z.number().int().min(2000).max(2100),
    specialites: z.tuple([subjectEnum, subjectEnum]),
    specialiteAbandonnee: subjectEnum.optional(),
    langueA: subjectEnum.optional(),
    langueB: subjectEnum.optional(),
  })
  .strict();

export const budgetSchema = z
  .object({
    monthlyBudgetTnd: z.number().int().min(0).max(20000),
    strategy: z.enum(['RESPECT_BUDGET', 'BEST_BALANCE', 'MOST_COMPLETE']),
  })
  .strict();

export const eligibilityAnswersSchema = z.record(z.string().max(60), z.boolean()).optional();
