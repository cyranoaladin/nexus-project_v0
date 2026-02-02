/**
 * Structured Logging Middleware (Pino Backend)
 *
 * Provides consistent logging format across API routes with contextual information.
 * Logs include request ID, timestamp, user info, performance metrics, etc.
 * 
 * Enhanced with Pino for high-performance structured logging.
 */

import { NextRequest } from 'next/server';
import { AuthSession } from '@/lib/guards';
import pino from 'pino';

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
 * Initialize Pino logger with environment-specific configuration
 */
const pinoLogger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => ({ level: label }),
  },
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

/**
 * Default logger instance for use outside request context
 * (e.g., in NextAuth callbacks, startup scripts)
 */
export const logger = pinoLogger;

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Logger class for structured logging (Pino-backed)
 */
export class Logger {
  private context: LogContext;
  private startTime: number;
  private logger: pino.Logger;

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
    
    this.logger = pinoLogger.child(this.context);
  }

  /**
   * Add custom context to logger
   */
  addContext(key: string, value: unknown): void {
    this.context[key] = value;
    this.logger = pinoLogger.child(this.context);
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug({ ...meta }, message);
  }

  /**
   * Log info message
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info({ ...meta }, message);
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn({ ...meta }, message);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const errorContext = {
      ...meta,
      ...(error instanceof Error && {
        error: error.message,
        stack: error.stack,
      }),
    };

    this.logger.error(errorContext, message);
  }

  /**
   * Log request completion with performance metrics
   */
  logRequest(statusCode: number, meta?: Record<string, unknown>): void {
    const duration = Date.now() - this.startTime;

    const logContext = {
      statusCode,
      duration,
      ...meta,
    };

    const message = `${this.context.method} ${this.context.path} ${statusCode} - ${duration}ms`;

    if (statusCode >= 500) {
      this.logger.error(logContext, message);
    } else if (statusCode >= 400) {
      this.logger.warn(logContext, message);
    } else {
      this.logger.info(logContext, message);
    }
  }

  /**
   * Log security event (401, 403, 429)
   * 
   * @param event - Type of security event (unauthorized_access, forbidden_access, rate_limit_exceeded)
   * @param statusCode - HTTP status code (401, 403, 429)
   * @param meta - Additional metadata (ip, retryAfter, etc.)
   */
  logSecurityEvent(event: string, statusCode: number, meta?: Record<string, unknown>): void {
    const duration = Date.now() - this.startTime;

    const logContext = {
      event,
      statusCode,
      duration,
      ...meta,
    };

    const message = `Security event: ${event}`;

    this.logger.warn(logContext, message);
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
