import { z } from 'zod';
import document from '@/data/aria/course-capabilities.v1.json';

const courseCapabilityDeclarationSchema = z.object({
  skillGraphRef: z.string().min(1).nullable(),
  hasAssessmentContext: z.boolean(),
  chat: z.object({
    policy: z.enum(['GENERAL_CHAT', 'OPTIONAL_GROUNDING', 'GROUNDED_REQUIRED']),
    corpusId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_.:-]+$/),
  }).strict().nullable(),
}).strict();

const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  manifestVersion: z.string().min(1).max(100),
  courses: z.record(z.string().min(1), courseCapabilityDeclarationSchema),
}).strict();

const manifest = manifestSchema.parse(document);

export type AriaCourseCapabilityDeclaration = z.infer<typeof courseCapabilityDeclarationSchema>;

export function getAriaCourseCapabilityDeclaration(
  courseKey: string,
): AriaCourseCapabilityDeclaration | null {
  return manifest.courses[courseKey] ?? null;
}

export const ARIA_COURSE_CAPABILITY_MANIFEST_VERSION = manifest.manifestVersion;
