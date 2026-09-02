import { z } from 'zod';
import { AriaError } from '../errors';

const cursorSchema = z.object({
  version: z.literal(1),
  kind: z.enum(['CONVERSATIONS', 'MESSAGES']),
  timestamp: z.string().datetime(),
  id: z.string().min(1),
}).strict();

export interface AriaPageCursor {
  readonly timestamp: Date;
  readonly id: string;
}

export function encodeAriaPageCursor(
  kind: 'CONVERSATIONS' | 'MESSAGES',
  value: AriaPageCursor,
): string {
  return Buffer.from(JSON.stringify({
    version: 1,
    kind,
    timestamp: value.timestamp.toISOString(),
    id: value.id,
  }), 'utf8').toString('base64url');
}

export function decodeAriaPageCursor(
  kind: 'CONVERSATIONS' | 'MESSAGES',
  cursor: string | undefined,
): AriaPageCursor | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    if (parsed.kind !== kind) throw new Error('ARIA_CURSOR_KIND_MISMATCH');
    return { timestamp: new Date(parsed.timestamp), id: parsed.id };
  } catch {
    throw new AriaError('BAD_REQUEST', 400, 'Curseur de pagination ARIA invalide.');
  }
}
