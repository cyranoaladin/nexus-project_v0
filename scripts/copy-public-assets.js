#!/usr/bin/env node

/**
 * Copy public assets into the standalone build output.
 * Fail-closed: exits non-zero if standalone, static, or chunks are missing.
 */

const fs = require('fs');
const path = require('path');

function copyRecursiveSync(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function main() {
  const root = path.resolve(__dirname, '..');
  const publicDir = path.join(root, 'public');
  const standaloneDir = path.join(root, '.next', 'standalone');
  const standalonePublicDir = path.join(standaloneDir, 'public');
  const nextStaticDir = path.join(root, '.next', 'static');
  const standaloneNextDir = path.join(standaloneDir, '.next');
  const standaloneStaticDir = path.join(standaloneNextDir, 'static');

  if (!fs.existsSync(publicDir)) {
    console.error('FATAL: public/ directory does not exist');
    process.exit(1);
  }

  if (!fs.existsSync(standaloneDir)) {
    console.error('FATAL: .next/standalone does not exist — build did not produce standalone output');
    process.exit(1);
  }

  if (!fs.existsSync(nextStaticDir)) {
    console.error('FATAL: .next/static does not exist — build output is incomplete');
    process.exit(1);
  }

  // Copy public/ -> standalone/public
  copyRecursiveSync(publicDir, standalonePublicDir);

  // Copy .next/static -> standalone/.next/static
  if (!fs.existsSync(standaloneNextDir)) fs.mkdirSync(standaloneNextDir, { recursive: true });
  copyRecursiveSync(nextStaticDir, standaloneStaticDir);

  // Verify chunks exist after copy
  const chunksDir = path.join(standaloneStaticDir, 'chunks');
  if (!fs.existsSync(chunksDir)) {
    console.error('FATAL: .next/standalone/.next/static/chunks missing after copy');
    process.exit(1);
  }

  const jsChunks = fs.readdirSync(chunksDir).filter((f) => f.endsWith('.js'));
  if (jsChunks.length === 0) {
    console.error('FATAL: no .js chunks found in standalone static output');
    process.exit(1);
  }

  console.log('Public assets and static chunks copied to standalone.');
  console.log(`  chunks: ${jsChunks.length} JS files`);
}

main();
