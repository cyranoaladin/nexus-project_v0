#!/usr/bin/env node

/**
 * smoke-standalone-assets.mjs — HTTP smoke test for standalone builds.
 *
 * Starts the standalone server, fetches pages, extracts static asset URLs,
 * and verifies they all return 200 with correct Content-Type.
 *
 * Exits 1 on any failure. Designed as a release gate.
 *
 * Usage: node scripts/release/smoke-standalone-assets.mjs [buildDir]
 * Env:   SMOKE_PORT (default 3199)
 */

import { spawn } from 'child_process';
import { resolve } from 'path';

const buildDir = resolve(process.argv[2] || process.cwd());
const PORT = parseInt(process.env.SMOKE_PORT || '3199', 10);
const BASE = `http://127.0.0.1:${PORT}`;
const PAGES = ['/', '/stages', '/bilan-gratuit'];
const STARTUP_TIMEOUT = 30_000;
const POLL_INTERVAL = 500;
const SHUTDOWN_TIMEOUT = 5_000;

const errors = [];
let server;
let serverExited = false;
let serverExitCode = null;
const stderrLines = [];

function fail(msg) { errors.push(msg); console.error(`  FAIL: ${msg}`); }
function ok(msg) { console.log(`  OK: ${msg}`); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForHealth() {
  const deadline = Date.now() + STARTUP_TIMEOUT;
  while (Date.now() < deadline) {
    if (serverExited) return false;
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch { /* not ready */ }
    await sleep(POLL_INTERVAL);
  }
  return false;
}

async function shutdownServer() {
  if (!server || serverExited) return;
  server.kill('SIGTERM');
  const deadline = Date.now() + SHUTDOWN_TIMEOUT;
  while (!serverExited && Date.now() < deadline) await sleep(200);
  if (!serverExited) { server.kill('SIGKILL'); await sleep(500); }
}

console.log(`\nsmoke-standalone-assets\nbuildDir: ${buildDir}\nport: ${PORT}\n`);

// Start standalone server
const serverJs = resolve(buildDir, '.next/standalone/server.js');
server = spawn('node', [serverJs], {
  env: {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
    TELEGRAM_NOTIFICATIONS_ENABLED: 'false',
    PAYMENTS_ENABLED: 'false',
  },
  cwd: resolve(buildDir, '.next/standalone'),
  stdio: ['ignore', 'pipe', 'pipe'],
});

server.stdout.on('data', () => {});
server.stderr.on('data', (chunk) => {
  const line = chunk.toString().trim();
  if (line) stderrLines.push(line.slice(0, 200));
  if (stderrLines.length > 50) stderrLines.shift();
});
server.on('exit', (code) => { serverExited = true; serverExitCode = code; });

try {
  // Wait for startup
  const ready = await waitForHealth();
  if (!ready) {
    if (serverExited) {
      fail(`Server exited prematurely with code ${serverExitCode}`);
      if (stderrLines.length > 0) {
        console.error('  Last stderr lines:');
        stderrLines.slice(-5).forEach(l => console.error(`    ${l}`));
      }
    } else {
      fail('Server did not become healthy within timeout');
    }
    throw new Error('startup failure');
  }
  ok('Server healthy');

  // Fetch pages and collect static asset URLs
  const allAssets = new Set();
  let pageCount = 0;

  for (const path of PAGES) {
    if (serverExited) { fail('Server exited during page fetch'); break; }
    try {
      const res = await fetch(`${BASE}${path}`);
      if (res.status !== 200) { fail(`${path} returned ${res.status}`); continue; }
      ok(`Page ${path}: 200`);
      pageCount++;
      const body = await res.text();
      for (const m of body.matchAll(/\/_next\/static\/[^"'\s]+\.(js|css)/g)) {
        allAssets.add(m[0]);
      }
    } catch (e) {
      fail(`${path} fetch error: ${e.message?.slice(0, 80)}`);
    }
  }

  // Classify assets
  const jsAssets = [...allAssets].filter(u => u.endsWith('.js'));
  const cssAssets = [...allAssets].filter(u => u.endsWith('.css'));

  // Validate minimums
  if (pageCount < 3) fail(`Only ${pageCount}/3 pages returned 200`);
  if (allAssets.size === 0) fail('No static assets extracted from HTML — build may be broken');
  if (jsAssets.length === 0) fail('No JavaScript chunks found — application will not hydrate');

  console.log(`\nReferenced: ${allAssets.size} assets (${jsAssets.length} JS, ${cssAssets.length} CSS)`);

  // Verify each asset
  let asset404 = 0, assetNon200 = 0, jsContentTypeErrors = 0, cssContentTypeErrors = 0;

  for (const assetUrl of allAssets) {
    if (serverExited) { fail('Server exited during asset check'); break; }
    try {
      const res = await fetch(`${BASE}${assetUrl}`);
      const ct = res.headers.get('content-type') || '';

      if (res.status === 404) {
        asset404++;
        fail(`404: ${assetUrl.split('/').pop()}`);
      } else if (res.status !== 200) {
        assetNon200++;
        fail(`${res.status}: ${assetUrl.split('/').pop()}`);
      } else {
        // Content-Type checks
        if (assetUrl.endsWith('.js') && !ct.includes('javascript')) {
          jsContentTypeErrors++;
          fail(`JS wrong Content-Type: ${ct} for ${assetUrl.split('/').pop()}`);
        }
        if (assetUrl.endsWith('.css') && !ct.includes('css')) {
          cssContentTypeErrors++;
          fail(`CSS wrong Content-Type: ${ct} for ${assetUrl.split('/').pop()}`);
        }
      }
    } catch (e) {
      assetNon200++;
      fail(`Fetch error: ${assetUrl.split('/').pop()}: ${e.message?.slice(0, 60)}`);
    }
  }

  // Summary
  console.log('\n--- SUMMARY ---');
  console.log(`PAGE_COUNT=${pageCount}`);
  console.log(`REFERENCED_STATIC_ASSET_COUNT=${allAssets.size}`);
  console.log(`JS_ASSET_COUNT=${jsAssets.length}`);
  console.log(`CSS_ASSET_COUNT=${cssAssets.length}`);
  console.log(`STATIC_ASSET_404_COUNT=${asset404}`);
  console.log(`STATIC_ASSET_NON_200_COUNT=${assetNon200}`);
  console.log(`JS_CONTENT_TYPE_ERROR_COUNT=${jsContentTypeErrors}`);
  console.log(`CSS_CONTENT_TYPE_ERROR_COUNT=${cssContentTypeErrors}`);
  console.log(`SERVER_EARLY_EXIT=${serverExited}`);
  console.log(`SERVER_EXIT_CODE=${serverExitCode}`);

} catch (e) {
  if (!errors.length) fail(e.message || 'Unknown error');
} finally {
  await shutdownServer();
}

if (errors.length > 0) {
  console.error(`\n${errors.length} ERROR(S) — SMOKE FAILED\n`);
  process.exit(1);
} else {
  console.log('\nSMOKE PASSED\n');
}
