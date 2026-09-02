import type { z } from 'zod';
import { AriaError } from '../errors';

export function requireInternalAriaResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AriaError('INTERNAL_ERROR', 500, 'Projection de réponse ARIA interne invalide.');
  }
  return parsed.data;
}
