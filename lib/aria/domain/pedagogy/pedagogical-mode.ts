import { z } from 'zod';
import policyDocument from '@/data/aria/pedagogical-policies.v1.json';
import { getCourse } from '@/lib/curriculum/catalog';
import { AriaError } from '../../kernel/errors';

export const ARIA_PEDAGOGICAL_MODES = [
  'DISCOVERY',
  'GUIDED_PRACTICE',
  'INDEPENDENT_PRACTICE',
  'CHECK_MY_WORK',
  'CORRECTION',
  'WORKED_EXAMPLE',
  'EXAM_SIMULATION',
  'REVISION',
  'METHODOLOGY',
] as const;

export type AriaPedagogicalMode = (typeof ARIA_PEDAGOGICAL_MODES)[number];
export type AriaAgentRole = 'TUTOR';

const modePolicySchema = z.object({
  active: z.boolean(),
  answerDisclosure: z.string().min(1),
  instructions: z.array(z.string().min(1)).min(1),
}).strict();

const policyDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  policyVersion: z.string().min(1),
  defaultMode: z.enum(ARIA_PEDAGOGICAL_MODES),
  activeAgentRoles: z.array(z.literal('TUTOR')).min(1),
  modes: z.record(z.enum(ARIA_PEDAGOGICAL_MODES), modePolicySchema),
}).strict();

const parsedPolicyDocument = policyDocumentSchema.parse(policyDocument);
for (const mode of ARIA_PEDAGOGICAL_MODES) {
  if (!parsedPolicyDocument.modes[mode]) {
    throw new Error(`ARIA_PEDAGOGICAL_POLICY_MISSING:${mode}`);
  }
}

export interface ResolveAriaPedagogicalPolicyInput {
  readonly courseKey: string;
  readonly agentRole: string;
  readonly mode?: AriaPedagogicalMode;
}

export interface ResolvedAriaPedagogicalPolicy {
  readonly policyVersion: string;
  readonly mode: AriaPedagogicalMode;
  readonly agentRole: AriaAgentRole;
  readonly answerDisclosure: string;
  readonly instructions: readonly string[];
  readonly subjectContext: string;
}

export function resolveAriaPedagogicalPolicy(
  input: ResolveAriaPedagogicalPolicyInput,
): ResolvedAriaPedagogicalPolicy {
  const course = getCourse(input.courseKey);
  if (!course) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }
  if (!parsedPolicyDocument.activeAgentRoles.includes(input.agentRole as AriaAgentRole)) {
    throw new AriaError('UNSUPPORTED', 422, 'Ce rôle ARIA n’est pas disponible pour cette tâche.');
  }
  const mode = input.mode ?? parsedPolicyDocument.defaultMode;
  const policy = parsedPolicyDocument.modes[mode];
  if (!policy || !policy.active) {
    throw new AriaError('UNSUPPORTED', 422, 'Ce mode pédagogique ARIA n’est pas encore disponible.');
  }
  return Object.freeze({
    policyVersion: parsedPolicyDocument.policyVersion,
    mode,
    agentRole: 'TUTOR' as const,
    answerDisclosure: policy.answerDisclosure,
    instructions: Object.freeze([...policy.instructions]),
    subjectContext: `${course.label} — ${course.gradeLevel} — ${course.longLabel}`,
  });
}
