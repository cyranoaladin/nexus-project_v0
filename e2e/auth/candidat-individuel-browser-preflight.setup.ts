import { expect, test } from '@playwright/test';

test('le navigateur gouverné correspond exactement à la version attendue', async ({ browser }, testInfo) => {
  const expectedBrowserVersion = testInfo.project.metadata.expectedBrowserVersion;
  expect(typeof expectedBrowserVersion).toBe('string');
  expect(browser.version()).toBe(expectedBrowserVersion);
});
