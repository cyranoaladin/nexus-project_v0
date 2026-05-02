import { z } from 'zod';

export const premiumPedagogicalReportSchema = z.object({
  cover: z.object({
    title: z.string(),
    subtitle: z.string(),
    studentName: z.string(),
    stageLabel: z.string(),
    subjectLabel: z.string(),
  }),
  executiveSummary: z.object({
    profileSummary: z.string(),
    keyStrengths: z.array(z.string()),
    keyRisks: z.array(z.string()),
    priorityMessageForParents: z.string(),
    priorityMessageForStudent: z.string(),
  }),
  competenceReview: z.array(
    z.object({
      domain: z.string(),
      level: z.enum(['FRAGILE', 'EN_PROGRESSION', 'SATISFAISANT', 'SOLIDE']),
      score: z.number().optional(),
      evidence: z.array(z.string()),
      analysis: z.string(),
      recommendation: z.string(),
    })
  ),
  studentPosture: z.object({
    confidence: z.string(),
    autonomy: z.string(),
    workingMethod: z.string(),
    attentionPoints: z.array(z.string()),
  }),
  actionPlan: z.object({
    next7Days: z.array(z.string()),
    next30Days: z.array(z.string()),
    beforeExam: z.array(z.string()),
  }),
  parentSection: z.object({
    reassuringSummary: z.string(),
    concreteSupportAdvice: z.array(z.string()),
    warningWithoutAlarmism: z.string(),
  }),
  coachSection: z.object({
    syntheticReading: z.string(),
    nextSessionPriorities: z.array(z.string()),
  }),
  qualityFlags: z.object({
    missingData: z.array(z.string()),
    uncertainties: z.array(z.string()),
    shouldBeReviewedByCoach: z.boolean(),
  }),
});

export type PremiumPedagogicalReportJson = z.infer<typeof premiumPedagogicalReportSchema>;

export function validatePedagogicalReportJson(data: unknown): PremiumPedagogicalReportJson {
  return premiumPedagogicalReportSchema.parse(data);
}
