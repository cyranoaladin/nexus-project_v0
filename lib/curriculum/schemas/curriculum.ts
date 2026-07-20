import { z } from 'zod';

const ACADEMIC_YEAR_PATTERN = /^(\d{4})-(\d{4})$/;

export const academicYearSchema = z.string().regex(ACADEMIC_YEAR_PATTERN).refine((value) => {
  const match = ACADEMIC_YEAR_PATTERN.exec(value);
  return match !== null && Number(match[2]) === Number(match[1]) + 1;
}, 'Academic year must contain two consecutive years');

export const curriculumSubjectSchema = z.enum([
  'MATHEMATICS',
  'PHYSICS_CHEMISTRY',
  'FRENCH',
  'NSI',
  'SNT',
]);

export const curriculumLevelSchema = z.enum([
  'TROISIEME',
  'SECONDE',
  'PREMIERE',
  'TERMINALE',
]);

export const curriculumTrackSchema = z.enum([
  'COLLEGE',
  'GENERAL_TECHNOLOGICAL',
  'GENERAL',
  'TECHNOLOGICAL',
]);

export const curriculumSubjectVariantSchema = z.enum([
  'COMMON',
  'SPECIALITY',
  'INTEGRATED_SCIENCE',
  'COMPLEMENTARY',
  'EXPERT_OVERLAY',
  'SNT_READINESS',
  'TRANSVERSAL_EXPRESSION',
]);

export const officialCurriculumSourceSchema = z.object({
  id: z.string().min(1),
  authority: z.enum(['MEN', 'EDUSCOL', 'LEGIFRANCE']),
  title: z.string().min(1),
  uri: z.string().url(),
  publicationDate: z.string().date(),
  bulletinReference: z.string().min(1).optional(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

export const curriculumVersionSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  version: z.string().min(1),
  status: z.enum(['DRAFT', 'REVIEWED', 'PUBLISHED', 'ARCHIVED']),
  subject: curriculumSubjectSchema,
  level: curriculumLevelSchema,
  track: curriculumTrackSchema,
  subjectVariant: curriculumSubjectVariantSchema,
  effectiveFromAcademicYear: academicYearSchema,
  effectiveToAcademicYear: academicYearSchema.optional(),
  examSessionFrom: z.number().int().min(2000).max(2200).optional(),
  examSessionTo: z.number().int().min(2000).max(2200).optional(),
  officialSources: z.array(officialCurriculumSourceSchema),
}).superRefine((curriculum, context) => {
  if (curriculum.status === 'PUBLISHED' && curriculum.officialSources.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['officialSources'],
      message: 'Published curriculum versions require at least one official source',
    });
  }

  if (
    curriculum.effectiveToAcademicYear !== undefined
    && curriculum.effectiveToAcademicYear < curriculum.effectiveFromAcademicYear
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['effectiveToAcademicYear'],
      message: 'Effective end academic year cannot precede the start academic year',
    });
  }

  if (
    curriculum.examSessionFrom !== undefined
    && curriculum.examSessionTo !== undefined
    && curriculum.examSessionTo < curriculum.examSessionFrom
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['examSessionTo'],
      message: 'Exam session end cannot precede the start',
    });
  }
});

export type AcademicYear = z.infer<typeof academicYearSchema>;
export type CurriculumSubject = z.infer<typeof curriculumSubjectSchema>;
export type CurriculumLevel = z.infer<typeof curriculumLevelSchema>;
export type CurriculumTrack = z.infer<typeof curriculumTrackSchema>;
export type CurriculumSubjectVariant = z.infer<typeof curriculumSubjectVariantSchema>;
export type OfficialCurriculumSource = z.infer<typeof officialCurriculumSourceSchema>;
export type CurriculumVersion = z.infer<typeof curriculumVersionSchema>;
