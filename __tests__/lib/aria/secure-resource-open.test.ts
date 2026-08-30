/** @jest-environment node */

import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openVerifiedAriaResourceFile } from '@/lib/aria/infrastructure/resources/secure-open-linux';

async function streamBytes(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

describe('ARIA descriptor-secure resource opening', () => {
  let temporaryRoot: string;

  beforeEach(() => {
    temporaryRoot = mkdtempSync(join(tmpdir(), 'aria-resource-open-'));
  });

  afterEach(() => {
    rmSync(temporaryRoot, { recursive: true, force: true });
  });

  it('hashes, stats and streams the same opened descriptor', async () => {
    const original = Buffer.from('verified official resource');
    mkdirSync(join(temporaryRoot, 'programmes'));
    writeFileSync(join(temporaryRoot, 'programmes', 'official.pdf'), original);
    const opened = await openVerifiedAriaResourceFile({
      rootDirectory: temporaryRoot,
      relativePath: 'programmes/official.pdf',
      expectedSizeBytes: original.length,
      expectedSha256: createHash('sha256').update(original).digest('hex'),
    });

    renameSync(
      join(temporaryRoot, 'programmes', 'official.pdf'),
      join(temporaryRoot, 'programmes', 'original.pdf'),
    );
    writeFileSync(join(temporaryRoot, 'programmes', 'official.pdf'), 'replacement');

    await expect(streamBytes(opened.createReadStream())).resolves.toEqual(original);
    await opened.close();
  });

  it.each([
    '../outside.pdf',
    'programmes/../../outside.pdf',
    '/tmp/outside.pdf',
    'programmes\\..\\outside.pdf',
  ])('rejects traversal path %s', async (relativePath) => {
    await expect(openVerifiedAriaResourceFile({
      rootDirectory: temporaryRoot,
      relativePath,
      expectedSizeBytes: 1,
      expectedSha256: 'a'.repeat(64),
    })).rejects.toThrow(/relative|traversal|path/i);
  });

  it('rejects parent and final symbolic links', async () => {
    const outside = join(temporaryRoot, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'document.pdf'), 'outside');
    symlinkSync(outside, join(temporaryRoot, 'linked-parent'), 'dir');
    symlinkSync(join(outside, 'document.pdf'), join(temporaryRoot, 'linked-file.pdf'));
    const input = {
      rootDirectory: temporaryRoot,
      expectedSizeBytes: 7,
      expectedSha256: createHash('sha256').update('outside').digest('hex'),
    };

    await expect(openVerifiedAriaResourceFile({
      ...input,
      relativePath: 'linked-parent/document.pdf',
    })).rejects.toThrow(/symbolic|nofollow|directory|loop/i);
    await expect(openVerifiedAriaResourceFile({
      ...input,
      relativePath: 'linked-file.pdf',
    })).rejects.toThrow(/symbolic|nofollow|file|loop/i);
  });

  it('fails closed on size or content digest drift', async () => {
    const bytes = Buffer.from('current bytes');
    writeFileSync(join(temporaryRoot, 'resource.pdf'), bytes);

    await expect(openVerifiedAriaResourceFile({
      rootDirectory: temporaryRoot,
      relativePath: 'resource.pdf',
      expectedSizeBytes: bytes.length + 1,
      expectedSha256: createHash('sha256').update(bytes).digest('hex'),
    })).rejects.toThrow(/size|integrity/i);
    await expect(openVerifiedAriaResourceFile({
      rootDirectory: temporaryRoot,
      relativePath: 'resource.pdf',
      expectedSizeBytes: bytes.length,
      expectedSha256: 'b'.repeat(64),
    })).rejects.toThrow(/digest|integrity/i);
  });
});
