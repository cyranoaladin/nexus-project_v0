import { z } from 'zod';

export const BranchPatternSchema = z.object({
  pattern: z.string().min(1, 'Branch pattern cannot be empty'),
});

export const TriggerSchema = z.object({
  type: z.enum(['commit', 'file_change', 'schedule', 'manual'], {
    errorMap: () => ({ message: 'Trigger type must be one of: commit, file_change, schedule, manual' }),
  }),
  branches: BranchPatternSchema.optional(),
  events: z.array(z.string()).optional(),
  schedule: z.string().optional(),
});

export const ConditionSchema = z.object({
  type: z.string().min(1, 'Condition type cannot be empty'),
}).passthrough();

export const ActionSchema = z.object({
  type: z.enum(['run_workflow', 'shell', 'log', 'notify'], {
    errorMap: () => ({ message: 'Action type must be one of: run_workflow, shell, log, notify' }),
  }),
}).passthrough();

export const GuardsSchema = z.object({
  max_retries: z.number().int().min(0).max(10, 'max_retries must be between 0 and 10'),
  timeout: z.number().int().min(0, 'timeout must be a positive integer'),
  on_error: z.enum(['abort', 'rollback', 'continue'], {
    errorMap: () => ({ message: 'on_error must be one of: abort, rollback, continue' }),
  }),
});

export const RuleSchema = z.object({
  name: z.string().min(1, 'Rule name cannot be empty'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning (e.g., 1.0.0)'),
  description: z.string().min(1, 'Description cannot be empty'),
  author: z.string().min(1, 'Author cannot be empty'),
  enabled: z.boolean(),
  triggers: z.array(TriggerSchema).min(1, 'At least one trigger is required'),
  conditions: z.array(ConditionSchema).default([]),
  actions: z.array(ActionSchema).min(1, 'At least one action is required'),
  guards: GuardsSchema,
  metadata: z.record(z.unknown()).optional(),
});

export type Rule = z.infer<typeof RuleSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type Condition = z.infer<typeof ConditionSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Guards = z.infer<typeof GuardsSchema>;
export type BranchPattern = z.infer<typeof BranchPatternSchema>;
