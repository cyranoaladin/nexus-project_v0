import { z } from 'zod';

export const WorkflowInputSchema = z.object({
  name: z.string().min(1, 'Input name cannot be empty'),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object'], {
    errorMap: () => ({ message: 'Input type must be one of: string, number, boolean, array, object' }),
  }),
  required: z.boolean(),
  default: z.unknown().optional(),
  description: z.string().optional(),
});

export const WorkflowOutputSchema = z.object({
  name: z.string().min(1, 'Output name cannot be empty'),
  type: z.string().min(1, 'Output type cannot be empty'),
  description: z.string().optional(),
});

export const WorkflowStepSchema = z.object({
  id: z.string().min(1, 'Step ID cannot be empty'),
  name: z.string().min(1, 'Step name cannot be empty'),
  type: z.enum(['shell', 'javascript', 'workflow'], {
    errorMap: () => ({ message: 'Step type must be one of: shell, javascript, workflow' }),
  }),
  command: z.string().optional(),
  script: z.string().optional(),
  workflow: z.string().optional(),
  inputs: z.record(z.unknown()).optional(),
  outputs: z.record(z.string()).optional(),
  when: z.string().optional(),
  unless: z.string().optional(),
  timeout: z.number().int().positive('Timeout must be a positive integer').optional(),
  on_failure: z.enum(['abort', 'continue', 'skip_to_step', 'rollback_to_step'], {
    errorMap: () => ({ message: 'on_failure must be one of: abort, continue, skip_to_step, rollback_to_step' }),
  }).optional(),
  continue_on_error: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.type === 'shell' && !data.command) {
      return false;
    }
    if (data.type === 'javascript' && !data.script) {
      return false;
    }
    if (data.type === 'workflow' && !data.workflow) {
      return false;
    }
    return true;
  },
  {
    message: 'Step must have appropriate field: shell requires command, javascript requires script, workflow requires workflow name',
  }
);

export const ErrorHandlingSchema = z.object({
  strategy: z.enum(['abort', 'rollback', 'continue'], {
    errorMap: () => ({ message: 'Error handling strategy must be one of: abort, rollback, continue' }),
  }),
  cleanup_steps: z.array(WorkflowStepSchema).optional(),
});

export const NotificationActionSchema = z.object({
  type: z.enum(['log', 'email', 'webhook'], {
    errorMap: () => ({ message: 'Notification type must be one of: log, email, webhook' }),
  }),
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  message: z.string().optional(),
}).passthrough();

export const NotificationsSchema = z.object({
  on_success: z.array(NotificationActionSchema).optional(),
  on_failure: z.array(NotificationActionSchema).optional(),
});

export const WorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name cannot be empty'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning (e.g., 1.0.0)'),
  description: z.string().min(1, 'Description cannot be empty'),
  author: z.string().min(1, 'Author cannot be empty'),
  inputs: z.array(WorkflowInputSchema).default([]),
  outputs: z.array(WorkflowOutputSchema).default([]),
  steps: z.array(WorkflowStepSchema).min(1, 'At least one step is required'),
  error_handling: ErrorHandlingSchema,
  notifications: NotificationsSchema.optional(),
});


