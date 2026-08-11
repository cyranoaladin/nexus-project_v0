import { inspectNpcStorageFile } from './storage-root';

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

async function inspectSource(relativePath: string): Promise<{
  sizeBytes: number;
  sha256: string;
} | null> {
  try {
    return await inspectNpcStorageFile(relativePath);
  } catch {
    return null;
  }
}

function submissionStoragePrefix(relativePath: string): string {
  return relativePath.split(/[\\/]/).slice(0, 2).join('/');
}

function isCanonicalConvertedPath(
  sourcePath: string,
  convertedPath: string,
  convertedIndex: number,
): boolean {
  const expectedPrefix = submissionStoragePrefix(sourcePath);
  const expectedFilename = `page-${convertedIndex + 1}`;
  const segments = convertedPath.split('/');
  if (segments.length !== 4 || segments[2] !== 'page_0') return false;
  const filename = segments[3];
  const separator = filename.lastIndexOf('.');
  if (separator < 1) return false;
  const base = filename.slice(0, separator);
  const extension = filename.slice(separator + 1);
  return (
    segments.slice(0, 2).join('/') === expectedPrefix &&
    base === expectedFilename &&
    ['webp', 'jpg', 'png'].includes(extension)
  );
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

    const source = await inspectSource(page.originalFilePath);
    if (!source) {
      issues.push({ code: 'ORIGINAL_FILE_UNAVAILABLE', pageId: page.id });
    } else {
      if (page.sizeBytes !== null && source.sizeBytes !== page.sizeBytes) {
        issues.push({ code: 'ORIGINAL_SIZE_MISMATCH', pageId: page.id });
      }
      if (
        page.sha256 &&
        source.sha256 !== page.sha256.toLowerCase()
      ) {
        issues.push({ code: 'ORIGINAL_SHA256_MISMATCH', pageId: page.id });
      }
    }

    for (const [convertedIndex, convertedPath] of page.convertedFilePaths.entries()) {
      if (!isCanonicalConvertedPath(
        page.originalFilePath,
        convertedPath,
        convertedIndex,
      )) {
        issues.push({ code: 'CONVERTED_FILE_NOT_DERIVED', pageId: page.id });
        continue;
      }

      const converted = await inspectSource(convertedPath);
      if (!converted) {
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
