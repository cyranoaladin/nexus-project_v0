import { join } from 'path';

const env = process.env as Record<string, string | undefined>;

// Reset module state between tests
beforeEach(() => {
  jest.resetModules();
  delete env.DOCUMENT_STORAGE_ROOT;
  delete env.NODE_ENV;
});

describe('getDocumentStorageRoot', () => {
  test('returns DOCUMENT_STORAGE_ROOT when set in production', () => {
    env.NODE_ENV = 'production';
    env.DOCUMENT_STORAGE_ROOT = '/var/www/nexus-shared/storage/documents';
    const { getDocumentStorageRoot } = require('@/lib/documents/storage-root');
    expect(getDocumentStorageRoot()).toBe('/var/www/nexus-shared/storage/documents');
  });

  test('throws in production when DOCUMENT_STORAGE_ROOT is missing', () => {
    env.NODE_ENV = 'production';
    const { getDocumentStorageRoot } = require('@/lib/documents/storage-root');
    expect(() => getDocumentStorageRoot()).toThrow('DOCUMENT_STORAGE_ROOT is required in production');
  });

  test('throws in production when DOCUMENT_STORAGE_ROOT is relative', () => {
    env.NODE_ENV = 'production';
    env.DOCUMENT_STORAGE_ROOT = 'storage/documents';
    const { getDocumentStorageRoot } = require('@/lib/documents/storage-root');
    expect(() => getDocumentStorageRoot()).toThrow('must be an absolute path');
  });

  test('falls back to cwd/storage/documents in development', () => {
    env.NODE_ENV = 'development';
    const { getDocumentStorageRoot } = require('@/lib/documents/storage-root');
    const root = getDocumentStorageRoot();
    expect(root).toContain('storage');
    expect(root).toContain('documents');
  });

  test('uses DOCUMENT_STORAGE_ROOT in development when set', () => {
    env.NODE_ENV = 'development';
    env.DOCUMENT_STORAGE_ROOT = '/tmp/test-storage';
    const { getDocumentStorageRoot } = require('@/lib/documents/storage-root');
    expect(getDocumentStorageRoot()).toBe('/tmp/test-storage');
  });
});

describe('toRelativeStoragePath', () => {
  test('converts absolute path to relative', () => {
    env.NODE_ENV = 'test';
    env.DOCUMENT_STORAGE_ROOT = '/var/storage';
    const { toRelativeStoragePath } = require('@/lib/documents/storage-root');
    expect(toRelativeStoragePath('/var/storage/user1/file.pdf')).toBe(join('user1', 'file.pdf'));
  });

  test('handles simple filename', () => {
    env.NODE_ENV = 'test';
    env.DOCUMENT_STORAGE_ROOT = '/var/storage';
    const { toRelativeStoragePath } = require('@/lib/documents/storage-root');
    expect(toRelativeStoragePath('/var/storage/file.pdf')).toBe('file.pdf');
  });

  test('throws when path is outside storage root', () => {
    env.NODE_ENV = 'test';
    env.DOCUMENT_STORAGE_ROOT = '/var/storage';
    const { toRelativeStoragePath } = require('@/lib/documents/storage-root');
    expect(() => toRelativeStoragePath('/etc/passwd')).toThrow('not under the document storage root');
  });

  test('throws on traversal attempt', () => {
    env.NODE_ENV = 'test';
    env.DOCUMENT_STORAGE_ROOT = '/var/storage';
    const { toRelativeStoragePath } = require('@/lib/documents/storage-root');
    expect(() => toRelativeStoragePath('/var/storage/../etc/passwd')).toThrow('not under');
  });
});
