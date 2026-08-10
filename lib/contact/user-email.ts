export function normalizeUserEmail(value: string): string {
  return value.trim().normalize('NFC').toLowerCase();
}

export function hasUserEmail(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function requireUserEmail(value: string | null | undefined): string {
  if (!hasUserEmail(value)) throw new Error('USER_EMAIL_REQUIRED');
  return normalizeUserEmail(value);
}
