#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const {
  validateJitsiServerUrl,
  compiledBundleContainsConfiguredJitsiUrl,
} = require('./preview-artifact-builder-guards.js');

const configuredUrl = process.env.REQUESTED_JITSI_URL;
const urlErrors = validateJitsiServerUrl(configuredUrl);
if (urlErrors.length) throw new Error(urlErrors.join(','));

const staticRoot = '.next/static';
const paths = [];
const pending = [staticRoot];
while (pending.length > 0) {
  const directory = pending.pop();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) pending.push(path);
    else if (entry.isFile() && entry.name.endsWith('.js')) paths.push(path);
  }
}

const clientChunks = await Promise.all(paths.map((path) => readFile(path, 'utf8')));
if (!compiledBundleContainsConfiguredJitsiUrl(clientChunks, configuredUrl)) {
  throw new Error('CONFIGURED_JITSI_URL_NOT_CONSUMED_BY_CLIENT_BUNDLE');
}

console.log(`CLIENT_JS_FILES_CHECKED=${paths.length}`);
console.log('CONFIGURED_JITSI_URL_CONSUMED=YES');
console.log('ACTIVE_JITSI_URL_POLICY=PASS');
