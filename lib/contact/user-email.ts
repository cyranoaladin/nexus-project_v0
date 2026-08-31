import { z } from 'zod';

const normalizedUserEmailSchema = z.string().email().max(320);

export function normalizeUserEmail(value: string): string {
  return value.trim().normalize('NFC').toLowerCase();
}

export function normalizeNullableUserEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const normalized = normalizeUserEmail(value);
  return normalizedUserEmailSchema.safeParse(normalized).success ? normalized : null;
}

export function hasUserEmail(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function requireUserEmail(value: string | null | undefined): string {
  if (!hasUserEmail(value)) throw new Error('USER_EMAIL_REQUIRED');
  return normalizeUserEmail(value);
}
