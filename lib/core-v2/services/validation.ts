import { z } from 'zod';
import { ValidationError } from '../errors';

export function parseInput<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError('Invalid input.', {
      issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  return result.data;
}

export const idSchema = z.string().trim().min(1).max(64);
export const personNameSchema = z.string().trim().min(1).max(100);
export const courseKeySchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'courseKey must be a kebab-case slug');
