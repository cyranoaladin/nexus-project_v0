#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const {
  validateVideoDispatch,
  compiledBundleContainsConfiguredJitsiUrl,
} = require('./preview-artifact-builder-guards.js');

const requestedMode = process.env.REQUESTED_VIDEO_MODE;
const configuredUrl = process.env.REQUESTED_JITSI_URL;
const configurationErrors = validateVideoDispatch(requestedMode, configuredUrl);
if (configurationErrors.length) throw new Error(configurationErrors.join(','));

const manifest = JSON.parse(await readFile('.next/standalone/release-manifest.json', 'utf8'));
if (manifest.VIDEO_MODE !== requestedMode) throw new Error('VIDEO_MODE_MANIFEST_MISMATCH');
if (requestedMode === 'JITSI' && manifest.JITSI_ORIGIN !== new URL(configuredUrl).origin) {
  throw new Error('JITSI_ORIGIN_MANIFEST_MISMATCH');
}
const appManifest = JSON.parse(await readFile('.next/app-build-manifest.json', 'utf8'));
const routeChunks = appManifest?.pages?.['/session/video/page'];
if (!Array.isArray(routeChunks) || routeChunks.length === 0) {
  throw new Error('VIDEO_CLIENT_ROUTE_CHUNKS_MISSING');
}
const compiledChunks = await Promise.all(routeChunks.map((chunk) => readFile(join('.next', chunk), 'utf8')));
if (requestedMode === 'JITSI' && !compiledBundleContainsConfiguredJitsiUrl(compiledChunks, configuredUrl)) {
  throw new Error('JITSI_URL_CLIENT_ROUTE_MISSING');
}

const smokeOrigin = process.env.PREVIEW_SMOKE_ORIGIN;
if (smokeOrigin !== 'http://localhost:3211') throw new Error('PREVIEW_SMOKE_ORIGIN_INVALID');
const response = await fetch(`${smokeOrigin}/session/video`, { redirect: 'manual' });
if (response.status !== 200) throw new Error(`VIDEO_PAGE_HTTP_${response.status}`);
const html = await response.text();
const renderedMode = new RegExp(`<[^>]+\\bdata-video-mode=["']${requestedMode}["'][^>]*>`, 'i');
if (!renderedMode.test(html)) throw new Error('VIDEO_CLIENT_MODE_NOT_RENDERED');

console.log(`VIDEO_ROUTE_JS_FILES_CHECKED=${routeChunks.length}`);
console.log(`VIDEO_CLIENT_MODE=${requestedMode}`);
if (requestedMode === 'JITSI') console.log('JITSI_URL_DISPATCH_VALIDATED=YES');
console.log('ACTIVE_VIDEO_CONFIG_POLICY=PASS');
