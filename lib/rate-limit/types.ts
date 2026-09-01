export type RateLimitDecision = {
  success: boolean
  limit: number
  remaining: number
  resetAt: number
}

export interface DistributedRateLimitStore {
  increment(
    key: string,
    limit: number,
    windowMs: number,
  ): RateLimitDecision | Promise<RateLimitDecision>
  incrementOnce(
    key: string,
    idempotencyKey: string,
    limit: number,
    windowMs: number,
  ): RateLimitDecision | Promise<RateLimitDecision>
}
