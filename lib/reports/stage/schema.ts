import { z } from 'zod';

const nonEmptyText = z.string().trim().min(1).max(4000);
const nonEmptyTextArray = z.array(nonEmptyText).max(12);

export const premiumPedagogicalReportSchema = z.object({
  cover: z.object({
    title: nonEmptyText,
    subtitle: nonEmptyText,
    studentName: nonEmptyText,
    stageLabel: nonEmptyText,
    subjectLabel: nonEmptyText,
  }),
  executiveSummary: z.object({
    profileSummary: nonEmptyText,
    keyStrengths: nonEmptyTextArray,
    keyRisks: nonEmptyTextArray,
    priorityMessageForParents: nonEmptyText,
    priorityMessageForStudent: nonEmptyText,
  }),
  competenceReview: z.array(
    z.object({
      domain: nonEmptyText,
      level: z.enum(['FRAGILE', 'EN_PROGRESSION', 'SATISFAISANT', 'SOLIDE']),
      score: z.number().min(0).max(100).optional(),
      evidence: nonEmptyTextArray,
      analysis: nonEmptyText,
      recommendation: nonEmptyText,
    })
  ).min(1).max(12),
  studentPosture: z.object({
    confidence: nonEmptyText,
    autonomy: nonEmptyText,
    workingMethod: nonEmptyText,
    attentionPoints: nonEmptyTextArray,
  }),
  actionPlan: z.object({
    next7Days: nonEmptyTextArray,
    next30Days: nonEmptyTextArray,
    beforeExam: nonEmptyTextArray,
  }),
  parentSection: z.object({
    reassuringSummary: nonEmptyText,
    concreteSupportAdvice: nonEmptyTextArray,
    warningWithoutAlarmism: nonEmptyText,
  }),
  coachSection: z.object({
    syntheticReading: nonEmptyText,
    nextSessionPriorities: nonEmptyTextArray,
  }),
  qualityFlags: z.object({
    missingData: z.array(z.string().trim().max(500)).max(30),
    uncertainties: z.array(z.string().trim().max(500)).max(30),
    shouldBeReviewedByCoach: z.boolean(),
  }),
});

export type PremiumPedagogicalReportJson = z.infer<typeof premiumPedagogicalReportSchema>;

export function validatePedagogicalReportJson(data: unknown): PremiumPedagogicalReportJson {
  return premiumPedagogicalReportSchema.parse(data);
}

export const premiumPedagogicalReportSchemaDescription = `
Retourne uniquement un objet JSON valide avec exactement cette structure:
{
  "cover": { "title": string, "subtitle": string, "studentName": string, "stageLabel": string, "subjectLabel": string },
  "executiveSummary": {
    "profileSummary": string,
    "keyStrengths": string[],
    "keyRisks": string[],
    "priorityMessageForParents": string,
    "priorityMessageForStudent": string
  },
  "competenceReview": [
    {
      "domain": string,
      "level": "FRAGILE" | "EN_PROGRESSION" | "SATISFAISANT" | "SOLIDE",
      "score": number optionnel entre 0 et 100 seulement si un score existe explicitement dans le contexte,
      "evidence": string[],
      "analysis": string,
      "recommendation": string
    }
  ],
  "studentPosture": { "confidence": string, "autonomy": string, "workingMethod": string, "attentionPoints": string[] },
  "actionPlan": { "next7Days": string[], "next30Days": string[], "beforeExam": string[] },
  "parentSection": { "reassuringSummary": string, "concreteSupportAdvice": string[], "warningWithoutAlarmism": string },
  "coachSection": { "syntheticReading": string, "nextSessionPriorities": string[] },
  "qualityFlags": { "missingData": string[], "uncertainties": string[], "shouldBeReviewedByCoach": boolean }
}
`;
