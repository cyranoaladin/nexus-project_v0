import { createClient } from 'redis';

/**
 * Clear the rate-limit store used by the disposable E2E stack.
 *
 * The production rate limiter stays enabled and unchanged. The reset is only
 * allowed against the dedicated Redis service created with the ephemeral
 * Docker Compose project, so hundreds of real sign-in scenarios do not share
 * one synthetic bridge IP quota.
 */
export async function resetDisposableE2ERateLimits(): Promise<void> {
  if (process.env.E2E_DISPOSABLE_STACK !== '1') {
    throw new Error('[E2E] Refusing rate-limit reset outside the disposable stack');
  }

  const rawUrl = process.env.E2E_DISPOSABLE_REDIS_URL;
  if (!rawUrl) {
    throw new Error('[E2E] E2E_DISPOSABLE_REDIS_URL is required');
  }

  const url = new URL(rawUrl);
  if (
    url.protocol !== 'redis:'
    || url.hostname !== 'redis-e2e'
    || (url.pathname !== '' && url.pathname !== '/' && url.pathname !== '/0')
  ) {
    throw new Error('[E2E] Refusing rate-limit reset against a non-disposable Redis target');
  }

  const client = createClient({ url: rawUrl });
  client.on('error', () => {
    // The operation itself fails below; never log connection material.
  });

  try {
    await client.connect();
    await client.flushDb();
  } finally {
    if (client.isOpen) await client.quit();
  }
}
