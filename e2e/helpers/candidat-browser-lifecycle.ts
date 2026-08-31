import type { Page } from '@playwright/test';

/** Reloads a Chromium page with its HTTP cache disabled for this navigation. */
export async function hardReloadWithoutCache(page: Page) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.reload({ waitUntil: 'domcontentloaded' });
  } finally {
    try {
      await session.send('Network.setCacheDisabled', { cacheDisabled: false });
    } finally {
      await session.detach();
    }
  }
}
