/** @jest-environment node */

import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeNpcStorageFileAtomic } from '@/lib/npc/storage-root';
import {
  validateCopySubmissionIntegrity,
  type CopySubmissionIntegrityInput,
} from '@/lib/npc/submission-integrity';

describe('NPC copy submission source integrity', () => {
  const originalStorageRoot = process.env.NPC_STORAGE_ROOT;
  let temporaryDirectory: string;
  let storageRoot: string;
  const sourceBytes = Buffer.from('source-copy-bytes');
  const sourcePath = 'student1/submission1/page_1/copy.pdf';

  beforeEach(async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'npc-integrity-'));
    storageRoot = join(temporaryDirectory, 'shared');
    mkdirSync(storageRoot, { mode: 0o750 });
    process.env.NPC_STORAGE_ROOT = storageRoot;
    await writeNpcStorageFileAtomic(
      sourcePath,
      sourceBytes,
      sourceBytes.length,
    );
  });

  afterEach(() => {
    chmodSync(storageRoot, 0o750);
    rmSync(temporaryDirectory, { recursive: true, force: true });
    if (originalStorageRoot === undefined) delete process.env.NPC_STORAGE_ROOT;
    else process.env.NPC_STORAGE_ROOT = originalStorageRoot;
  });

  function submission(
    overrides: Partial<CopySubmissionIntegrityInput> = {},
  ): CopySubmissionIntegrityInput {
    return {
      id: 'submission-1',
      storedFilePath: sourcePath,
      fileSizeBytes: sourceBytes.length,
      mimeType: 'application/pdf',
      pages: [
        {
          id: 'page-1',
          documentType: 'STUDENT_COPY',
          status: 'UPLOADED',
          originalFilePath: sourcePath,
          sizeBytes: sourceBytes.length,
          sha256: createHash('sha256').update(sourceBytes).digest('hex'),
          mimeType: 'application/pdf',
          convertedFilePaths: [],
        },
      ],
      ...overrides,
    };
  }

  it('accepts intact descriptor-backed source files', async () => {
    await expect(validateCopySubmissionIntegrity(submission())).resolves.toEqual({
      ok: true,
      issues: [],
    });
  });

  it('reports a missing original without exposing its absolute path', async () => {
    const result = await validateCopySubmissionIntegrity(submission({
      storedFilePath: 'student1/submission1/page_2/missing.pdf',
      pages: [{
        ...submission().pages[0],
        originalFilePath: 'student1/submission1/page_2/missing.pdf',
      }],
    }));

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'ORIGINAL_FILE_UNAVAILABLE', pageId: 'page-1' }],
    });
    expect(JSON.stringify(result)).not.toContain(storageRoot);
    expect(JSON.stringify(result)).not.toContain('missing.pdf');
  });

  it('rejects a persisted size mismatch', async () => {
    const result = await validateCopySubmissionIntegrity(submission({
      fileSizeBytes: sourceBytes.length + 1,
      pages: [{ ...submission().pages[0], sizeBytes: sourceBytes.length + 1 }],
    }));

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'ORIGINAL_SIZE_MISMATCH', pageId: 'page-1' }],
    });
  });

  it('rejects a SHA-256 mismatch', async () => {
    const result = await validateCopySubmissionIntegrity(submission({
      pages: [{ ...submission().pages[0], sha256: 'f'.repeat(64) }],
    }));

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'ORIGINAL_SHA256_MISMATCH', pageId: 'page-1' }],
    });
  });

  it('fails closed for a historical page whose SHA-256 is absent', async () => {
    const result = await validateCopySubmissionIntegrity(submission({
      pages: [{ ...submission().pages[0], sha256: null }],
    }));

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'ORIGINAL_SHA256_MISSING', pageId: 'page-1' }],
    });
  });

  it('rejects a CopySubmission mirror that is not the matching student-copy page', async () => {
    const result = await validateCopySubmissionIntegrity(submission({
      storedFilePath: 'student1/submission1/page_9/other.pdf',
    }));

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'STORED_FILE_MIRROR_MISMATCH' }],
    });
  });

  it.each([
    ['null', null],
    ['empty', ''],
  ])('rejects a %s CopySubmission mirror when a student copy exists', async (
    _label,
    storedFilePath,
  ) => {
    const result = await validateCopySubmissionIntegrity(submission({
      storedFilePath,
    }));

    expect(result).toEqual({
      ok: false,
      issues: [{ code: 'STORED_FILE_MIRROR_MISMATCH' }],
    });
  });

  it('rejects finalization when no student-copy source remains', async () => {
    const result = await validateCopySubmissionIntegrity(submission({
      storedFilePath: null,
      fileSizeBytes: null,
      mimeType: null,
      pages: [],
    }));

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'STUDENT_COPY_MISSING' }],
    });
  });

  it.each([
    [
      'missing',
      'student1/submission1/page_1/converted/missing.png',
      'CONVERTED_FILE_UNAVAILABLE',
    ],
    ['outside the root', '../../private.png', 'CONVERTED_FILE_NOT_DERIVED'],
  ])('rejects a %s converted artifact without disclosing its path', async (
    _label,
    convertedPath,
    expectedCode,
  ) => {
    const result = await validateCopySubmissionIntegrity(submission({
      pages: [{
        ...submission().pages[0],
        convertedFilePaths: [convertedPath],
      }],
    }));

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: expectedCode, pageId: 'page-1' }],
    });
    expect(JSON.stringify(result)).not.toContain(storageRoot);
    expect(JSON.stringify(result)).not.toContain(convertedPath);
  });

  it('rejects an existing converted file that is not derived under the same submission prefix', async () => {
    const unrelatedPath = 'student9/submission9/page_0/converted.png';
    await writeNpcStorageFileAtomic(
      unrelatedPath,
      Buffer.from('image'),
      5,
    );
    chmodSync(join(storageRoot, unrelatedPath), 0);

    const result = await validateCopySubmissionIntegrity(submission({
      pages: [{
        ...submission().pages[0],
        convertedFilePaths: [unrelatedPath],
      }],
    }));

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: 'CONVERTED_FILE_NOT_DERIVED', pageId: 'page-1' }],
    });
    expect(JSON.stringify(result)).not.toContain(unrelatedPath);
  });
});
