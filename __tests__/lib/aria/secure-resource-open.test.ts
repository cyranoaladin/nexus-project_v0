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
    const original = Buffer.from('%PDF-1.7\nverified official resource');
    mkdirSync(join(temporaryRoot, 'programmes'));
    writeFileSync(join(temporaryRoot, 'programmes', 'official.pdf'), original);
    const opened = await openVerifiedAriaResourceFile({
      rootDirectory: temporaryRoot,
      relativePath: 'programmes/official.pdf',
      expectedSizeBytes: original.length,
      expectedSha256: createHash('sha256').update(original).digest('hex'),
      expectedMimeType: 'application/pdf',
    });

    renameSync(
      join(temporaryRoot, 'programmes', 'official.pdf'),
      join(temporaryRoot, 'programmes', 'original.pdf'),
    );
    writeFileSync(join(temporaryRoot, 'programmes', 'official.pdf'), 'replacement');

    await expect(streamBytes(opened.createReadStream())).resolves.toEqual(original);
    await opened.close();
  });

  it('streams the verified snapshot even if the same inode mutates after opening', async () => {
    const original = Buffer.from('%PDF-1.7\noriginal immutable payload');
    const path = join(temporaryRoot, 'official.pdf');
    writeFileSync(path, original);
    const opened = await openVerifiedAriaResourceFile({
      rootDirectory: temporaryRoot,
      relativePath: 'official.pdf',
      expectedSizeBytes: original.length,
      expectedSha256: createHash('sha256').update(original).digest('hex'),
      expectedMimeType: 'application/pdf',
    });
    writeFileSync(path, Buffer.alloc(original.length, 0x78));

    await expect(streamBytes(opened.createReadStream())).resolves.toEqual(original);
    await opened.close();
  });

  it.each([
    '',
    '../outside.pdf',
    'programmes/../../outside.pdf',
    '/tmp/outside.pdf',
    'C:\\outside.pdf',
    'programmes\\..\\outside.pdf',
    'programmes//outside.pdf',
    './outside.pdf',
    'programmes/outside.pdf/',
    'programmes/\0outside.pdf',
  ])('rejects traversal path %s', async (relativePath) => {
    await expect(openVerifiedAriaResourceFile({
      rootDirectory: temporaryRoot,
      relativePath,
      expectedSizeBytes: 1,
      expectedSha256: 'a'.repeat(64),
      expectedMimeType: 'application/pdf',
    })).rejects.toThrow(/relative|traversal|path/i);
  });

  it.each([
    { expectedSizeBytes: 0, expectedSha256: 'a'.repeat(64), expectedMimeType: 'application/pdf' },
    { expectedSizeBytes: Number.NaN, expectedSha256: 'a'.repeat(64), expectedMimeType: 'application/pdf' },
    { expectedSizeBytes: (16 * 1024 * 1024) + 1, expectedSha256: 'a'.repeat(64), expectedMimeType: 'application/pdf' },
    { expectedSizeBytes: 1, expectedSha256: 'not-a-sha256', expectedMimeType: 'application/pdf' },
    { expectedSizeBytes: 1, expectedSha256: 'a'.repeat(64), expectedMimeType: 'text/plain' },
  ])('rejects invalid immutable resource metadata %#', async (metadata) => {
    await expect(openVerifiedAriaResourceFile({
      rootDirectory: temporaryRoot,
      relativePath: 'resource.pdf',
      ...metadata,
    } as Parameters<typeof openVerifiedAriaResourceFile>[0])).rejects.toThrow(/metadata|integrity/i);
  });

  it('fails closed outside Linux descriptor semantics', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { ...descriptor, value: 'darwin' });
    try {
      await expect(openVerifiedAriaResourceFile({
        rootDirectory: temporaryRoot,
        relativePath: 'resource.pdf',
        expectedSizeBytes: 1,
        expectedSha256: 'a'.repeat(64),
        expectedMimeType: 'application/pdf',
      })).rejects.toThrow(/requires Linux/i);
    } finally {
      if (descriptor) Object.defineProperty(process, 'platform', descriptor);
    }
  });

  it('rejects a root that is a file, a symlink or has a non-canonical parent', async () => {
    const rootFile = join(temporaryRoot, 'root-file');
    writeFileSync(rootFile, 'not a directory');
    const realParent = join(temporaryRoot, 'real-parent');
    const realChild = join(realParent, 'child');
    mkdirSync(realChild, { recursive: true });
    const rootLink = join(temporaryRoot, 'root-link');
    const parentLink = join(temporaryRoot, 'parent-link');
    symlinkSync(realChild, rootLink, 'dir');
    symlinkSync(realParent, parentLink, 'dir');
    const input = {
      relativePath: 'resource.pdf',
      expectedSizeBytes: 1,
      expectedSha256: 'a'.repeat(64),
      expectedMimeType: 'application/pdf' as const,
    };

    await expect(openVerifiedAriaResourceFile({ ...input, rootDirectory: rootFile }))
      .rejects.toThrow(/root|directory/i);
    await expect(openVerifiedAriaResourceFile({ ...input, rootDirectory: rootLink }))
      .rejects.toThrow(/root|directory/i);
    await expect(openVerifiedAriaResourceFile({
      ...input,
      rootDirectory: join(parentLink, 'child'),
    })).rejects.toThrow(/canonical/i);
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
      expectedMimeType: 'application/pdf' as const,
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
    const bytes = Buffer.from('%PDF-current bytes');
    writeFileSync(join(temporaryRoot, 'resource.pdf'), bytes);

    await expect(openVerifiedAriaResourceFile({
      rootDirectory: temporaryRoot,
      relativePath: 'resource.pdf',
      expectedSizeBytes: bytes.length + 1,
      expectedSha256: createHash('sha256').update(bytes).digest('hex'),
      expectedMimeType: 'application/pdf',
    })).rejects.toThrow(/size|integrity/i);
    await expect(openVerifiedAriaResourceFile({
      rootDirectory: temporaryRoot,
      relativePath: 'resource.pdf',
      expectedSizeBytes: bytes.length,
      expectedSha256: 'b'.repeat(64),
      expectedMimeType: 'application/pdf',
    })).rejects.toThrow(/digest|integrity/i);
  });

  it('detects MIME from verified descriptor bytes and rejects a disguised PDF', async () => {
    const bytes = Buffer.from('not-a-pdf-payload');
    writeFileSync(join(temporaryRoot, 'disguised.pdf'), bytes);

    await expect(openVerifiedAriaResourceFile({
      rootDirectory: temporaryRoot,
      relativePath: 'disguised.pdf',
      expectedSizeBytes: bytes.length,
      expectedSha256: createHash('sha256').update(bytes).digest('hex'),
      expectedMimeType: 'application/pdf',
    })).rejects.toThrow(/mime|pdf/i);
  });

  it('allows exactly one stream and makes close idempotent', async () => {
    const bytes = Buffer.from('%PDF-one-shot');
    writeFileSync(join(temporaryRoot, 'one-shot.pdf'), bytes);
    const opened = await openVerifiedAriaResourceFile({
      rootDirectory: temporaryRoot,
      relativePath: 'one-shot.pdf',
      expectedSizeBytes: bytes.length,
      expectedSha256: createHash('sha256').update(bytes).digest('hex'),
      expectedMimeType: 'application/pdf',
    });

    await expect(streamBytes(opened.createReadStream())).resolves.toEqual(bytes);
    expect(() => opened.createReadStream()).toThrow(/no longer available/i);
    await expect(opened.close()).resolves.toBeUndefined();
    await expect(opened.close()).resolves.toBeUndefined();
    expect(() => opened.createReadStream()).toThrow(/no longer available/i);
  });
});
