import type { Logger, LogFn, LoggerOptions, Bindings, ChildLoggerOptions } from 'pino';
import { serializeError, isSafeLogErrorName, isSafeLogErrorCode } from '@/lib/utils/serialize-error';
import eventCodeRegistry from '@/lib/security/log-event-codes.json';

/** Versioned allowlist of machine event codes; exact membership only, closed grammar, bounded length. */
const eventCodeGrammar = new RegExp(eventCodeRegistry.grammar);
const registeredEventCodes: ReadonlySet<string> = new Set(eventCodeRegistry.eventCodes.filter(
  code => code.length <= eventCodeRegistry.maxLength && eventCodeGrammar.test(code)));

const numericMetrics = new Set(['statusCode', 'duration', 'durationMs', 'elapsedMs', 'count', 'total', 'page', 'limit', 'offset', 'retryAfter', 'attempt', 'latencyMs', 'tokens', 'inputTokens', 'outputTokens', 'totalTokens', 'tokenCount', 'cost', 'costUsd', 'queueSize', 'bytes', 'size', 'records', 'successCount', 'failureCount', 'affectedRows', 'deletedCount', 'remainingCount', 'pid']);
const booleanFlags = new Set(['success', 'allowed', 'retryable', 'duplicate', 'verified', 'enabled', 'active', 'created', 'completed', 'cancelled', 'degraded', 'runtimeVerified']);
const labels = new Set(['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE', 'PENDING', 'RUNNING', 'COMPLETED', 'CANCELLED', 'ERROR', 'FAILED', 'AUTHORIZED', 'REVOKED', 'VERIFIED', 'INVITED', 'ACTIVE', 'INACTIVE', 'SCHEDULED', 'DRAFT', 'PUBLISHED', 'ARCHIVED', 'PAID', 'REFUNDED', 'DISPUTED', 'production', 'development', 'test', 'auth', 'authz', 'payment', 'database', 'planning', 'document', 'aria', 'notification', 'storage', 'security', 'rate_limit_exceeded', 'unauthorized_access', 'forbidden_access']);
const labelFields = new Set(['role', 'userRole', 'env', 'status', 'state', 'category', 'event', 'operation', 'action', 'phase', 'reason', 'feature']);
const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const routeSegments = new Set(['api', 'v2', 'admin', 'users', 'aria', 'parent', 'children', 'student', 'sessions', 'book', 'cancel', 'next-best-action', 'resources', 'versions', 'content', 'conversations', 'messages', 'mastery', 'course', 'profile', 'practice', 'attempts', 'submit', 'correct', 'bilans', 'periodic', 'feedback', 'curriculum', 'chat', 'workshops', 'register', 'attendees', 'attendance', 'assistante', 'recent-activity', 'turns', 'internal', 'health', 'staff', 'auth', 'signup', 'activate', 'reset-password', 'signin']);
const privateField = /password|token|secret|authorization|cookie|email|phone|telephone|firstname|lastname|fullname|address|(^|_)ip($|_)|dsn|body|payload|stack|cause|headers|query|sql|api.?key/i;

/** Routing vocabulary only: this never authorizes a route or exposes resource parameters. */
export function logRouteTemplate(path: string): string {
  if (!path.startsWith('/') || path.length > 2048) return '/[unclassified]';
  return path.split('/').slice(0, 20).map(segment => segment === '' || routeSegments.has(segment) ? segment : '[parameter]').join('/');
}

/** Bounded, descriptor-only projection. Unknown free-text metadata is denied by default. */
export function projectLogRecord(input: unknown): Record<string, unknown> {
  const seen = new WeakSet<object>();
  function project(value: unknown, key: string, depth: number): unknown {
    if (value instanceof Error) return serializeError(value);
    if (typeof value === 'number') return numericMetrics.has(key) && Number.isFinite(value) && value >= 0 ? value : undefined;
    if (typeof value === 'boolean') return booleanFlags.has(key) ? value : undefined;
    if (typeof value === 'string') {
      if (key === 'name' && isSafeLogErrorName(value)) return value;
      if (key === 'code' && isSafeLogErrorCode(value)) return value;
      if (key === 'message' && value === 'Operation failed') return value;
      if (key === 'method' && methods.has(value)) return value;
      if (key === 'path' || key === 'route') return logRouteTemplate(value);
      if (/Ids?$/.test(key) && /^[A-Za-z0-9_-]{1,128}$/.test(value)) return value;
      if (key === 'courseKey' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value)) return value;
      if (key === 'event' && registeredEventCodes.has(value)) return value;
      // Same closed vocabularies as serialize-error, plus the explicit non-Error marker of core-v2 routes.
      if (key === 'errorKind' && (isSafeLogErrorName(value) || value === 'NonErrorThrown')) return value;
      if (key === 'errorCode' && isSafeLogErrorCode(value)) return value;
      if (labelFields.has(key) && labels.has(value)) return value;
      if (key === 'err' || key === 'error' || key === 'exception') return serializeError(value);
      return undefined;
    }
    if (value === null || typeof value !== 'object' || depth > 6 || seen.has(value)) return undefined;
    seen.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Array.isArray(value)) {
      return Object.keys(descriptors).filter(index => /^\d+$/.test(index)).slice(0, 50)
        .map(index => 'value' in descriptors[index] ? project(descriptors[index].value, key, depth + 1) : undefined)
        .filter(item => item !== undefined);
    }
    const result: Record<string, unknown> = {};
    for (const field of Object.keys(descriptors).slice(0, 64)) {
      const descriptor = descriptors[field];
      if (!('value' in descriptor) || ['__proto__', 'prototype', 'constructor', 'hasOwnProperty', 'toJSON', 'toString', 'valueOf', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__'].includes(field)) continue;
      const metric = numericMetrics.has(field) && typeof descriptor.value === 'number';
      if (privateField.test(field) && !metric) continue;
      const projected = project(descriptor.value, field, depth + 1);
      if (projected !== undefined) result[field] = projected;
    }
    return result;
  }
  try {
    const result = project(input, '', 0);
    return result && typeof result === 'object' && !Array.isArray(result) ? result as Record<string, unknown> : {};
  } catch {
    // Logging hostile proxies must neither throw nor disclose input.
    return { errorSummary: serializeError(undefined) };
  }
}

export const pinoPrivacyOptions: Pick<LoggerOptions, 'hooks'> = {
  hooks: {
    logMethod(this: Logger, args: Parameters<LogFn>, method: LogFn) {
      const values: unknown[] = [...args];
      const first = values[0];
      if (first !== null && typeof first === 'object') {
        try {
          values[0] = first instanceof Error ? { err: serializeError(first) } : projectLogRecord(first);
        } catch {
          values[0] = { errorSummary: serializeError(undefined) };
        }
        if (values[1] === undefined) values[1] = 'Application event';
        // Pino formats arguments after the event label outside object serialization.
        values.splice(2);
      }
      // Event labels are caller-defined; interpolation parameters cannot bypass projection.
      if (typeof first === 'string' && values.length > 1) {
        values.splice(0, values.length, { parameters: values.slice(1).map(value => projectLogRecord(value)) }, first);
      }
      Reflect.apply(method, this, values);
    },
  },
};

const protectedInstances = new WeakSet<Logger>();
const originalChildMethods = new WeakMap<object, Logger['child']>();

/** Pino intentionally resets the bindings formatter for children; project before child creation. */
export function protectPinoChildren(logger: Logger): Logger {
  if (protectedInstances.has(logger)) return logger;
  const original = originalChildMethods.get(logger.child) ?? logger.child;
  function child(this: Logger, bindings: Bindings, options?: ChildLoggerOptions<never>): Logger {
    const instance = (original<never>).call(this, projectLogRecord(bindings), options);
    return protectPinoChildren(instance);
  }
  originalChildMethods.set(child, original);
  Object.defineProperty(logger, 'child', { value: child, writable: true, configurable: true });
  protectedInstances.add(logger);
  return logger;
}
