/**
 * Canonical contact normalization for Core v2 identities. Email: trim / NFC /
 * lowercase (shared with the live app so a migrated account keeps the exact
 * stored form). Phone: the live app's normalizer, which deliberately keeps
 * the historical 8-digit Tunisian form — changing that would break every
 * existing household's stored phone at migration time.
 */
import { z } from 'zod';
import { normalizeUserEmail } from '@/lib/contact/user-email';
import { normalizeParentPhone } from '@/lib/contact/parent-phone';
import { ValidationError } from './errors';

const emailSchema = z.string().trim().min(3).max(320).email();

export function normalizeEmail(value: string): string {
  const normalized = normalizeUserEmail(value);
  const parsed = emailSchema.safeParse(normalized);
  if (!parsed.success) throw new ValidationError('Invalid email address.', { field: 'email' });
  return parsed.data;
}

export function normalizePhone(value: string): string {
  try {
    return normalizeParentPhone(value).normalized;
  } catch {
    throw new ValidationError('Invalid phone number.', { field: 'phone' });
  }
}
