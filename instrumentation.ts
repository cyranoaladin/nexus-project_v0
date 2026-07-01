/**
 * Next.js Instrumentation Hook — runs once at server startup.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the server (not edge runtime), skip during build phase
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    const { validateEnv } = await import('./lib/env-validation');
    validateEnv();

    // Load BusinessConfig snapshot into memory at startup.
    // Without this, getOverride() returns null for all keys until an
    // admin triggers ensureFresh() via /api/admin/config — meaning all
    // DB overrides are invisible after a server restart.
    // Await ensures the snapshot is populated BEFORE the first request.
    // loadConfigSnapshot handles errors internally (logs + serves fallbacks),
    // so this await never throws — but it guarantees deterministic startup.
    const { loadConfigSnapshot } = await import('./lib/config');
    await loadConfigSnapshot();
  }
}
