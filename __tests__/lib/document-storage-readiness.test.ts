/** @jest-environment node */
import { mkdir, mkdtemp, writeFile, symlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { probeDocumentStorageReadiness } from '@/lib/health/document-storage-readiness';
const originalEnv = process.env;
let root: string;
let release: string;
let documents: string;
beforeAll(async () => {
  const proofs = resolve('.artifacts/recovery'); await mkdir(proofs, { recursive: true });
  root = await mkdtemp(join(proofs, 'document-health-synthetic-'));
  release = join(root, 'release'); documents = join(root, 'documents');
  await Promise.all([mkdir(release), mkdir(documents, { mode: 0o700 })]);
});
beforeEach(() => { process.env = { ...originalEnv, NODE_ENV: 'production', DOCUMENT_STORAGE_ROOT: documents }; });
afterEach(() => { process.env = originalEnv; });
test('a persistent directory outside the immutable release passes without creating files', async () => {
  expect(await probeDocumentStorageReadiness(release)).toEqual({ ok: true, detail: 'directory-access-verified', scope: 'runtime' });
});
test('a missing root fails without publishing a filesystem path', async () => {
  process.env.DOCUMENT_STORAGE_ROOT = join(root, 'absent');
  const result = await probeDocumentStorageReadiness(release);
  expect(result).toEqual({ ok: false, detail: 'document-storage-unavailable', scope: 'runtime' });
  expect(JSON.stringify(result).includes(root)).toBe(false);
});
test('an ordinary file cannot satisfy directory readiness', async () => {
  const file = join(root, 'synthetic-file'); await writeFile(file, 'synthetic'); process.env.DOCUMENT_STORAGE_ROOT = file;
  expect((await probeDocumentStorageReadiness(release)).ok).toBe(false);
});
test('production does not qualify storage inside or containing the active release', async () => {
  process.env.DOCUMENT_STORAGE_ROOT = release;
  expect((await probeDocumentStorageReadiness(release)).detail).toBe('document-storage-overlaps-release');
  process.env.DOCUMENT_STORAGE_ROOT = root;
  expect((await probeDocumentStorageReadiness(release)).ok).toBe(false);
});
test('production rejects absent configuration instead of using a release-relative default', async () => {
  delete process.env.DOCUMENT_STORAGE_ROOT;
  expect((await probeDocumentStorageReadiness(release)).ok).toBe(false);
});

test('a read-only synthetic directory cannot be qualified as writable storage', async () => {
  const readonly = join(root, 'readonly'); await mkdir(readonly, { mode: 0o500 }); process.env.DOCUMENT_STORAGE_ROOT = readonly;
  expect((await probeDocumentStorageReadiness(release)).ok).toBe(false);
});
test('a configured symlink cannot disguise storage inside the immutable release', async () => {
  const alias = join(root, 'release-alias'); await symlink(release, alias); process.env.DOCUMENT_STORAGE_ROOT = alias;
  expect((await probeDocumentStorageReadiness(release)).detail).toBe('document-storage-overlaps-release');
});

test('a missing cwd is reported as unavailable instead of escaping the probe boundary', async () => {
  const cwd = jest.spyOn(process, 'cwd').mockImplementation(() => { throw new Error('synthetic-private-cwd-detail'); });
  const result = await probeDocumentStorageReadiness().finally(() => cwd.mockRestore());
  expect(result).toEqual({ ok: false, detail: 'document-storage-unavailable', scope: 'runtime' });
});
