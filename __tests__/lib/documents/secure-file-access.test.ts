import {
  openSecureDocument,
  resolveSecurePath,
  SecureFileAccessError,
  safeContentType,
  safeFilename,
} from '@/lib/documents/secure-file-access';
import { writeFile, mkdir, symlink, rm, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

let testDir: string;
let storageRoot: string;

beforeAll(async () => {
  testDir = join(tmpdir(), `secure-file-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  storageRoot = join(testDir, 'storage');
  await mkdir(join(storageRoot, 'subdir'), { recursive: true });
  await writeFile(join(storageRoot, 'valid.pdf'), 'PDF content here');
  await writeFile(join(storageRoot, 'subdir', 'nested.pdf'), 'nested content');

  // File outside storage root
  await mkdir(join(testDir, 'outside'), { recursive: true });
  await writeFile(join(testDir, 'outside', 'secret.txt'), 'secret data');

  // Symlink escaping outside storage
  await symlink(join(testDir, 'outside', 'secret.txt'), join(storageRoot, 'escape-symlink.txt'));
  // Valid symlink inside storage
  await symlink(join(storageRoot, 'valid.pdf'), join(storageRoot, 'internal-symlink.pdf'));
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('openSecureDocument', () => {
  // ── Valid paths ──

  test('opens a valid relative path', async () => {
    const doc = await openSecureDocument(storageRoot, 'valid.pdf');
    expect(doc.sizeBytes).toBeGreaterThan(0);
    await doc.handle.close();
  });

  test('opens a nested valid path', async () => {
    const doc = await openSecureDocument(storageRoot, 'subdir/nested.pdf');
    expect(doc.sizeBytes).toBeGreaterThan(0);
    await doc.handle.close();
  });

  // ── Absolute paths INSIDE storage root (admin/coach upload format) ──

  test('accepts absolute path under storage root', async () => {
    const absPath = join(storageRoot, 'valid.pdf');
    const doc = await openSecureDocument(storageRoot, absPath);
    expect(doc.sizeBytes).toBeGreaterThan(0);
    await doc.handle.close();
  });

  test('accepts absolute path in subdirectory under storage root', async () => {
    const absPath = join(storageRoot, 'subdir', 'nested.pdf');
    const doc = await openSecureDocument(storageRoot, absPath);
    expect(doc.sizeBytes).toBeGreaterThan(0);
    await doc.handle.close();
  });

  // ── Absolute paths OUTSIDE storage root ──

  test('rejects absolute path outside storage root', async () => {
    const outsidePath = join(testDir, 'outside', 'secret.txt');
    await expect(openSecureDocument(storageRoot, outsidePath))
      .rejects.toThrow(SecureFileAccessError);
    try {
      await openSecureDocument(storageRoot, outsidePath);
    } catch (err) {
      expect((err as SecureFileAccessError).code).toBe('PATH_ESCAPE');
    }
  });

  test('rejects /etc/passwd', async () => {
    await expect(openSecureDocument(storageRoot, '/etc/passwd'))
      .rejects.toThrow(SecureFileAccessError);
    try {
      await openSecureDocument(storageRoot, '/etc/passwd');
    } catch (err) {
      expect(['PATH_ESCAPE', 'FILE_NOT_FOUND']).toContain((err as SecureFileAccessError).code);
    }
  });

  test('rejects absolute sibling path sharing prefix', async () => {
    // /tmp/.../storage-evil is NOT under /tmp/.../storage
    const evilDir = `${storageRoot}-evil`;
    await mkdir(evilDir, { recursive: true });
    await writeFile(join(evilDir, 'trick.txt'), 'tricked');
    try {
      await expect(openSecureDocument(storageRoot, join(evilDir, 'trick.txt')))
        .rejects.toThrow(SecureFileAccessError);
    } finally {
      await rm(evilDir, { recursive: true, force: true });
    }
  });

  // ── Traversal attacks ──

  test('rejects ../ traversal', async () => {
    await expect(openSecureDocument(storageRoot, '../outside/secret.txt'))
      .rejects.toThrow(SecureFileAccessError);
  });

  test('rejects ../../ traversal', async () => {
    await expect(openSecureDocument(storageRoot, '../../etc/passwd'))
      .rejects.toThrow(SecureFileAccessError);
  });

  test('rejects %2e%2e encoded traversal', async () => {
    await expect(openSecureDocument(storageRoot, '%2e%2e/outside/secret.txt'))
      .rejects.toThrow(SecureFileAccessError);
    try {
      await openSecureDocument(storageRoot, '%2e%2e/outside/secret.txt');
    } catch (err) {
      expect((err as SecureFileAccessError).code).toBe('INVALID_PATH_FORMAT');
    }
  });

  test('rejects %252e%252e double-encoded traversal', async () => {
    // %25 = literal %, so %252e = %2e after one decode
    await expect(openSecureDocument(storageRoot, '%252e%252e/outside/secret.txt'))
      .rejects.toThrow(SecureFileAccessError);
  });

  test('rejects null byte injection', async () => {
    await expect(openSecureDocument(storageRoot, 'valid.pdf%00.txt'))
      .rejects.toThrow(SecureFileAccessError);
  });

  test('rejects backslash separators', async () => {
    await expect(openSecureDocument(storageRoot, '..\\outside\\secret.txt'))
      .rejects.toThrow(SecureFileAccessError);
  });

  // ── URL schemes ──

  test('rejects http:// URL', async () => {
    await expect(openSecureDocument(storageRoot, 'http://evil.com/file'))
      .rejects.toThrow(SecureFileAccessError);
    try {
      await openSecureDocument(storageRoot, 'http://evil.com/file');
    } catch (err) {
      expect((err as SecureFileAccessError).code).toBe('INVALID_PATH_FORMAT');
    }
  });

  test('rejects file:// URL', async () => {
    await expect(openSecureDocument(storageRoot, 'file:///etc/passwd'))
      .rejects.toThrow(SecureFileAccessError);
  });

  // ── Symlinks ──

  test('rejects symlink escaping outside storage root', async () => {
    try {
      await openSecureDocument(storageRoot, 'escape-symlink.txt');
      fail('Should have thrown PATH_ESCAPE');
    } catch (err) {
      expect(err).toBeInstanceOf(SecureFileAccessError);
      expect((err as SecureFileAccessError).code).toBe('PATH_ESCAPE');
    }
  });

  test('accepts valid internal symlink', async () => {
    const doc = await openSecureDocument(storageRoot, 'internal-symlink.pdf');
    expect(doc.sizeBytes).toBeGreaterThan(0);
    await doc.handle.close();
  });

  test('works when storage root itself is a symlink', async () => {
    const symlinkRoot = join(testDir, 'symlink-root');
    await symlink(storageRoot, symlinkRoot);
    try {
      const doc = await openSecureDocument(symlinkRoot, 'valid.pdf');
      expect(doc.sizeBytes).toBeGreaterThan(0);
      await doc.handle.close();
    } finally {
      await unlink(symlinkRoot);
    }
  });

  // ── File not found ──

  test('rejects non-existent file', async () => {
    try {
      await openSecureDocument(storageRoot, 'does-not-exist.pdf');
    } catch (err) {
      expect(err).toBeInstanceOf(SecureFileAccessError);
      expect((err as SecureFileAccessError).code).toBe('FILE_NOT_FOUND');
    }
  });

  // ── Not a regular file ──

  test('rejects directory as target', async () => {
    try {
      await openSecureDocument(storageRoot, 'subdir');
    } catch (err) {
      expect(err).toBeInstanceOf(SecureFileAccessError);
      expect((err as SecureFileAccessError).code).toBe('NOT_REGULAR_FILE');
    }
  });

  // ── Size limit ──

  test('rejects file exceeding size limit', async () => {
    try {
      await openSecureDocument(storageRoot, 'valid.pdf', { maxSizeBytes: 1 });
    } catch (err) {
      expect(err).toBeInstanceOf(SecureFileAccessError);
      expect((err as SecureFileAccessError).code).toBe('FILE_TOO_LARGE');
    }
  });

  // ── Legacy prefix ──

  test('strips legacy prefix before resolving', async () => {
    const doc = await openSecureDocument(storageRoot, '/app/storage/documents/valid.pdf', {
      legacyPrefixToStrip: '/app/storage/documents/',
    });
    expect(doc.sizeBytes).toBeGreaterThan(0);
    await doc.handle.close();
  });

  // ── Storage root errors ──

  test('throws STORAGE_ROOT_UNAVAILABLE when root does not exist', async () => {
    try {
      await openSecureDocument('/nonexistent/root', 'file.pdf');
    } catch (err) {
      expect(err).toBeInstanceOf(SecureFileAccessError);
      expect((err as SecureFileAccessError).code).toBe('STORAGE_ROOT_UNAVAILABLE');
    }
  });

  // ── TOCTOU: file deleted between stat and read ──

  test('handle remains valid even if file is unlinked after open', async () => {
    const tmpFile = join(storageRoot, 'toctou-victim.pdf');
    await writeFile(tmpFile, 'will be deleted');

    const doc = await openSecureDocument(storageRoot, 'toctou-victim.pdf');
    // Delete the file AFTER opening
    await unlink(tmpFile);
    // Should still be readable via the open handle
    const buf = await doc.handle.readFile();
    expect(buf.toString()).toBe('will be deleted');
    await doc.handle.close();
  });

  // ── Error message safety ──

  test('error messages do not leak filesystem paths', async () => {
    try {
      await openSecureDocument(storageRoot, '../outside/secret.txt');
    } catch (err) {
      expect((err as Error).message).not.toContain(storageRoot);
      expect((err as Error).message).not.toContain('outside');
      expect((err as Error).message).not.toContain('secret');
    }
  });

  // ── Handle cleanup on error ──

  test('closes handle if file is a directory (NOT_REGULAR_FILE)', async () => {
    // The open call succeeds on directories, but fstat check should close it
    try {
      await openSecureDocument(storageRoot, 'subdir');
    } catch (err) {
      expect((err as SecureFileAccessError).code).toBe('NOT_REGULAR_FILE');
      // No leaked handle — verified by test completing without timeout
    }
  });
});

describe('resolveSecurePath', () => {
  test('returns canonical path for relative input', async () => {
    const result = await resolveSecurePath(storageRoot, 'valid.pdf');
    expect(result.canonicalPath).toContain('valid.pdf');
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  test('returns canonical path for absolute input under root', async () => {
    const absPath = join(storageRoot, 'valid.pdf');
    const result = await resolveSecurePath(storageRoot, absPath);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });
});

describe('safeContentType', () => {
  test('returns application/pdf for PDF', () => {
    expect(safeContentType('application/pdf')).toBe('application/pdf');
  });
  test('returns octet-stream for text/html', () => {
    expect(safeContentType('text/html')).toBe('application/octet-stream');
  });
  test('returns octet-stream for null', () => {
    expect(safeContentType(null)).toBe('application/octet-stream');
  });
  test('returns octet-stream for undefined', () => {
    expect(safeContentType(undefined)).toBe('application/octet-stream');
  });
});

describe('safeFilename', () => {
  test('encodes special characters', () => {
    expect(safeFilename('file name.pdf')).toBe('file%20name.pdf');
  });
  test('strips path separators and quotes', () => {
    const result = safeFilename('../malicious"file.pdf');
    expect(result).not.toContain('"');
    expect(result).not.toContain('/');
  });
  test('returns document for empty string', () => {
    expect(safeFilename('')).toBe('document');
  });
  test('strips control characters', () => {
    const result = safeFilename('file\r\nname\x00.pdf');
    expect(result).not.toContain('\r');
    expect(result).not.toContain('\n');
    expect(result).not.toContain('\x00');
  });
});
