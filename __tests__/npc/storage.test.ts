/** @jest-environment node */

import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  deleteSecureFile,
  deleteSubmissionFiles,
  fileExists,
  generateSecureFileId,
  generateSecurePath,
  readSecureFile,
  saveUploadedFile,
  type FileMetadata,
} from '@/lib/npc/storage';
import { SECURE_FILE_ID_LENGTH } from '@/lib/npc/config';

describe('NPC storage operations', () => {
  const originalStorageRoot = process.env.NPC_STORAGE_ROOT;
  let temporaryDirectory: string;
  let storageRoot: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'npc-storage-operations-'));
    storageRoot = join(temporaryDirectory, 'shared');
    mkdirSync(storageRoot, { mode: 0o750 });
    process.env.NPC_STORAGE_ROOT = storageRoot;
  });

  afterEach(() => {
    chmodSync(storageRoot, 0o750);
    rmSync(temporaryDirectory, { recursive: true, force: true });
    if (originalStorageRoot === undefined) {
      delete process.env.NPC_STORAGE_ROOT;
    } else {
      process.env.NPC_STORAGE_ROOT = originalStorageRoot;
    }
  });

  const metadata = (overrides: Partial<FileMetadata> = {}): FileMetadata => ({
    secureId: 'secure-file-id',
    originalName: 'copie.pdf',
    sanitizedName: 'copie.pdf',
    mimeType: 'application/pdf',
    sizeBytes: Buffer.byteLength('copie-nexus!'),
    createdAt: new Date('2026-08-11T00:00:00.000Z'),
    studentId: 'student123456',
    submissionId: 'submission789012',
    pageNumber: 1,
    ...overrides,
  });

  test('generates unique hexadecimal file identifiers', () => {
    const first = generateSecureFileId();
    const second = generateSecureFileId();

    expect(first).toMatch(/^[a-f0-9]+$/);
    expect(first).toHaveLength(SECURE_FILE_ID_LENGTH * 2);
    expect(second).not.toBe(first);
  });

  test('generates a path below the canonical root', async () => {
    const filePath = await generateSecurePath(
      'student123456',
      'submission789012',
      5,
      'copie.pdf',
    );

    expect(filePath).toBe(
      join(storageRoot, 'student1', 'submission78', 'page_5', 'copie.pdf'),
    );
  });

  test.each([
    ['student identifier', '../escape', 'submission789012', 'copie.pdf'],
    ['submission identifier', 'student123456', '../escape-value', 'copie.pdf'],
    ['filename traversal', 'student123456', 'submission789012', '../copie.pdf'],
    ['filename separator', 'student123456', 'submission789012', 'nested/copie.pdf'],
  ])(
    'rejects traversal through the %s',
    async (_label, studentId, submissionId, filename) => {
      await expect(
        generateSecurePath(studentId, submissionId, 1, filename),
      ).rejects.toThrow(/path|segment|traversal/i);
    },
  );

  test('writes bytes, reports their SHA-256, and reads them back', async () => {
    const bytes = Buffer.from('copie-nexus!');
    const result = await saveUploadedFile(bytes, metadata());

    expect(result).toMatchObject({
      success: true,
      secureId: 'secure-file-id',
      relativePath: join('student1', 'submission78', 'page_1', 'copie.pdf'),
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    expect(result.filePath).toBe(join(storageRoot, result.relativePath!));
    expect(readFileSync(result.filePath!)).toEqual(bytes);
    expect(lstatSync(dirname(result.filePath!)).isDirectory()).toBe(true);
    await expect(readSecureFile(result.relativePath!)).resolves.toEqual(bytes);
    await expect(fileExists(result.relativePath!)).resolves.toBe(true);
  });

  test('removes a write whose persisted size differs from metadata', async () => {
    const result = await saveUploadedFile(
      Buffer.from('short'),
      metadata({ sizeBytes: 999 }),
    );

    expect(result).toEqual({
      success: false,
      error: 'SIZE_MISMATCH_AFTER_WRITE',
    });
    await expect(
      fileExists(join('student1', 'submission78', 'page_1', 'copie.pdf')),
    ).resolves.toBe(false);
  });

  test('rejects unsafe reads and deletes', async () => {
    await expect(readSecureFile('../outside.pdf')).resolves.toBeNull();
    await expect(fileExists('../outside.pdf')).resolves.toBe(false);
    await expect(deleteSecureFile('../outside.pdf')).resolves.toBe(false);
  });

  test('deletes a stored file and all files for a valid submission', async () => {
    const first = await saveUploadedFile(Buffer.from('copie-nexus!'), metadata());
    expect(first.success).toBe(true);
    await expect(deleteSecureFile(first.relativePath!)).resolves.toBe(true);
    await expect(fileExists(first.relativePath!)).resolves.toBe(false);

    const second = await saveUploadedFile(Buffer.from('copie-nexus!'), metadata());
    expect(second.success).toBe(true);
    await expect(
      deleteSubmissionFiles('student123456', 'submission789012'),
    ).resolves.toBe(true);
    await expect(fileExists(second.relativePath!)).resolves.toBe(false);
  });

  test('does not accept invalid identifiers for submission cleanup', async () => {
    await expect(deleteSubmissionFiles('', '')).resolves.toBe(false);
    await expect(
      deleteSubmissionFiles('../escape', 'submission789012'),
    ).resolves.toBe(false);
  });
});
