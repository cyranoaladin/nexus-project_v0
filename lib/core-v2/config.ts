/**
 * Core v2 organization configuration — the CONFIG class of the hardcoding
 * audit. Nothing here has a built-in default: a missing or invalid value is
 * a startup/usage failure, never a silent fallback to some assumed locale.
 */
export class CoreV2ConfigError extends Error {}

export const ORGANIZATION_TIMEZONE_ENV = 'CORE_V2_ORGANIZATION_TIMEZONE';
export const INVITATION_TTL_ENV = 'CORE_V2_INVITATION_TTL_HOURS';

/** Invitation validity window in milliseconds; integer hours between 1 and 720 (30 days). */
export function getInvitationTtlMs(env: Record<string, string | undefined> = process.env): number {
  const raw = env[INVITATION_TTL_ENV]?.trim();
  const hours = raw ? Number(raw) : Number.NaN;
  if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
    throw new CoreV2ConfigError(`${INVITATION_TTL_ENV} must be an integer number of hours between 1 and 720.`);
  }
  return hours * 60 * 60 * 1000;
}

export function isValidIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The IANA zone every PlanningSeries local time is interpreted in. */
export function getOrganizationTimezone(env: Record<string, string | undefined> = process.env): string {
  const value = env[ORGANIZATION_TIMEZONE_ENV]?.trim();
  if (!value) {
    throw new CoreV2ConfigError(
      `${ORGANIZATION_TIMEZONE_ENV} is not set. Core v2 planning refuses to assume a timezone.`,
    );
  }
  if (!isValidIanaTimezone(value)) {
    throw new CoreV2ConfigError(`${ORGANIZATION_TIMEZONE_ENV}="${value}" is not a valid IANA timezone.`);
  }
  return value;
}
