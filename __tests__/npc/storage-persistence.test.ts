/** @jest-environment node */

import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readSecureFile,
  saveUploadedFile,
  type FileMetadata,
} from '@/lib/npc/storage';
import { resolveNpcStoragePath } from '@/lib/npc/storage-root';

describe('NPC storage persistence across releases', () => {
  const originalCwd = process.cwd();
  const originalStorageRoot = process.env.NPC_STORAGE_ROOT;
  let temporaryDirectory: string;

  afterEach(() => {
    process.chdir(originalCwd);
    if (temporaryDirectory) {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
    if (originalStorageRoot === undefined) {
      delete process.env.NPC_STORAGE_ROOT;
    } else {
      process.env.NPC_STORAGE_ROOT = originalStorageRoot;
    }
  });

  test('reads identical bytes, size, and SHA after changing release cwd', async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'npc-storage-release-'));
    const sharedRoot = join(temporaryDirectory, 'shared');
    const releaseA = join(temporaryDirectory, 'release-a');
    const releaseB = join(temporaryDirectory, 'release-b');
    mkdirSync(sharedRoot, { mode: 0o750 });
    mkdirSync(releaseA);
    mkdirSync(releaseB);
    process.env.NPC_STORAGE_ROOT = sharedRoot;

    const bytes = Buffer.from('preuve inter-release NPC\n');
    const expectedSha = createHash('sha256').update(bytes).digest('hex');
    const metadata: FileMetadata = {
      secureId: 'persistent-file',
      originalName: 'copie.pdf',
      sanitizedName: 'copie.pdf',
      mimeType: 'application/pdf',
      sizeBytes: bytes.length,
      createdAt: new Date('2026-08-11T00:00:00.000Z'),
      studentId: 'student123456',
      submissionId: 'submission789012',
      pageNumber: 1,
    };

    process.chdir(releaseA);
    const written = await saveUploadedFile(bytes, metadata);
    expect(written.success).toBe(true);
    expect(written.sha256).toBe(expectedSha);

    process.chdir(releaseB);
    const read = await readSecureFile(written.relativePath!);
    const resolvedPath = await resolveNpcStoragePath(written.relativePath!);

    expect(read).toEqual(bytes);
    expect(statSync(resolvedPath).size).toBe(bytes.length);
    expect(createHash('sha256').update(read!).digest('hex')).toBe(expectedSha);
  });
});
