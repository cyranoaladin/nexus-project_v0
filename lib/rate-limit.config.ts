type RateConfig = { windowMs: number; max: number };

function readIntEnv(name: string): number | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function getRateLimitConfig(name: string, fallback: RateConfig): RateConfig {
  const key = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const defMax = readIntEnv('RATE_LIMIT_DEFAULT_MAX');
  const defWindow = readIntEnv('RATE_LIMIT_DEFAULT_WINDOW_MS');
  const max = readIntEnv(`RATE_LIMIT_${key}_MAX`) ?? defMax ?? fallback.max;
  const windowMs = readIntEnv(`RATE_LIMIT_${key}_WINDOW_MS`) ?? defWindow ?? fallback.windowMs;
  return { windowMs, max };
}
