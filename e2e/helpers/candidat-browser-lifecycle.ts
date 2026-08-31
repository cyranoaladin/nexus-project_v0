import type { Page } from '@playwright/test';

/** Reloads a Chromium page with its HTTP cache disabled for this navigation. */
export async function hardReloadWithoutCache(page: Page) {
  const session = await page.context().newCDPSession(page);
  let primaryFailed = false;
  let primaryError: unknown;
  try {
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.reload({ waitUntil: 'domcontentloaded' });
  } catch (error) {
    primaryFailed = true;
    primaryError = error;
  }

  const cleanupErrors: unknown[] = [];
  try {
    await session.send('Network.setCacheDisabled', { cacheDisabled: false });
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await session.detach();
  } catch (error) {
    cleanupErrors.push(error);
  }

  if (primaryFailed) {
    if (cleanupErrors.length === 0) throw primaryError;
    const aggregate = new AggregateError(
      [primaryError, ...cleanupErrors],
      'Hard reload failed and browser cache cleanup also failed.',
    );
    (aggregate as AggregateError & { cause: unknown }).cause = primaryError;
    throw aggregate;
  }
  if (cleanupErrors.length === 1) throw cleanupErrors[0];
  if (cleanupErrors.length > 1) {
    throw new AggregateError(cleanupErrors, 'Browser cache cleanup failed after hard reload.');
  }
}
