import {
  getRateLimitProductionGate,
  isDistributedRateLimitMode,
  type RateLimitRuntimeMode,
} from '@/lib/rate-limit';

describe('rate limit production gate', () => {
  it.each<RateLimitRuntimeMode>(['redis', 'upstash'])(
    'allows go-live large only for distributed mode %s',
    (mode) => {
      expect(isDistributedRateLimitMode(mode)).toBe(true);
      expect(getRateLimitProductionGate(mode)).toEqual({
        ok: true,
        mode,
        decision: 'allowed',
        reason: 'Distributed rate limiting runtime is configured.',
      });
    },
  );

  it('blocks go-live large for memory mode', () => {
    expect(isDistributedRateLimitMode('memory')).toBe(false);
    expect(getRateLimitProductionGate('memory')).toEqual({
      ok: false,
      mode: 'memory',
      decision: 'blocked',
      reason: 'Memory rate limiting is process-local and blocks go-live large.',
    });
  });
});
