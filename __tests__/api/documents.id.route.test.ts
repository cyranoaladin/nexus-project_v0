/**
 * Documents [id] API — Complete Test Suite
 *
 * Tests: GET /api/documents/[id]
 *
 * Source: app/api/documents/[id]/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/documents/secure-file-access', () => ({
  resolveSecurePath: jest.fn(),
  SecureFileAccessError: class SecureFileAccessError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'SecureFileAccessError';
    }
  },
}));

jest.mock('@/lib/documents/storage-root', () => ({
  getDocumentStorageRoot: () => '/mock/storage/root',
  LEGACY_STORAGE_PREFIX: '/app/storage/documents/',
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
}));

import { GET } from '@/app/api/documents/[id]/route';
import { auth } from '@/auth';
import { readFile } from 'fs/promises';
import { resolveSecurePath, SecureFileAccessError } from '@/lib/documents/secure-file-access';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;
const mockReadFile = readFile as jest.Mock;
const mockResolveSecurePath = resolveSecurePath as jest.Mock;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
  // Default: resolveSecurePath succeeds and returns a safe path
  mockResolveSecurePath.mockResolvedValue({ canonicalPath: '/mock/storage/root/file.pdf', sizeBytes: 1024 });
});

function mockDocumentLookup(document: unknown) {
  prisma.userDocument.findUnique.mockResolvedValue(document);
  prisma.userDocument.findFirst.mockResolvedValue(document);
}

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3000/api/documents/${id}`, { method: 'GET' });
  return [req, { params: Promise.resolve({ id }) }];
}

describe('GET /api/documents/[id]', () => {
  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await GET(...makeRequest('doc-1'));
    expect(res.status).toBe(401);
  });

  it('should return 404 when document not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    mockDocumentLookup(null);

    const res = await GET(...makeRequest('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('should return 404 when user is not owner and not staff without reading file', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'other-user', role: 'ELEVE' } } as any);
    mockDocumentLookup({
      id: 'doc-1', userId: 'u1', localPath: 'test.pdf',
      mimeType: 'application/pdf', originalName: 'test.pdf', sizeBytes: 1024,
    });

    const res = await GET(...makeRequest('doc-1'));
    expect(res.status).toBe(404);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('should return document for owner', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    mockDocumentLookup({
      id: 'doc-1', userId: 'u1', localPath: 'test.pdf',
      mimeType: 'application/pdf', originalName: 'test.pdf', sizeBytes: 1024,
    });
    mockReadFile.mockResolvedValue(Buffer.from('fake-pdf-content') as any);

    const res = await GET(...makeRequest('doc-1'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('test.pdf');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('should return document for ADMIN', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as any);
    mockDocumentLookup({
      id: 'doc-1', userId: 'u1', localPath: 'test.pdf',
      mimeType: 'application/pdf', originalName: 'test.pdf', sizeBytes: 1024,
    });
    mockReadFile.mockResolvedValue(Buffer.from('fake-pdf-content') as any);

    const res = await GET(...makeRequest('doc-1'));
    expect(res.status).toBe(200);
  });

  it('should return document for ASSISTANTE', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'assist-1', role: 'ASSISTANTE' } } as any);
    mockDocumentLookup({
      id: 'doc-1', userId: 'u1', localPath: 'test.pdf',
      mimeType: 'application/pdf', originalName: 'test.pdf', sizeBytes: 1024,
    });
    mockReadFile.mockResolvedValue(Buffer.from('fake-pdf-content') as any);

    const res = await GET(...makeRequest('doc-1'));
    expect(res.status).toBe(200);
  });

  it('should return 404 when containment check fails (path traversal)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    mockDocumentLookup({
      id: 'doc-1', userId: 'u1', localPath: '../../../etc/passwd',
      mimeType: 'application/pdf', originalName: 'evil.pdf', sizeBytes: 1024,
    });
    mockResolveSecurePath.mockRejectedValue(
      new SecureFileAccessError('PATH_ESCAPE', 'Path escapes storage root')
    );

    const res = await GET(...makeRequest('doc-1'));
    expect(res.status).toBe(404);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('should return 404 when file missing on disk', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    mockDocumentLookup({
      id: 'doc-1', userId: 'u1', localPath: 'missing.pdf',
      mimeType: 'application/pdf', originalName: 'missing.pdf', sizeBytes: 1024,
    });
    mockResolveSecurePath.mockRejectedValue(
      new SecureFileAccessError('FILE_NOT_FOUND', 'File does not exist')
    );

    const res = await GET(...makeRequest('doc-1'));
    expect(res.status).toBe(404);
  });

  it('should not log local file paths when containment fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    mockDocumentLookup({
      id: 'doc-1', userId: 'u1', localPath: '/app/storage/documents/private/missing.pdf',
      mimeType: 'application/pdf', originalName: 'missing.pdf', sizeBytes: 1024,
    });
    mockResolveSecurePath.mockRejectedValue(
      new SecureFileAccessError('FILE_NOT_FOUND', 'File does not exist')
    );

    const res = await GET(...makeRequest('doc-1'));

    expect(res.status).toBe(404);
    const serializedLogs = JSON.stringify(errorSpy.mock.calls);
    expect(serializedLogs).not.toContain('/app/storage');
    expect(serializedLogs).not.toContain('private/missing.pdf');
    errorSpy.mockRestore();
  });

  it('should return 500 on DB error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    prisma.userDocument.findUnique.mockRejectedValue(new Error('DB error'));
    prisma.userDocument.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await GET(...makeRequest('doc-1'));
    expect(res.status).toBe(500);
  });
});
