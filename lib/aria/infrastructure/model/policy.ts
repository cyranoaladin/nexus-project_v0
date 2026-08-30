import { z } from 'zod';
import modelPolicyDocument from '@/data/aria/model-policies.v1.json';
import { AriaError } from '../../kernel/errors';

export type AriaModelProvider = 'OPENAI_HOSTED' | 'OPENAI_COMPATIBLE_LOCAL';
export type AriaModelLatencyClass = 'FAST' | 'STANDARD' | 'BATCH';
export type AriaModelCostClass = 'LOW' | 'STANDARD' | 'PREMIUM';

export interface AriaModelCapabilities {
  readonly vision: boolean;
  readonly reasoning: boolean;
  readonly structuredOutput: boolean;
  readonly toolCalling: boolean;
  readonly contextTokens: number;
  readonly latencyClass: AriaModelLatencyClass;
  readonly costClass: AriaModelCostClass;
}

export interface AriaModelRequirements {
  readonly vision: boolean;
  readonly reasoning: boolean;
  readonly structuredOutput: boolean;
  readonly toolCalling: boolean;
  readonly minimumContextTokens: number;
  readonly maximumLatencyClass: AriaModelLatencyClass;
  readonly maximumCostClass: AriaModelCostClass;
}

export interface AriaConfiguredModel {
  readonly provider: AriaModelProvider;
  readonly model: string;
  readonly capabilityProfile: string;
  readonly capabilities: AriaModelCapabilities;
}

const latencySchema = z.enum(['FAST', 'STANDARD', 'BATCH']);
const costSchema = z.enum(['LOW', 'STANDARD', 'PREMIUM']);
const capabilitiesSchema = z.object({
  vision: z.boolean(),
  reasoning: z.boolean(),
  structuredOutput: z.boolean(),
  toolCalling: z.boolean(),
  contextTokens: z.number().int().positive(),
  latencyClass: latencySchema,
  costClass: costSchema,
}).strict();
const requirementsSchema = z.object({
  vision: z.boolean(),
  reasoning: z.boolean(),
  structuredOutput: z.boolean(),
  toolCalling: z.boolean(),
  minimumContextTokens: z.number().int().positive(),
  maximumLatencyClass: latencySchema,
  maximumCostClass: costSchema,
}).strict();
const documentSchema = z.object({
  schemaVersion: z.literal(1),
  policyVersion: z.string().min(1),
  defaultRequirements: requirementsSchema,
  capabilityProfiles: z.record(z.string().min(1), capabilitiesSchema),
}).strict();
const policyDocument = documentSchema.parse(modelPolicyDocument);

export const DEFAULT_ARIA_MODEL_REQUIREMENTS: AriaModelRequirements = Object.freeze({
  ...policyDocument.defaultRequirements,
});

export function getAriaModelCapabilities(profile: string): AriaModelCapabilities | null {
  const capabilities = policyDocument.capabilityProfiles[profile];
  return capabilities ? Object.freeze({ ...capabilities }) : null;
}

const latencyRank: Readonly<Record<AriaModelLatencyClass, number>> = {
  FAST: 0,
  STANDARD: 1,
  BATCH: 2,
};
const costRank: Readonly<Record<AriaModelCostClass, number>> = {
  LOW: 0,
  STANDARD: 1,
  PREMIUM: 2,
};

function satisfiesRequirements(
  candidate: AriaConfiguredModel,
  requirements: AriaModelRequirements,
): boolean {
  const capabilities = candidate.capabilities;
  return (!requirements.vision || capabilities.vision)
    && (!requirements.reasoning || capabilities.reasoning)
    && (!requirements.structuredOutput || capabilities.structuredOutput)
    && (!requirements.toolCalling || capabilities.toolCalling)
    && capabilities.contextTokens >= requirements.minimumContextTokens
    && latencyRank[capabilities.latencyClass] <= latencyRank[requirements.maximumLatencyClass]
    && costRank[capabilities.costClass] <= costRank[requirements.maximumCostClass];
}

export function resolveAriaModelPolicy(input: {
  readonly requirements: AriaModelRequirements;
  readonly candidates: readonly AriaConfiguredModel[];
  readonly fallbackAuthorized: boolean;
}): {
  readonly policyVersion: string;
  readonly primary: AriaConfiguredModel;
  readonly fallbacks: readonly AriaConfiguredModel[];
} {
  const primary = input.candidates[0];
  if (!primary || !satisfiesRequirements(primary, input.requirements)) {
    throw new AriaError(
      'MODEL_UNAVAILABLE',
      503,
      'Aucun modèle autorisé ne satisfait les capacités requises.',
      { reasonCode: 'MODEL_CAPABILITY_MISMATCH' },
    );
  }
  const fallbacks = input.fallbackAuthorized
    ? input.candidates.slice(1).filter((candidate) => satisfiesRequirements(candidate, input.requirements))
    : [];
  return Object.freeze({
    policyVersion: policyDocument.policyVersion,
    primary,
    fallbacks: Object.freeze(fallbacks),
  });
}
