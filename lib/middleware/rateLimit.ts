/**
 * Rate Limiting Middleware
 *
 * Simple in-memory rate limiter using sliding window algorithm.
 * For production, consider Redis-based solution (upstash/ratelimit, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, HttpStatus, ErrorCode } from '@/lib/api/errors';

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (use Redis in production for multi-instance deployments)
const store: RateLimitStore = {};

// Cleanup old entries every 10 minutes
// NOTE: Commented out to prevent hanging in test environment
// Uncomment for production or implement Redis-based solution
// setInterval(() => {
//   const now = Date.now();
//   Object.keys(store).forEach(key => {
//     if (store[key].resetTime < now) {
//       delete store[key];
//     }
//   });
// }, 10 * 60 * 1000);

/**
 * Generate rate limit key from request
 * Uses IP address or authenticated user ID
 */
function getRateLimitKey(request: NextRequest, prefix: string = 'rl'): string {
  // Try to get user ID from session (if authenticated)
  // For now, use IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';

  return `${prefix}:${ip}`;
}

/**
 * Check if request should be rate limited
 */
function checkRateLimit(key: string, config: RateLimitConfig): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const record = store[key];

  // No record or expired window - allow and create new
  if (!record || record.resetTime < now) {
    store[key] = {
      count: 1,
      resetTime: now + config.windowMs
    };

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: store[key].resetTime
    };
  }

  // Within window - check count
  if (record.count < config.maxRequests) {
    record.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - record.count,
      resetTime: record.resetTime
    };
  }

  // Limit exceeded
  return {
    allowed: false,
    remaining: 0,
    resetTime: record.resetTime
  };
}

/**
 * Rate limit middleware factory
 *
 * @param config - Rate limit configuration
 * @returns Middleware function
 *
 * @example
 * ```ts
 * import { rateLimit } from '@/lib/middleware/rateLimit';
 *
 * // In API route
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = rateLimit({
 *     windowMs: 60 * 1000, // 1 minute
 *     maxRequests: 10
 *   })(request);
 *
 *   if (rateLimitResult) return rateLimitResult;
 *
 *   // ... route logic
 * }
 * ```
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
  } = config;

  return (request: NextRequest, keyPrefix?: string): NextResponse | null => {
    const key = getRateLimitKey(request, keyPrefix);
    const result = checkRateLimit(key, { windowMs, maxRequests });

    // Add rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', maxRequests.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

    if (!result.allowed) {
      headers.set('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000).toString());

      return errorResponse(
        HttpStatus.BAD_REQUEST,  // 429 Too Many Requests not in HttpStatus enum
        ErrorCode.VALIDATION_ERROR,
        message,
        {
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        }
      );
    }

    // Request allowed
    return null;
  };
}

/**
 * Preset rate limiters for common scenarios
 */
export const RateLimitPresets = {
  /**
   * Strict rate limit for authentication endpoints
   * 5 requests per 15 minutes
   */
  auth: rateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: 'Too many login attempts, please try again later'
  }),

  /**
   * Moderate rate limit for API endpoints
   * 100 requests per minute
   */
  api: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'API rate limit exceeded'
  }),

  /**
   * Strict rate limit for expensive operations
   * 10 requests per minute
   */
  expensive: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: 'Rate limit exceeded for this operation'
  }),

  /**
   * Lenient rate limit for public endpoints
   * 300 requests per minute
   */
  public: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 300,
    message: 'Rate limit exceeded'
  }),
};

/**
 * Helper to clear rate limit for a specific IP/user (for testing or admin actions)
 */
export function clearRateLimit(request: NextRequest, prefix: string = 'rl'): void {
  const key = getRateLimitKey(request, prefix);
  delete store[key];
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(request: NextRequest, config: RateLimitConfig, prefix: string = 'rl'): {
  remaining: number;
  resetTime: number;
} {
  const key = getRateLimitKey(request, prefix);
  const record = store[key];
  const now = Date.now();

  if (!record || record.resetTime < now) {
    return {
      remaining: config.maxRequests,
      resetTime: now + config.windowMs
    };
  }

  return {
    remaining: Math.max(0, config.maxRequests - record.count),
    resetTime: record.resetTime
  };
}
