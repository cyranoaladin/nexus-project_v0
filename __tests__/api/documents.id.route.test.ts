/**
 * Documents [id] API — Test Suite
 * Tests: GET /api/documents/[id]
 */
import { Readable } from 'stream';

jest.mock('@/auth', () => ({ auth: jest.fn() }));

jest.mock('@/lib/documents/storage-root', () => ({
  getDocumentStorageRoot: () => '/mock/storage',
  LEGACY_STORAGE_PREFIX: '/app/storage/documents/',
}));

jest.mock('@/lib/documents/secure-file-access', () => {
  class SecureFileAccessError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; this.name = 'SecureFileAccessError'; }
  }
  return {
    openSecureDocument: jest.fn(),
    SecureFileAccessError,
    safeContentType: (m: string | null) => m || 'application/octet-stream',
    safeFilename: (n: string) => n || 'document',
  };
});

import { GET } from '@/app/api/documents/[id]/route';
import { auth } from '@/auth';
import { openSecureDocument, SecureFileAccessError } from '@/lib/documents/secure-file-access';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;
const mockOpen = openSecureDocument as jest.Mock;

function makeHandle() {
  return {
    handle: {
      createReadStream: () => Readable.from(Buffer.from('content')),
      close: jest.fn().mockResolvedValue(undefined),
    },
    sizeBytes: 7,
  };
}

let prisma: any;
beforeEach(async () => {
  prisma = (await import('@/lib/prisma') as any).prisma;
  jest.clearAllMocks();
  mockOpen.mockResolvedValue(makeHandle());
});

function req(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  return [new NextRequest(`http://localhost/api/documents/${id}`), { params: Promise.resolve({ id }) }];
}

function mockDoc(doc: unknown) {
  prisma.userDocument.findFirst.mockResolvedValue(doc);
}

describe('GET /api/documents/[id]', () => {
  it('401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    expect((await GET(...req('x'))).status).toBe(401);
  });

  it('404 when not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } });
    mockDoc(null);
    expect((await GET(...req('x'))).status).toBe(404);
  });

  it('404 when non-staff non-owner', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u2', role: 'ELEVE' } });
    mockDoc({ id: 'd1', userId: 'u1', localPath: 'f.pdf', mimeType: 'application/pdf', originalName: 'f.pdf', sizeBytes: 100 });
    expect((await GET(...req('d1'))).status).toBe(404);
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it('200 for owner', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } });
    mockDoc({ id: 'd1', userId: 'u1', localPath: 'f.pdf', mimeType: 'application/pdf', originalName: 'f.pdf', sizeBytes: 100 });
    const r = await GET(...req('d1'));
    expect(r.status).toBe(200);
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(r.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('200 for ADMIN (any doc)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin', role: 'ADMIN' } });
    mockDoc({ id: 'd1', userId: 'u1', localPath: 'f.pdf', mimeType: 'application/pdf', originalName: 'f.pdf', sizeBytes: 100 });
    expect((await GET(...req('d1'))).status).toBe(200);
  });

  it('200 for ASSISTANTE (any doc)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ASSISTANTE' } });
    mockDoc({ id: 'd1', userId: 'u1', localPath: 'f.pdf', mimeType: 'application/pdf', originalName: 'f.pdf', sizeBytes: 100 });
    expect((await GET(...req('d1'))).status).toBe(200);
  });

  it('404 on PATH_ESCAPE', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } });
    mockDoc({ id: 'd1', userId: 'u1', localPath: '../etc/passwd', mimeType: 'application/pdf', originalName: 'x', sizeBytes: 1 });
    mockOpen.mockRejectedValue(new SecureFileAccessError('PATH_ESCAPE', 'escape'));
    expect((await GET(...req('d1'))).status).toBe(404);
  });

  it('404 on FILE_NOT_FOUND', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } });
    mockDoc({ id: 'd1', userId: 'u1', localPath: 'gone.pdf', mimeType: 'application/pdf', originalName: 'x', sizeBytes: 1 });
    mockOpen.mockRejectedValue(new SecureFileAccessError('FILE_NOT_FOUND', 'gone'));
    expect((await GET(...req('d1'))).status).toBe(404);
  });

  it('does not log filesystem paths', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } });
    mockDoc({ id: 'd1', userId: 'u1', localPath: 'secret/private.pdf', mimeType: 'application/pdf', originalName: 'x', sizeBytes: 1 });
    mockOpen.mockRejectedValue(new SecureFileAccessError('FILE_NOT_FOUND', 'gone'));
    await GET(...req('d1'));
    const logs = JSON.stringify(spy.mock.calls);
    expect(logs).not.toContain('secret/private');
    spy.mockRestore();
  });

  it('500 on DB error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } });
    prisma.userDocument.findFirst.mockRejectedValue(new Error('DB'));
    expect((await GET(...req('d1'))).status).toBe(500);
  });
});
