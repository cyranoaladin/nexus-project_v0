import pino from 'pino';
import pinoPretty from 'pino-pretty';

const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');
const disableWorker = process.env.PINO_NO_WORKER === '1';

const prettyStream = isDev && !disableWorker
  ? pinoPretty({
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    })
  : undefined;

const destination = disableWorker ? pino.destination({ sync: true }) : undefined;

export const logger = pino(
  {
    level: isTest ? 'silent' : logLevel,
    base: {
      env: process.env.NODE_ENV
    }
  },
  prettyStream ?? destination
);

export function createRequestLogger(context: {
  requestId: string;
  method: string;
  path: string;
  userId?: string;
}) {
  return logger.child(context);
}

/**
 * Sanitize log data by redacting sensitive fields (PII + credentials).
 * Delegates to the canonical redaction implementation.
 * @see lib/security/redact-for-logging.ts
 */
export { redactForLogging as sanitizeLogData } from '@/lib/security/redact-for-logging';
