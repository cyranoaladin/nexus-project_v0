import { access, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, relative, sep } from 'node:path';
import { getDocumentStorageRoot } from '@/lib/documents/storage-root';

export interface DocumentStorageReadiness {
  ok: boolean;
  detail: string;
  scope: 'runtime';
}
function atOrBelow(parent: string, target: string): boolean {
  const value = relative(parent, target);
  return value === '' || (!isAbsolute(value) && value !== '..' && !value.startsWith(`..${sep}`));
}
/** Read-only, bounded by a single configured root: no mkdir, scan, upload, or legacy traversal. */
export async function probeDocumentStorageReadiness(releaseRoot?: string): Promise<DocumentStorageReadiness> {
  try {
    const root = await realpath(getDocumentStorageRoot());
    const metadata = await stat(root);
    if (!metadata.isDirectory() || (metadata.mode & 0o222) === 0) {
      return { ok: false, detail: 'document-storage-unavailable', scope: 'runtime' };
    }
    if (process.env.NODE_ENV === 'production') {
      const release = await realpath(releaseRoot ?? process.cwd());
      if (atOrBelow(release, root) || atOrBelow(root, release)) {
        return { ok: false, detail: 'document-storage-overlaps-release', scope: 'runtime' };
      }
    }
    await access(root, constants.R_OK | constants.W_OK | constants.X_OK);
    return { ok: true, detail: 'directory-access-verified', scope: 'runtime' };
  } catch {
    return { ok: false, detail: 'document-storage-unavailable', scope: 'runtime' };
  }
}
