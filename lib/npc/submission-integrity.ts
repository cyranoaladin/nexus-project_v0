import { createHash } from 'node:crypto';
import { readNpcStorageFile } from './storage-root';

export type CopySubmissionIntegrityIssueCode =
  | 'ORIGINAL_FILE_UNAVAILABLE'
  | 'ORIGINAL_SIZE_MISSING'
  | 'ORIGINAL_SIZE_MISMATCH'
  | 'ORIGINAL_SHA256_MISSING'
  | 'ORIGINAL_SHA256_MISMATCH'
  | 'STUDENT_COPY_MISSING'
  | 'STORED_FILE_MIRROR_MISMATCH'
  | 'CONVERTED_FILE_NOT_DERIVED'
  | 'CONVERTED_FILE_UNAVAILABLE';

export interface CopySubmissionIntegrityPageInput {
  id: string;
  documentType: string;
  status: string;
  originalFilePath: string;
  sizeBytes: number | null;
  sha256: string | null;
  mimeType: string | null;
  convertedFilePaths: readonly string[];
}

export interface CopySubmissionIntegrityInput {
  id: string;
  storedFilePath: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  pages: readonly CopySubmissionIntegrityPageInput[];
}

export interface CopySubmissionIntegrityIssue {
  code: CopySubmissionIntegrityIssueCode;
  pageId?: string;
}

export type CopySubmissionIntegrityResult = {
  ok: boolean;
  issues: CopySubmissionIntegrityIssue[];
};

async function readSource(relativePath: string): Promise<Buffer | null> {
  try {
    return await readNpcStorageFile(relativePath);
  } catch {
    return null;
  }
}

function submissionStoragePrefix(relativePath: string): string {
  return relativePath.split(/[\\/]/).slice(0, 2).join('/');
}

export async function validateCopySubmissionIntegrity(
  submission: CopySubmissionIntegrityInput,
): Promise<CopySubmissionIntegrityResult> {
  const issues: CopySubmissionIntegrityIssue[] = [];
  const studentCopyPages = submission.pages.filter(
    (page) => page.documentType === 'STUDENT_COPY',
  );

  if (studentCopyPages.length === 0) {
    issues.push({ code: 'STUDENT_COPY_MISSING' });
  }

  for (const page of submission.pages) {
    if (page.sizeBytes === null) {
      issues.push({ code: 'ORIGINAL_SIZE_MISSING', pageId: page.id });
    }
    if (!page.sha256) {
      issues.push({ code: 'ORIGINAL_SHA256_MISSING', pageId: page.id });
    }

    const bytes = await readSource(page.originalFilePath);
    if (!bytes) {
      issues.push({ code: 'ORIGINAL_FILE_UNAVAILABLE', pageId: page.id });
    } else {
      if (page.sizeBytes !== null && bytes.length !== page.sizeBytes) {
        issues.push({ code: 'ORIGINAL_SIZE_MISMATCH', pageId: page.id });
      }
      if (
        page.sha256 &&
        createHash('sha256').update(bytes).digest('hex') !== page.sha256.toLowerCase()
      ) {
        issues.push({ code: 'ORIGINAL_SHA256_MISMATCH', pageId: page.id });
      }
    }

    for (const convertedPath of page.convertedFilePaths) {
      if (
        submissionStoragePrefix(convertedPath) !==
        submissionStoragePrefix(page.originalFilePath)
      ) {
        issues.push({ code: 'CONVERTED_FILE_NOT_DERIVED', pageId: page.id });
        continue;
      }

      const convertedBytes = await readSource(convertedPath);
      if (!convertedBytes) {
        issues.push({ code: 'CONVERTED_FILE_UNAVAILABLE', pageId: page.id });
      }
    }
  }

  if (studentCopyPages.length > 0 || submission.storedFilePath) {
    const mirroredPage = studentCopyPages.find(
      (page) =>
        page.originalFilePath === submission.storedFilePath,
    );
    if (
      !mirroredPage ||
      mirroredPage.sizeBytes !== submission.fileSizeBytes ||
      mirroredPage.mimeType !== submission.mimeType
    ) {
      issues.push({ code: 'STORED_FILE_MIRROR_MISMATCH' });
    }
  }

  return { ok: issues.length === 0, issues };
}
