export async function register() {
  if (process.env.SENTRY_DSN) {
    try {
      // Avoid bundler resolution when Sentry is not installed
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const req: any = (0, eval)('require')
      const Sentry = req('@sentry/nextjs')
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
        environment: process.env.NODE_ENV,
      })
    } catch (e: any) {
      // Soft-fail when package not installed
      // eslint-disable-next-line no-console
      console.log('Sentry init skipped:', e?.message || String(e))
    }
  }
}