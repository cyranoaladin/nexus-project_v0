#!/usr/bin/env node

// Browser smoke for the real DISABLED standalone. This is deliberately an
// unauthenticated direct navigation; booking ownership and C2 are qualified
// separately with disposable authenticated data.
import { chromium } from 'playwright';

const origin = process.argv[2];
if (origin !== 'http://localhost:3211') throw new Error('VIDEO_BROWSER_ORIGIN_INVALID');

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const jitsiRequests = [];
  const productErrors = [];

  page.on('request', (request) => {
    const url = request.url();
    const hostname = new URL(url).hostname.toLowerCase();
    if (/external_api\.js(?:[?#]|$)/i.test(url)
      || hostname === 'meet.jit.si'
      || hostname.includes('jitsi')) jitsiRequests.push(url);
  });
  page.on('websocket', (socket) => jitsiRequests.push(`websocket:${socket.url()}`));
  page.on('pageerror', (error) => productErrors.push(`page:${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') productErrors.push(`console:${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.url().startsWith(origin) && response.status() >= 500) {
      productErrors.push(`http:${response.status()}:${new URL(response.url()).pathname}`);
    }
  });

  const response = await page.goto(`${origin}/session/video`, { waitUntil: 'domcontentloaded' });
  if (!response || response.status() !== 200) throw new Error(`VIDEO_BROWSER_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  // Hydration may redirect an anonymous visitor to sign-in. The SSR mode is
  // attested separately by verify-preview-client-config.mjs before this step.
  await page.waitForTimeout(1500);
  if (jitsiRequests.length) throw new Error(`JITSI_NETWORK_REQUESTS:${jitsiRequests.length}`);
  if (productErrors.length) throw new Error(`VIDEO_BROWSER_PRODUCT_ERRORS:${productErrors.join('|')}`);
  console.log('VIDEO_UNAUTH_BROWSER=PASS');
  console.log('JITSI_NETWORK_REQUESTS=0');
  console.log('VIDEO_BROWSER_PRODUCT_ERRORS=0');
  await context.close();
} finally {
  await browser.close();
}
