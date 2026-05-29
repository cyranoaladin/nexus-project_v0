/**
 * Minimal Upstash REST-backed store for distributed rate limiting.
 *
 * Uses the REST pipeline endpoint so a deployment does not need a long-lived
 * Redis TCP connection. Secrets are read only from environment variables.
 */

export class UpstashStore {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(params: { url: string; token: string }) {
    this.baseUrl = params.url.replace(/\/$/, '');
    this.token = params.token;
  }

  async increment(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    resetAt: number;
  }> {
    const response = await fetch(`${this.baseUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['PEXPIRE', key, windowMs, 'NX'],
        ['PTTL', key],
      ]),
    });

    if (!response.ok) {
      throw new Error(`Upstash rate limit failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as Array<{ result?: unknown }>;
    const count = Number(payload[0]?.result ?? Number.NaN);
    const ttl = Number(payload[2]?.result ?? Number.NaN);

    if (!Number.isFinite(count)) {
      throw new Error('Upstash rate limit returned invalid counter');
    }

    const ttlMs = Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs;
    const remaining = Math.max(0, limit - count);

    return {
      success: count <= limit,
      limit,
      remaining,
      resetAt: Date.now() + ttlMs,
    };
  }
}
