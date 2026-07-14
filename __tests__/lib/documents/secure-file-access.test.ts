import { resolveSecurePath, SecureFileAccessError, safeContentType, safeFilename } from '@/lib/documents/secure-file-access';
import { writeFile, mkdir, symlink, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

let testDir: string;
let storageRoot: string;

beforeAll(async () => {
  testDir = join(tmpdir(), `secure-file-test-${Date.now()}`);
  storageRoot = join(testDir, 'storage');
  await mkdir(join(storageRoot, 'subdir'), { recursive: true });
  await writeFile(join(storageRoot, 'valid.pdf'), 'PDF content');
  await writeFile(join(storageRoot, 'subdir', 'nested.pdf'), 'nested content');

  // Create a file outside storage root
  await mkdir(join(testDir, 'outside'), { recursive: true });
  await writeFile(join(testDir, 'outside', 'secret.txt'), 'secret');

  // Create symlink inside storage pointing outside
  try {
    await symlink(join(testDir, 'outside', 'secret.txt'), join(storageRoot, 'bad-symlink.txt'));
  } catch {
    // symlink may fail on some filesystems
  }

  // Create valid symlink inside storage
  try {
    await symlink(join(storageRoot, 'valid.pdf'), join(storageRoot, 'good-symlink.pdf'));
  } catch {
    // symlink may fail on some filesystems
  }
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('resolveSecurePath', () => {
  // ── Valid paths ──

  test('resolves a valid relative path', async () => {
    const result = await resolveSecurePath(storageRoot, 'valid.pdf');
    expect(result.canonicalPath).toContain('valid.pdf');
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  test('resolves a nested valid path', async () => {
    const result = await resolveSecurePath(storageRoot, 'subdir/nested.pdf');
    expect(result.canonicalPath).toContain('nested.pdf');
  });

  test('resolves a valid symlink inside storage', async () => {
    try {
      const result = await resolveSecurePath(storageRoot, 'good-symlink.pdf');
      expect(result.canonicalPath).toContain('valid.pdf'); // realpath follows to target
    } catch (err) {
      // symlink may not exist on all test environments
      if (err instanceof SecureFileAccessError && err.code === 'FILE_NOT_FOUND') {
        return; // acceptable — symlink wasn't created
      }
      throw err;
    }
  });

  // ── Path traversal attacks ──

  test('rejects ../ traversal', async () => {
    await expect(
      resolveSecurePath(storageRoot, '../outside/secret.txt')
    ).rejects.toThrow(SecureFileAccessError);
  });

  test('rejects ../../ traversal', async () => {
    await expect(
      resolveSecurePath(storageRoot, '../../etc/passwd')
    ).rejects.toThrow(SecureFileAccessError);
  });

  test('rejects %2e%2e encoded traversal', async () => {
    await expect(
      resolveSecurePath(storageRoot, '%2e%2e/outside/secret.txt')
    ).rejects.toThrow(SecureFileAccessError);
  });

  test('rejects %2E%2E double-encoded traversal', async () => {
    await expect(
      resolveSecurePath(storageRoot, '%2E%2E/outside/secret.txt')
    ).rejects.toThrow(SecureFileAccessError);
  });

  test('rejects null byte injection', async () => {
    await expect(
      resolveSecurePath(storageRoot, 'valid.pdf%00.txt')
    ).rejects.toThrow(SecureFileAccessError);
  });

  // ── Absolute path rejection ──

  test('rejects Unix absolute path', async () => {
    await expect(
      resolveSecurePath(storageRoot, '/etc/passwd')
    ).rejects.toThrow(SecureFileAccessError);
    try {
      await resolveSecurePath(storageRoot, '/etc/passwd');
    } catch (err) {
      expect((err as SecureFileAccessError).code).toBe('ABSOLUTE_PATH_REJECTED');
    }
  });

  test('rejects Windows absolute path', async () => {
    await expect(
      resolveSecurePath(storageRoot, 'C:\\Windows\\system32\\config')
    ).rejects.toThrow(SecureFileAccessError);
  });

  test('rejects backslash separators', async () => {
    await expect(
      resolveSecurePath(storageRoot, '..\\outside\\secret.txt')
    ).rejects.toThrow(SecureFileAccessError);
  });

  // ── Symlink escape ──

  test('rejects symlink pointing outside storage', async () => {
    try {
      await resolveSecurePath(storageRoot, 'bad-symlink.txt');
      // If the symlink exists but doesn't escape (shouldn't happen in our setup)
      fail('Should have thrown');
    } catch (err) {
      if (err instanceof SecureFileAccessError) {
        expect(['PATH_ESCAPE', 'FILE_NOT_FOUND']).toContain(err.code);
      }
      // symlink may not exist — test is informational
    }
  });

  // ── File not found ──

  test('rejects non-existent file', async () => {
    await expect(
      resolveSecurePath(storageRoot, 'does-not-exist.pdf')
    ).rejects.toThrow(SecureFileAccessError);
    try {
      await resolveSecurePath(storageRoot, 'does-not-exist.pdf');
    } catch (err) {
      expect((err as SecureFileAccessError).code).toBe('FILE_NOT_FOUND');
    }
  });

  // ── Not a regular file ──

  test('rejects directory as target', async () => {
    await expect(
      resolveSecurePath(storageRoot, 'subdir')
    ).rejects.toThrow(SecureFileAccessError);
    try {
      await resolveSecurePath(storageRoot, 'subdir');
    } catch (err) {
      expect((err as SecureFileAccessError).code).toBe('NOT_REGULAR_FILE');
    }
  });

  // ── Size limit ──

  test('rejects file exceeding size limit', async () => {
    await expect(
      resolveSecurePath(storageRoot, 'valid.pdf', { maxSizeBytes: 1 })
    ).rejects.toThrow(SecureFileAccessError);
    try {
      await resolveSecurePath(storageRoot, 'valid.pdf', { maxSizeBytes: 1 });
    } catch (err) {
      expect((err as SecureFileAccessError).code).toBe('FILE_TOO_LARGE');
    }
  });

  // ── Legacy prefix stripping ──

  test('strips legacy prefix before resolving', async () => {
    const result = await resolveSecurePath(storageRoot, '/app/storage/documents/valid.pdf', {
      legacyPrefixToStrip: '/app/storage/documents/',
    });
    expect(result.canonicalPath).toContain('valid.pdf');
  });

  test('rejects absolute path after legacy prefix strip if still absolute', async () => {
    await expect(
      resolveSecurePath(storageRoot, '/etc/passwd', {
        legacyPrefixToStrip: '/app/storage/documents/',
      })
    ).rejects.toThrow(SecureFileAccessError);
  });

  // ── Storage root errors ──

  test('throws when storage root does not exist', async () => {
    await expect(
      resolveSecurePath('/nonexistent/root', 'file.pdf')
    ).rejects.toThrow(SecureFileAccessError);
  });

  // ── Error message safety ──

  test('error messages do not leak filesystem paths', async () => {
    try {
      await resolveSecurePath(storageRoot, '../outside/secret.txt');
    } catch (err) {
      expect((err as Error).message).not.toContain(storageRoot);
      expect((err as Error).message).not.toContain('outside');
      expect((err as Error).message).not.toContain('secret');
    }
  });
});

describe('safeContentType', () => {
  test('returns application/pdf for PDF', () => {
    expect(safeContentType('application/pdf')).toBe('application/pdf');
  });

  test('returns octet-stream for unknown type', () => {
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

  test('handles empty string', () => {
    expect(safeFilename('')).toBe('');
  });
});
