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
  }
}
