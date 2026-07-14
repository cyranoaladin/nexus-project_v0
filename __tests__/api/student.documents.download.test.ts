import { Readable } from 'stream';

jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: { userDocument: { findFirst: jest.fn() } },
}));

jest.mock('@/lib/documents/storage-root', () => ({
  getDocumentStorageRoot: () => '/mock/storage',
  LEGACY_STORAGE_PREFIX: '/app/storage/documents/',
}));

// Use manual mock with lazy handle creation
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

import { GET } from '@/app/api/student/documents/[id]/download/route';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { openSecureDocument, SecureFileAccessError } from '@/lib/documents/secure-file-access';

const mockOpenSecure = openSecureDocument as jest.Mock;

function makeSuccessHandle() {
  return {
    handle: {
      createReadStream: () => Readable.from(Buffer.from('pdf-content')),
      close: jest.fn().mockResolvedValue(undefined),
    },
    sizeBytes: 11,
  };
}

const mockSession = { user: { id: 'u1', email: 'e@test.com', role: 'ELEVE' as const } };
const mock401 = { status: 401, json: async () => ({ error: 'Unauthorized' }), headers: new Headers() };

function params(id: string) { return { params: Promise.resolve({ id }) }; }

describe('GET /api/student/documents/[id]/download', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue(mockSession);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
    mockOpenSecure.mockResolvedValue(makeSuccessHandle());
  });

  it('returns 401 when unauthenticated', async () => {
    (requireRole as jest.Mock).mockResolvedValue(mock401);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);
    expect((await GET({} as any, params('x'))).status).toBe(401);
  });

  it('returns 404 when document not found', async () => {
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue(null);
    const r = await GET({} as any, params('x'));
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: 'Not found' });
  });

  it('enforces userId ownership in query', async () => {
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue(null);
    await GET({} as any, params('x'));
    expect(prisma.userDocument.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) })
    );
  });

  it('streams file with correct headers on success', async () => {
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'd1', originalName: 'fiche.pdf', mimeType: 'application/pdf', localPath: 'fiche.pdf',
    });
    const r = await GET({} as any, params('d1'));
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Disposition')).toContain('attachment');
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(r.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('rejects path traversal via containment', async () => {
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'evil', originalName: 'x.pdf', mimeType: 'application/pdf', localPath: '../../../etc/passwd',
    });
    mockOpenSecure.mockRejectedValue(new SecureFileAccessError('PATH_ESCAPE', 'escape'));
    const r = await GET({} as any, params('evil'));
    expect(r.status).toBe(404);
  });

  it('rejects absolute path outside root', async () => {
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'abs', originalName: 'x.pdf', mimeType: 'application/pdf', localPath: '/etc/shadow',
    });
    mockOpenSecure.mockRejectedValue(new SecureFileAccessError('PATH_ESCAPE', 'outside'));
    expect((await GET({} as any, params('abs'))).status).toBe(404);
  });

  it('accepts absolute path INSIDE storage root', async () => {
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'ok', originalName: 'admin.pdf', mimeType: 'application/pdf',
      localPath: '/mock/storage/admin.pdf',
    });
    expect((await GET({} as any, params('ok'))).status).toBe(200);
  });

  it('returns 404 when file missing', async () => {
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'd1', originalName: 'x.pdf', mimeType: 'application/pdf', localPath: 'gone.pdf',
    });
    mockOpenSecure.mockRejectedValue(new SecureFileAccessError('FILE_NOT_FOUND', 'gone'));
    expect((await GET({} as any, params('d1'))).status).toBe(404);
  });

  it('passes legacy prefix to openSecureDocument', async () => {
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'leg', originalName: 'x.pdf', mimeType: 'application/pdf',
      localPath: '/app/storage/documents/old.pdf',
    });
    await GET({} as any, params('leg'));
    expect(mockOpenSecure).toHaveBeenCalledWith(
      '/mock/storage', '/app/storage/documents/old.pdf',
      expect.objectContaining({ legacyPrefixToStrip: '/app/storage/documents/' }),
    );
  });

  it('denies other student document', async () => {
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue(null);
    expect((await GET({} as any, params('other'))).status).toBe(404);
  });
});
