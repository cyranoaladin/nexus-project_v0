import { posix } from 'node:path';

import type { OfficialPdfMetadata } from './official-pdfs';

const INVALID_METADATA_MESSAGE = 'Invalid official PDF path metadata';

function failInvalidMetadata(): never {
  throw new Error(INVALID_METADATA_MESSAGE);
}

export function resolveOfficialPdfRelativePath(
  metadata: OfficialPdfMetadata,
): string {
  const { baseDir, filename } = metadata;

  if (
    baseDir.length === 0 ||
    filename.length === 0 ||
    baseDir.includes('\\') ||
    filename.includes('\\') ||
    baseDir.includes('\0') ||
    filename.includes('\0')
  ) {
    failInvalidMetadata();
  }

  if (baseDir !== 'programmes' && !baseDir.startsWith('programmes/')) {
    failInvalidMetadata();
  }

  const baseSegments = baseDir.split('/');
  if (
    baseSegments.some(
      (segment) => segment.length === 0 || segment === '.' || segment === '..',
    )
  ) {
    failInvalidMetadata();
  }

  if (
    filename === '.' ||
    filename === '..' ||
    filename.includes('/') ||
    posix.isAbsolute(filename)
  ) {
    failInvalidMetadata();
  }

  const relativePath = posix.join(...baseSegments.slice(1), filename);
  if (
    relativePath.length === 0 ||
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    posix.isAbsolute(relativePath)
  ) {
    failInvalidMetadata();
  }

  return relativePath;
}
