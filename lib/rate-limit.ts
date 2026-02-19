/**
 * Rate Limiting Middleware
 * Protects API routes from abuse using Upstash Redis
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Initialize Redis client (fallback to in-memory for development)
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : undefined;

// SECURITY: Warn loudly if rate limiting is disabled in production
if (!redis && process.env.NODE_ENV === 'production') {
    console.error(
        '[SECURITY WARNING] Rate limiting is DISABLED — UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not set. ' +
        'All rate limits are bypassed. Set these environment variables to enable rate limiting.'
    );
}

// Create rate limiters for different endpoints
export const rateLimiters = {
    // Strict rate limit for authentication endpoints
    auth: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 requests per 15 minutes
            analytics: true,
            prefix: 'ratelimit:auth',
        })
        : null,

    // Moderate rate limit for AI/ARIA endpoints
    ai: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 requests per minute
            analytics: true,
            prefix: 'ratelimit:ai',
        })
        : null,

    // General API rate limit
    api: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
            analytics: true,
            prefix: 'ratelimit:api',
        })
        : null,

    // Strict rate limit for email notification endpoint (prevents spam/abuse)
    notifyEmail: redis
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 requests per minute per IP
            analytics: true,
            prefix: 'ratelimit:notify-email',
        })
        : null,
};

/**
 * Apply rate limiting to a request
 */
export async function applyRateLimit(
    request: NextRequest,
    limiter: Ratelimit | null,
    identifier?: string
): Promise<{ success: boolean; limit?: number; remaining?: number; reset?: number; reason?: string }> {
    if (!limiter) {
        // SECURITY: Fail-closed in production — never allow unprotected requests
        if (process.env.NODE_ENV === 'production') {
            logger.error('Rate limiting NOT configured in production — failing closed (503)');
            return { success: false, reason: 'RATELIMIT_NOT_CONFIGURED' };
        }
        // Dev/test: allow through with warning
        logger.warn('Rate limiting disabled - Redis not configured');
        return { success: true };
    }

    // Use IP address as identifier if not provided
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'anonymous';
    const id = identifier || ip;

    try {
        const { success, limit, remaining, reset } = await limiter.limit(id);

        if (!success) {
            logger.warn({
                type: 'rate-limit-exceeded',
                identifier: id,
                path: request.nextUrl.pathname,
                limit,
                reset,
            }, 'Rate limit exceeded');
        }

        return { success, limit, remaining, reset };
    } catch (error) {
        logger.error({
            type: 'rate-limit-error',
            error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Rate limiting error');

        // Fail open - allow request if rate limiting fails
        return { success: true };
    }
}

/**
 * Create rate limit response — normalized { ok, error } contract
 */
export function createRateLimitResponse(
    limit?: number,
    remaining?: number,
    reset?: number
): NextResponse {
    const response = NextResponse.json(
        {
            ok: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Trop de requêtes. Veuillez réessayer plus tard.',
            },
        },
        { status: 429 }
    );

    if (limit !== undefined) {
        response.headers.set('X-RateLimit-Limit', limit.toString());
    }
    if (remaining !== undefined) {
        response.headers.set('X-RateLimit-Remaining', remaining.toString());
    }
    if (reset !== undefined) {
        response.headers.set('X-RateLimit-Reset', reset.toString());
    }

    return response;
}

/**
 * Create 503 response when rate limiting is not configured in production
 */
function createRateLimitUnavailableResponse(): NextResponse {
    return NextResponse.json(
        {
            ok: false,
            error: {
                code: 'RATELIMIT_NOT_CONFIGURED',
                message: 'Service temporarily unavailable. Please try again later.',
            },
        },
        { status: 503 }
    );
}

/**
 * Middleware helper to check rate limits
 */
export async function checkRateLimit(
    request: NextRequest,
    type: 'auth' | 'ai' | 'api' | 'notifyEmail' = 'api'
): Promise<NextResponse | null> {
    const limiter = rateLimiters[type];
    const result = await applyRateLimit(request, limiter);

    if (!result.success) {
        // Distinguish between "not configured" (503) and "limit exceeded" (429)
        if (result.reason === 'RATELIMIT_NOT_CONFIGURED') {
            return createRateLimitUnavailableResponse();
        }
        return createRateLimitResponse(result.limit, result.remaining, result.reset);
    }

    return null;
}
