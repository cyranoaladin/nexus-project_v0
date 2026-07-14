#!/usr/bin/env node

/**
 * smoke-standalone-assets.mjs — HTTP smoke test for standalone builds.
 *
 * Starts the standalone server, fetches pages, extracts static asset URLs,
 * and verifies they all return 200 with correct Content-Type.
 *
 * Usage: node scripts/release/smoke-standalone-assets.mjs [buildDir]
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import { setTimeout as sleep } from 'timers/promises';

const buildDir = resolve(process.argv[2] || process.cwd());
const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGES = ['/', '/stages', '/bilan-gratuit'];
const STARTUP_TIMEOUT = 30_000;
const POLL_INTERVAL = 500;

let server;
const errors = [];

function fail(msg) { errors.push(msg); console.error(`  FAIL: ${msg}`); }
function ok(msg) { console.log(`  OK: ${msg}`); }

async function fetchOk(url) {
  const res = await fetch(url);
  return { status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() };
}

async function waitForHealth() {
  const deadline = Date.now() + STARTUP_TIMEOUT;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch { /* not ready */ }
    await sleep(POLL_INTERVAL);
  }
  return false;
}

console.log(`\nsmoke-standalone-assets\nbuildDir: ${buildDir}\nport: ${PORT}\n`);

// Start standalone server
const serverJs = resolve(buildDir, '.next/standalone/server.js');
server = spawn('node', [serverJs], {
  env: { ...process.env, PORT: String(PORT), HOSTNAME: '127.0.0.1', NODE_ENV: 'production' },
  cwd: resolve(buildDir, '.next/standalone'),
  stdio: ['ignore', 'pipe', 'pipe'],
});

server.stdout.on('data', () => {});
server.stderr.on('data', () => {});

try {
  // Wait for startup
  const ready = await waitForHealth();
  if (!ready) {
    fail('Server did not become healthy within timeout');
    throw new Error('startup timeout');
  }
  ok('Server healthy');

  // Fetch pages and collect static asset URLs
  const allAssets = new Set();
  let pageCount = 0;

  for (const path of PAGES) {
    const { status, body } = await fetchOk(`${BASE}${path}`);
    if (status !== 200) {
      fail(`${path} returned ${status}`);
      continue;
    }
    ok(`Page ${path}: ${status}`);
    pageCount++;

    // Extract /_next/static/ URLs
    const matches = body.matchAll(/\/_next\/static\/[^"'\s]+\.(js|css)/g);
    for (const m of matches) allAssets.add(m[0]);
  }

  console.log(`\nReferenced static assets: ${allAssets.size}`);

  // Verify each asset
  let asset404 = 0, assetNon200 = 0, contentTypeErrors = 0;

  for (const assetUrl of allAssets) {
    try {
      const res = await fetch(`${BASE}${assetUrl}`);
      if (res.status === 404) { asset404++; fail(`404: ${assetUrl.split('/').pop()}`); }
      else if (res.status !== 200) { assetNon200++; fail(`${res.status}: ${assetUrl.split('/').pop()}`); }
      else {
        const ct = res.headers.get('content-type') || '';
        if (assetUrl.endsWith('.js') && !ct.includes('javascript')) {
          contentTypeErrors++;
          fail(`Wrong Content-Type for JS: ${ct}`);
        }
      }
    } catch (e) {
      assetNon200++;
      fail(`Fetch error: ${assetUrl.split('/').pop()}`);
    }
  }

  // Summary
  console.log('\n--- SUMMARY ---');
  console.log(`PAGE_COUNT=${pageCount}`);
  console.log(`REFERENCED_STATIC_ASSET_COUNT=${allAssets.size}`);
  console.log(`STATIC_ASSET_404_COUNT=${asset404}`);
  console.log(`STATIC_ASSET_NON_200_COUNT=${assetNon200}`);
  console.log(`STATIC_CONTENT_TYPE_ERROR_COUNT=${contentTypeErrors}`);

} finally {
  if (server) {
    server.kill('SIGTERM');
    await sleep(1000);
    if (!server.killed) server.kill('SIGKILL');
  }
}

if (errors.length > 0) {
  console.error(`\n${errors.length} ERROR(S) — SMOKE FAILED\n`);
  process.exit(1);
} else {
  console.log('\nSMOKE PASSED\n');
}
