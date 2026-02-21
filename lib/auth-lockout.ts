/**
 * Authentication Lockout Management
 * 
 * Prevents brute force attacks by tracking failed login attempts
 * and temporarily locking out accounts after multiple failures.
 * 
 * Thresholds:
 * - 5 failed attempts: 3-second delay
 * - 10 failed attempts: 15-minute lockout
 */

import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : undefined;

// In-memory fallback for development without Redis
const memoryStore = new Map<string, { attempts: number; lockedUntil: number }>();

const LOCKOUT_THRESHOLD = 10; // Lock after 10 failed attempts
const DELAY_THRESHOLD = 5;    // Delay after 5 failed attempts
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const DELAY_DURATION_MS = 3000; // 3 seconds
const ATTEMPT_TTL_SECONDS = 900; // 15 minutes

/**
 * Check if an email is currently locked out
 * @returns true if locked, false otherwise
 */
export async function isLockedOut(email: string): Promise<boolean> {
  const key = `auth:failed:${email}`;
  
  if (redis) {
    try {
      const data = await redis.get<{ attempts: number; lockedUntil?: number }>(key);
      if (!data) return false;
      
      if (data.lockedUntil && Date.now() < data.lockedUntil) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[auth-lockout] Redis error checking lockout:', error);
      // Fallback to memory
    }
  }
  
  // In-memory fallback
  const record = memoryStore.get(key);
  if (!record) return false;
  
  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    return true;
  }
  
  return false;
}

/**
 * Record a failed login attempt
 * @returns { shouldDelay: boolean, shouldLock: boolean, attempts: number }
 */
export async function recordFailedAttempt(email: string): Promise<{
  shouldDelay: boolean;
  shouldLock: boolean;
  attempts: number;
}> {
  const key = `auth:failed:${email}`;
  
  if (redis) {
    try {
      // Increment attempts
      const attempts = await redis.incr(key);
      
      // Set TTL on first attempt
      if (attempts === 1) {
        await redis.expire(key, ATTEMPT_TTL_SECONDS);
      }
      
      // Check if we should lock
      if (attempts >= LOCKOUT_THRESHOLD) {
        await redis.set(key, {
          attempts,
          lockedUntil: Date.now() + LOCKOUT_DURATION_MS,
        }, { ex: ATTEMPT_TTL_SECONDS });
        
        return { shouldDelay: false, shouldLock: true, attempts };
      }
      
      // Check if we should delay
      if (attempts >= DELAY_THRESHOLD) {
        return { shouldDelay: true, shouldLock: false, attempts };
      }
      
      return { shouldDelay: false, shouldLock: false, attempts };
    } catch (error) {
      console.error('[auth-lockout] Redis error recording failure:', error);
      // Fallback to memory
    }
  }
  
  // In-memory fallback
  const record = memoryStore.get(key);
  const attempts = record ? record.attempts + 1 : 1;
  
  if (attempts >= LOCKOUT_THRESHOLD) {
    memoryStore.set(key, {
      attempts,
      lockedUntil: Date.now() + LOCKOUT_DURATION_MS,
    });
    
    // Clean up after TTL
    setTimeout(() => memoryStore.delete(key), ATTEMPT_TTL_SECONDS * 1000);
    
    return { shouldDelay: false, shouldLock: true, attempts };
  }
  
  memoryStore.set(key, {
    attempts,
    lockedUntil: 0,
  });
  
  // Clean up after TTL
  setTimeout(() => memoryStore.delete(key), ATTEMPT_TTL_SECONDS * 1000);
  
  if (attempts >= DELAY_THRESHOLD) {
    return { shouldDelay: true, shouldLock: false, attempts };
  }
  
  return { shouldDelay: false, shouldLock: false, attempts };
}

/**
 * Clear failed attempts for an email (call on successful login)
 */
export async function clearFailedAttempts(email: string): Promise<void> {
  const key = `auth:failed:${email}`;
  
  if (redis) {
    try {
      await redis.del(key);
    } catch (error) {
      console.error('[auth-lockout] Redis error clearing attempts:', error);
    }
  }
  
  // Also clear memory
  memoryStore.delete(key);
}

/**
 * Apply delay if needed (for rate limiting failed attempts)
 */
export async function applyDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, DELAY_DURATION_MS));
}
