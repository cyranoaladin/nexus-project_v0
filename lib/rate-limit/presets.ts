/**
 * Rate limit preset configurations.
 *
 * Each preset defines a limit (max requests) and a window (in ms).
 * Routes pick a preset by name when calling checkRateLimit().
 */

export interface RateLimitPresetConfig {
  /** Maximum number of requests allowed in the window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export const PRESETS = {
  /** Authentication endpoints (login, password reset). 5 req / 15 min. */
  auth: { limit: 5, windowMs: 15 * 60 * 1000 },

  /** Resend activation email. 3 req / 15 min. */
  resendActivation: { limit: 3, windowMs: 15 * 60 * 1000 },

  /** Standard API endpoints. 60 req / 1 min. */
  api: { limit: 60, windowMs: 60 * 1000 },

  /** Expensive operations (session booking, LLM calls). 10 req / 1 hour. */
  expensive: { limit: 10, windowMs: 60 * 60 * 1000 },

  /** AI / LLM generation endpoints. 10 req / 1 hour. */
  ai: { limit: 10, windowMs: 60 * 60 * 1000 },

  /** Email notification endpoints. 5 req / 1 hour. */
  notifyEmail: { limit: 5, windowMs: 60 * 60 * 1000 },

  /** Public / high-traffic endpoints. 200 req / 1 min. */
  public: { limit: 200, windowMs: 60 * 1000 },
} as const satisfies Record<string, RateLimitPresetConfig>;

export type PresetName = keyof typeof PRESETS;
