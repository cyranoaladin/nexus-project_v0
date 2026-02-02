/**
 * Structured Logging Middleware
 *
 * Provides consistent logging format across API routes with contextual information.
 * Logs include request ID, timestamp, user info, performance metrics, etc.
 */

import { NextRequest } from 'next/server';
import { AuthSession } from '@/lib/guards';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogContext {
  requestId: string;
  timestamp: string;
  method: string;
  path: string;
  userId?: string;
  userRole?: string;
  statusCode?: number;
  duration?: number;
  error?: string;
  [key: string]: unknown;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Format log message with context
 */
function formatLog(level: LogLevel, message: string, context: LogContext): string {
  const logEntry = {
    level,
    message,
    ...context,
  };

  return JSON.stringify(logEntry);
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private context: LogContext;
  private startTime: number;

  constructor(request: NextRequest, session?: AuthSession) {
    this.startTime = Date.now();
    this.context = {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.nextUrl.pathname,
      ...(session && {
        userId: session.user.id,
        userRole: session.user.role,
      }),
    };
  }

  /**
   * Add custom context to logger
   */
  addContext(key: string, value: unknown): void {
    this.context[key] = value;
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'production') return; // Skip debug logs in production

    console.log(formatLog(LogLevel.DEBUG, message, { ...this.context, ...meta }));
  }

  /**
   * Log info message
   */
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(formatLog(LogLevel.INFO, message, { ...this.context, ...meta }));
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(formatLog(LogLevel.WARN, message, { ...this.context, ...meta }));
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const errorContext = {
      ...this.context,
      ...meta,
      ...(error instanceof Error && {
        error: error.message,
        stack: error.stack,
      }),
    };

    console.error(formatLog(LogLevel.ERROR, message, errorContext));
  }

  /**
   * Log request completion with performance metrics
   */
  logRequest(statusCode: number, meta?: Record<string, unknown>): void {
    const duration = Date.now() - this.startTime;

    const logContext = {
      ...this.context,
      statusCode,
      duration,
      ...meta,
    };

    const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;

    const message = `${this.context.method} ${this.context.path} ${statusCode} - ${duration}ms`;

    if (level === LogLevel.ERROR) {
      console.error(formatLog(level, message, logContext));
    } else if (level === LogLevel.WARN) {
      console.warn(formatLog(level, message, logContext));
    } else {
      console.log(formatLog(level, message, logContext));
    }
  }

  /**
   * Get request ID for correlation
   */
  getRequestId(): string {
    return this.context.requestId;
  }

  /**
   * Get current duration
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Create logger instance for request
 *
 * @param request - NextRequest object
 * @param session - Optional authenticated session
 * @returns Logger instance
 *
 * @example
 * ```ts
 * import { createLogger } from '@/lib/middleware/logger';
 *
 * export async function GET(request: NextRequest) {
 *   const logger = createLogger(request);
 *
 *   logger.info('Fetching users');
 *
 *   try {
 *     const users = await prisma.user.findMany();
 *     logger.logRequest(200, { count: users.length });
 *     return successResponse({ users });
 *   } catch (error) {
 *     logger.error('Failed to fetch users', error);
 *     logger.logRequest(500);
 *     return handleApiError(error);
 *   }
 * }
 * ```
 */
export function createLogger(request: NextRequest, session?: AuthSession): Logger {
  return new Logger(request, session);
}

/**
 * Performance timing decorator
 *
 * @param label - Label for the operation
 * @param logger - Logger instance
 * @returns Decorator function
 *
 * @example
 * ```ts
 * const logger = createLogger(request);
 *
 * const users = await logger.time('db.users.findMany', async () => {
 *   return await prisma.user.findMany();
 * });
 * ```
 */
export async function timeOperation<T>(
  label: string,
  operation: () => Promise<T>,
  logger: Logger
): Promise<T> {
  const start = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - start;

    logger.debug(`${label} completed`, { duration });

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    logger.error(`${label} failed`, error, { duration });

    throw error;
  }
}

/**
 * Sanitize sensitive data from logs
 *
 * Removes passwords, tokens, secrets, etc. from log data
 */
export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'cookie', 'apiKey', 'api_key'];

  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();

    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    }

    // Recursively sanitize nested objects
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeLogData(sanitized[key] as Record<string, unknown>);
    }
  }

  return sanitized;
}

/**
 * Log request body (with sanitization)
 */
export function logRequestBody(logger: Logger, body: unknown): void {
  if (typeof body === 'object' && body !== null) {
    const sanitized = sanitizeLogData(body as Record<string, unknown>);
    logger.debug('Request body', { body: sanitized });
  }
}

/**
 * Preset loggers for common operations
 */
export const LogPresets = {
  /**
   * Log authentication attempt
   */
  authAttempt(logger: Logger, email: string, success: boolean): void {
    logger.info('Authentication attempt', {
      email,
      success,
      category: 'auth',
    });
  },

  /**
   * Log authorization check
   */
  authzCheck(logger: Logger, resource: string, allowed: boolean): void {
    logger.debug('Authorization check', {
      resource,
      allowed,
      category: 'authz',
    });
  },

  /**
   * Log database query
   */
  dbQuery(logger: Logger, operation: string, table: string, duration: number): void {
    logger.debug('Database query', {
      operation,
      table,
      duration,
      category: 'database',
    });
  },

  /**
   * Log external API call
   */
  externalApi(logger: Logger, service: string, endpoint: string, statusCode: number, duration: number): void {
    logger.info('External API call', {
      service,
      endpoint,
      statusCode,
      duration,
      category: 'external',
    });
  },
};
