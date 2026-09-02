export function assertDisposableAriaBackfillTarget(
  value: string | undefined,
  marker: string | undefined,
): URL {
  let parsed: URL;
  try {
    parsed = new URL(value ?? '');
  } catch {
    throw new Error('ARIA_BACKFILL_DATABASE_NOT_DISPOSABLE');
  }
  const database = parsed.pathname.replace(/^\//, '');
  const port = Number(parsed.port);
  if (
    marker !== '1'
    || parsed.protocol !== 'postgresql:'
    || parsed.hostname !== '127.0.0.1'
    || !Number.isInteger(port)
    || port < 1024
    || port > 65535
    || port === 5432
    || !/^nexus_disposable_aria_[a-f0-9]+_test$/.test(database)
    || /(?:prod|production|stag|staging)/i.test(`${parsed.hostname}/${database}`)
  ) {
    throw new Error('ARIA_BACKFILL_DATABASE_NOT_DISPOSABLE');
  }
  return parsed;
}
