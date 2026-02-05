import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

export const logger = pino({
  level: isTest ? 'silent' : logLevel,
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined,
  base: {
    env: process.env.NODE_ENV
  }
});

export function createRequestLogger(context: {
  requestId: string;
  method: string;
  path: string;
  userId?: string;
}) {
  return logger.child(context);
}

export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'apikey', 'secret', 'creditcard', 'ssn'];
  const sanitized = { ...data };
  
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}
