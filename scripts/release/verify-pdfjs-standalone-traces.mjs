#!/usr/bin/env node

import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const nextDir = resolve(process.argv[2] ?? '.next');
const projectRoot = dirname(nextDir);
const required = [
  'lib/bilans/render/pdf-text-extraction-child.mjs',
  'lib/bilans/render/pdf-text-extraction-runtime.mjs',
  'node_modules/pdfjs-dist/legacy/build/pdf.mjs',
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  'node_modules/@napi-rs/canvas/index.js',
  'node_modules/@napi-rs/canvas-linux-x64-gnu/skia.linux-x64-gnu.node',
];

async function collect(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path, output);
    else if (entry.isFile() && entry.name.endsWith('.nft.json')) output.push(path);
  }
  return output;
}

function normalize(path) {
  return path.split(sep).join('/').replace(/^\.\//, '');
}

async function main() {
  const manifests = await collect(join(nextDir, 'server'));
  if (manifests.length === 0) throw new Error('PDFJS_TRACE_MANIFESTS_MISSING');
  const traced = new Set();
  for (const manifestPath of manifests) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    for (const file of manifest.files ?? []) {
      const absolute = isAbsolute(file) ? file : resolve(dirname(manifestPath), file);
      const rel = relative(projectRoot, absolute);
      if (!rel.startsWith(`..${sep}`) && rel !== '..') traced.add(normalize(rel));
    }
  }
  const standaloneRoot = join(nextDir, 'standalone');
  for (const path of required) {
    if (!traced.has(path)) throw new Error(`PDFJS_TRACE_ENTRY_MISSING:${path}`);
    await stat(join(standaloneRoot, path));
  }
  console.log(`PDFJS_TRACE_MANIFESTS=${manifests.length}`);
  console.log('PDFJS_STANDALONE_TRACE_CLOSURE=PASS');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'UNKNOWN';
  console.error(`PDFJS_STANDALONE_TRACE_CLOSURE=FAIL:${message}`);
  process.exitCode = 1;
});
