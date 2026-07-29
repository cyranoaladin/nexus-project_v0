export const DEFAULT_DISTRIBUTED_RATE_LIMIT_TIMEOUT_MS = 1_500;
export const MIN_DISTRIBUTED_RATE_LIMIT_TIMEOUT_MS = 100;
export const MAX_DISTRIBUTED_RATE_LIMIT_TIMEOUT_MS = 10_000;

type TimeoutEnvironment = Readonly<Record<string, string | undefined>>;

export function getDistributedRateLimitTimeoutMs(
  environment: TimeoutEnvironment = process.env,
): number {
  const raw = environment.RATE_LIMIT_DISTRIBUTED_TIMEOUT_MS;
  if (!raw || !/^\d+$/.test(raw)) {
    return DEFAULT_DISTRIBUTED_RATE_LIMIT_TIMEOUT_MS;
  }

  const timeoutMs = Number(raw);
  if (
    !Number.isSafeInteger(timeoutMs)
    || timeoutMs < MIN_DISTRIBUTED_RATE_LIMIT_TIMEOUT_MS
    || timeoutMs > MAX_DISTRIBUTED_RATE_LIMIT_TIMEOUT_MS
  ) {
    return DEFAULT_DISTRIBUTED_RATE_LIMIT_TIMEOUT_MS;
  }

  return timeoutMs;
}
