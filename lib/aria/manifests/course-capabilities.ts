import { z } from 'zod';
import document from '@/data/aria/course-capabilities.v1.json';
import {
  ARIA_PEDAGOGICAL_MODES,
  type AriaPedagogicalMode,
} from '../domain/pedagogy/pedagogical-mode';

const corpusBindingSchema = z.object({
  agentRole: z.literal('TUTOR'),
  pedagogicalModes: z.array(z.enum(ARIA_PEDAGOGICAL_MODES)).min(1)
    .refine((modes) => new Set(modes).size === modes.length, 'duplicate pedagogical mode'),
  corpusId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_.:-]+$/),
}).strict();

const courseCapabilityDeclarationSchema = z.object({
  skillGraphRef: z.string().min(1).nullable(),
  hasAssessmentContext: z.boolean(),
  chat: z.object({
    policy: z.enum(['GENERAL_CHAT', 'OPTIONAL_GROUNDING', 'GROUNDED_REQUIRED']),
    corpusBindings: z.array(corpusBindingSchema).min(1),
  }).strict().nullable(),
}).strict();

const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  manifestVersion: z.string().min(1).max(100),
  courses: z.record(z.string().min(1), courseCapabilityDeclarationSchema),
}).strict();

const manifest = manifestSchema.parse(document);
for (const [courseKey, declaration] of Object.entries(manifest.courses)) {
  const tuples = new Set<string>();
  for (const binding of declaration.chat?.corpusBindings ?? []) {
    for (const mode of binding.pedagogicalModes) {
      const tuple = `${binding.agentRole}:${mode}`;
      if (tuples.has(tuple)) throw new Error(`ARIA_DUPLICATE_CORPUS_BINDING:${courseKey}:${tuple}`);
      tuples.add(tuple);
    }
  }
}

export type AriaCourseCapabilityDeclaration = z.infer<typeof courseCapabilityDeclarationSchema>;

export function getAriaCourseCapabilityDeclaration(
  courseKey: string,
): AriaCourseCapabilityDeclaration | null {
  return manifest.courses[courseKey] ?? null;
}

export function resolveAriaCourseCorpusId(input: {
  readonly courseKey: string;
  readonly mode: AriaPedagogicalMode;
  readonly agentRole: string;
}): string | null {
  const declaration = manifest.courses[input.courseKey];
  const binding = declaration?.chat?.corpusBindings.find((candidate) =>
    candidate.agentRole === input.agentRole
    && candidate.pedagogicalModes.includes(input.mode));
  return binding?.corpusId ?? null;
}

export function getRequiredAriaCorpusIds(): ReadonlySet<string> {
  const corpusIds = new Set<string>();
  for (const declaration of Object.values(manifest.courses)) {
    for (const binding of declaration.chat?.corpusBindings ?? []) {
      corpusIds.add(binding.corpusId);
    }
  }
  return corpusIds;
}

export const ARIA_COURSE_CAPABILITY_MANIFEST_VERSION = manifest.manifestVersion;
