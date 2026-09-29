#!/usr/bin/env node

import PDFDocument from 'pdfkit';
import { cp, lstat, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceStandalone = resolve(process.argv[2] ?? '.next/standalone');
const RUNTIME_MODULE = 'lib/bilans/render/pdf-text-extraction-runtime.mjs';
const PDFJS_PACKAGE = 'node_modules/pdfjs-dist';
const ISOLATED_ENV = {
  PATH: process.env.PATH ?? '',
  HOME: tmpdir(),
  NODE_ENV: 'production',
};
const expectedFragments = [
  'C2_STANDALONE_SYNTHETIC_FRAGMENT_ALPHA',
  'C2_STANDALONE_SYNTHETIC_FRAGMENT_BETA',
];

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

async function makeSyntheticPdf() {
  const document = new PDFDocument({ compress: false, margin: 48 });
  const chunks = [];
  const completed = new Promise((resolveBuffer, reject) => {
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolveBuffer(Buffer.concat(chunks)));
    document.on('error', reject);
  });
  document.font('Helvetica').fontSize(12).text(expectedFragments[0]);
  document.moveDown().text(expectedFragments[1]);
  document.end();
  return completed;
}

async function assertNoNodeModulesAncestors(directory) {
  let current = dirname(resolve(directory));
  while (true) {
    assert(!(await lstat(join(current, 'node_modules')).then(() => true, () => false)), 'ISOLATION_PARENT_NODE_MODULES_FOUND');
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

async function assertNoEscapingSymlinks(root) {
  const canonicalRoot = await realpath(root);
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    const { readdir } = await import('node:fs/promises');
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(file);
      else if (entry.isSymbolicLink()) {
        const target = await realpath(file);
        const rel = relative(canonicalRoot, target);
        assert(rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..'), 'ARTIFACT_SYMLINK_ESCAPES_ROOT');
      }
    }
  }
}

async function copyStandalone(source, destination) {
  await assertNoEscapingSymlinks(source);
  await cp(source, destination, { recursive: true, dereference: true, errorOnExist: true });
  await assertNoNodeModulesAncestors(destination);
}

async function loadRuntime(root) {
  const runtimePath = join(root, RUNTIME_MODULE);
  await readFile(runtimePath);
  return import(pathToFileURL(runtimePath).href);
}

async function main() {
  assert(await lstat(join(sourceStandalone, 'server.js')).then(() => true, () => false), 'STANDALONE_SERVER_MISSING');
  const pdf = await makeSyntheticPdf();
  const tempParent = await mkdtemp(join(tmpdir(), 'nexus-pdfjs-standalone-'));
  const positiveRoot = join(tempParent, 'positive');
  const negativeRoot = join(tempParent, 'negative');
  try {
    await copyStandalone(sourceStandalone, positiveRoot);
    const runtime = await loadRuntime(positiveRoot);
    const result = await runtime.extractSubmissionTextBounded(pdf, { root: positiveRoot, env: ISOLATED_ENV });
    assert(result.status === 'SUCCEEDED', `POSITIVE_EXTRACTION_STATUS_${result.status}${result.status === 'FAILED' ? `_${result.errorMessage.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 160)}` : ''}`);
    assert(result.truncated === false, 'POSITIVE_EXTRACTION_TRUNCATED');
    assert(expectedFragments.every((fragment) => result.text.includes(fragment)), 'POSITIVE_EXPECTED_TEXT_MISSING');
    console.log('PDFJS_STANDALONE_EXTRACTION=PASS');
    console.log('PDFJS_STANDALONE_TEXT_FRAGMENTS=2');
    console.log('PDFJS_STANDALONE_TRUNCATED=NO');

    await copyStandalone(sourceStandalone, negativeRoot);
    await rm(join(negativeRoot, PDFJS_PACKAGE), { recursive: true, force: true });
    const negativeRuntime = await loadRuntime(negativeRoot);
    const availability = await negativeRuntime.checkPdfTextExtractionRuntime({ root: negativeRoot, env: ISOLATED_ENV });
    assert(availability.available === false, 'NEGATIVE_CONTROL_ENGINE_STILL_AVAILABLE');
    assert(availability.code === 'PDFJS_RUNTIME_DEPENDENCY_UNAVAILABLE', 'NEGATIVE_CONTROL_WRONG_FAILURE');
    console.log('PDFJS_STANDALONE_NEGATIVE_CONTROL=PASS');
  } finally {
    await rm(tempParent, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const code = error instanceof Error ? error.message.split(':')[0] : 'UNKNOWN';
  console.error(`PDFJS_STANDALONE_EXTRACTION=FAIL:${code}`);
  process.exitCode = 1;
});
