/**
 * Shared Zod request schemas for the /api/quotes/* routes — kept in one
 * place so the situation/budget shape can't drift between the recommend
 * and create endpoints (CDC §43: `.strict()`, bounded, no unknown fields).
 */
import { z } from 'zod';
import { BUDGET_SLIDER_TND } from './ui-config';
import { DUPLICATE_LANGUAGE_MESSAGE, LANGUAGE_CODES } from '@/lib/exams/languages';
import { SPECIALITY_CODES } from '@/lib/exams/specialities';

export const specialityEnum = z.enum(SPECIALITY_CODES);
export const languageEnum = z.enum(LANGUAGE_CODES);

export const situationSchema = z
  .object({
    level: z.enum(['premiere', 'terminale']),
    examSession: z.number().int().min(2000).max(2100),
    specialites: z.tuple([specialityEnum, specialityEnum]),
    specialiteAbandonnee: specialityEnum.optional(),
    langueA: languageEnum.optional(),
    langueB: languageEnum.optional(),
  })
  .strict()
  .superRefine((situation, context) => {
    if (situation.langueA != null && situation.langueA === situation.langueB) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['langueB'],
        message: DUPLICATE_LANGUAGE_MESSAGE,
      });
    }
  });

export const budgetSchema = z
  .object({
    monthlyBudgetTnd: z.number().int().min(BUDGET_SLIDER_TND.inputMinTnd).max(BUDGET_SLIDER_TND.inputMaxTnd),
    strategy: z.enum(['RESPECT_BUDGET', 'BEST_BALANCE', 'MOST_COMPLETE']),
  })
  .strict();

export const eligibilityAnswersSchema = z.record(z.string().max(60), z.boolean()).optional();
