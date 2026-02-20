/**
 * Rate Limiting Middleware
 * Protects API routes from abuse using Upstash Redis (with In-Memory Fallback)
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

console.log("DEBUG: RATE LIMIT LOADED - MEMORY FALLBACK ENABLED");

// Initialize Redis client
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : undefined;

// In-Memory Fallback Store
const memoryStore = new Map<string, { count: number; reset: number }>();

function inMemoryRateLimit(identifier: string, limit: number, windowSeconds: number) {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const record = memoryStore.get(identifier);

    if (!record || now > record.reset) {
        memoryStore.set(identifier, { count: 1, reset: now + windowMs });
        return { success: true, limit, remaining: limit - 1, reset: now + windowMs };
    }

    if (record.count >= limit) {
        return { success: false, limit, remaining: 0, reset: record.reset };
    }

    record.count++;
    return { success: true, limit, remaining: limit - record.count, reset: record.reset };
}

// Configuration for limits
const LIMITS = {
    auth: { limit: 5, window: 15 * 60 }, // 5 req / 15 min
    ai: { limit: 20, window: 60 },       // 20 req / 1 min
    api: { limit: 100, window: 60 },     // 100 req / 1 min
    notifyEmail: { limit: 5, window: 60 } // 5 req / 1 min
};

// Create rate limiters for different endpoints (Redis based)
export const rateLimiters = {
    auth: redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(LIMITS.auth.limit, `${LIMITS.auth.window} s`), analytics: true, prefix: 'ratelimit:auth' }) : null,
    ai: redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(LIMITS.ai.limit, `${LIMITS.ai.window} s`), analytics: true, prefix: 'ratelimit:ai' }) : null,
    api: redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(LIMITS.api.limit, `${LIMITS.api.window} s`), analytics: true, prefix: 'ratelimit:api' }) : null,
    notifyEmail: redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(LIMITS.notifyEmail.limit, `${LIMITS.notifyEmail.window} s`), analytics: true, prefix: 'ratelimit:notify-email' }) : null,
};

/**
 * Apply rate limiting to a request
 */
export async function applyRateLimit(
    request: NextRequest,
    limiter: Ratelimit | null,
    identifier?: string,
    type: keyof typeof LIMITS = 'api'
): Promise<{ success: boolean; limit?: number; remaining?: number; reset?: number; reason?: string }> {
    
    // Use IP address as identifier if not provided
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'anonymous';
    const id = identifier || ip;

    // Redis path
    if (limiter) {
        try {
            const { success, limit, remaining, reset } = await limiter.limit(id);
            if (!success) {
                logger.warn({ type: 'rate-limit-exceeded', identifier: id, path: request.nextUrl.pathname }, 'Rate limit exceeded (Redis)');
            }
            return { success, limit, remaining, reset };
        } catch (error) {
            logger.error({ error }, 'Redis Rate limiting error - falling back to memory');
            // Fallback to memory on Redis error
        }
    }

    // In-Memory Fallback Path
    if (!redis) {
        logger.warn('Rate limiting running in In-Memory Fallback mode (No Redis)');
    }
    
    const config = LIMITS[type] || LIMITS.api;
    const memResult = inMemoryRateLimit(`${type}:${id}`, config.limit, config.window);
    
    if (!memResult.success) {
        logger.warn({ type: 'rate-limit-exceeded-mem', identifier: id, path: request.nextUrl.pathname }, 'Rate limit exceeded (Memory)');
    }
    
    return memResult;
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

    if (limit !== undefined) response.headers.set('X-RateLimit-Limit', limit.toString());
    if (remaining !== undefined) response.headers.set('X-RateLimit-Remaining', remaining.toString());
    if (reset !== undefined) response.headers.set('X-RateLimit-Reset', reset.toString());

    return response;
}

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
    // Pass type to applyRateLimit for fallback config lookup
    const result = await applyRateLimit(request, limiter, undefined, type);

    if (!result.success) {
        return createRateLimitResponse(result.limit, result.remaining, result.reset);
    }

    return null;
}
