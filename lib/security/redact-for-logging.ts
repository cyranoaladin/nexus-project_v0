/**
 * PII-safe redaction for logging.
 *
 * Recursively redacts sensitive keys (email, phone, token, password, etc.)
 * from objects before they are passed to the logger.
 *
 * Usage:
 *   logger.info(redactForLogging({ email: 'x@y.com', action: 'login' }));
 *   // → { email: '[REDACTED]', action: 'login' }
 *
 * Does NOT mutate the original object.
 * Handles circular references, arrays, Error objects, and depth limits.
 */

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;
const MAX_STRING_LENGTH = 1024;

/**
 * Sensitive key substrings (case-insensitive).
 * A key is redacted if its lowercase form contains any of these.
 */
const SENSITIVE_KEY_PATTERNS: readonly string[] = [
  'password',
  'token',
  'secret',
  'signature',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'creditcard',
  'ssn',
  'email',
  'phone',
  'telephone',
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

function redactValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (depth > MAX_DEPTH) return '[MAX_DEPTH]';

  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? value.slice(0, MAX_STRING_LENGTH) + '…[truncated]'
      : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {}),
    };
  }

  if (typeof value !== 'object') return String(value);

  if (seen.has(value as object)) return '[Circular]';
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1, seen));
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const v = (value as Record<string, unknown>)[key];
    if (isSensitiveKey(key)) {
      result[key] = REDACTED;
    } else {
      result[key] = redactValue(v, depth + 1, seen);
    }
  }
  return result;
}

/**
 * Redact sensitive fields from an object for safe logging.
 * Returns a new object; never mutates the input.
 */
export function redactForLogging(
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (data === null || data === undefined || typeof data !== 'object') {
    return {};
  }
  return redactValue(data, 0, new WeakSet()) as Record<string, unknown>;
}
