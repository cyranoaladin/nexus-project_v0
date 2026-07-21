#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const repositoryRoot = process.cwd();
const captureRoot = resolve(repositoryRoot, process.argv[2] ?? 'assets/qa/pre-rentree-2026/public-journey');
const manifestPath = join(captureRoot, 'manifest.json');

function pngDimensions(buffer) {
  const signature = buffer.subarray(1, 4).toString('ascii');
  if (signature !== 'PNG' || buffer.length < 24) throw new Error('Invalid PNG capture');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const files = readdirSync(captureRoot)
  .filter((name) => name !== 'manifest.json' && ['.png', '.json'].includes(extname(name)))
  .sort()
  .map((name) => {
    const absolutePath = join(captureRoot, name);
    const content = readFileSync(absolutePath);
    return {
      path: relative(repositoryRoot, absolutePath),
      mediaType: extname(name) === '.png' ? 'image/png' : 'application/json',
      ...(extname(name) === '.png' ? pngDimensions(content) : {}),
      bytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
    };
  });

const manifest = {
  schemaVersion: '1.0.0',
  campaignId: 'pre-rentree-2026',
  purpose: 'Rendered desktop and mobile inspection of the canonical public journey',
  generatedBy: 'scripts/pre-rentree/build_public_qa_manifest.mjs',
  files,
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`Public journey QA manifest: ${files.length} files, ${relative(repositoryRoot, manifestPath)}\n`);
