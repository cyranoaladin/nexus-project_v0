import { GET } from '@/app/api/student/documents/[id]/download/route';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { writeFile, unlink, mkdtemp, mkdir } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    userDocument: { findFirst: jest.fn() },
  },
}));

// Mock storage root to point to our temp directory
let testStorageRoot: string;
jest.mock('@/lib/documents/storage-root', () => ({
  getDocumentStorageRoot: () => testStorageRoot,
  LEGACY_STORAGE_PREFIX: '/app/storage/documents/',
}));

const mockEleveSession = {
  user: { id: 'user-eleve-1', email: 'eleve@test.com', role: 'ELEVE' as const },
};

const mockUnauthorizedResponse = {
  status: 401,
  json: async () => ({ error: 'Unauthorized' }),
  headers: new Headers(),
};

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/student/documents/[id]/download', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue(mockEleveSession);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
    testStorageRoot = await mkdtemp(path.join(os.tmpdir(), 'nexus-doc-test-'));
  });

  it('returns 401 when unauthenticated', async () => {
    (requireRole as jest.Mock).mockResolvedValue(mockUnauthorizedResponse);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);

    const response = await GET({} as any, makeParams('doc-1'));
    expect(response.status).toBe(401);
  });

  it('returns 404 when document not found for this user', async () => {
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await GET({} as any, makeParams('doc-nonexistent'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Not found');
  });

  it('enforces ownership — queries with authenticated userId', async () => {
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue(null);

    await GET({} as any, makeParams('doc-other-user'));

    expect(prisma.userDocument.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-eleve-1',
        }),
      })
    );
  });

  it('streams file with correct Content-Type and Content-Disposition', async () => {
    const tmpFile = path.join(testStorageRoot, 'fiche.pdf');
    await writeFile(tmpFile, Buffer.from('%PDF-1.4 fake content'));

    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'doc-1',
      originalName: 'fiche revision.pdf',
      mimeType: 'application/pdf',
      localPath: 'fiche.pdf', // relative to storage root
    });

    const response = await GET({} as any, makeParams('doc-1'));

    await unlink(tmpFile).catch(() => null);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('returns 404 when file does not exist on disk', async () => {
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'doc-1',
      originalName: 'missing.pdf',
      mimeType: 'application/pdf',
      localPath: 'nonexistent-file.pdf',
    });

    const response = await GET({} as any, makeParams('doc-1'));
    const body = await response.json();

    // SecureFileAccessError with FILE_NOT_FOUND → 404
    expect(response.status).toBe(404);
    expect(body.error).toBe('File unavailable');
  });

  it('falls back to application/octet-stream when mimeType is null', async () => {
    const tmpFile = path.join(testStorageRoot, 'export.bin');
    await writeFile(tmpFile, Buffer.from('\x00\x01\x02'));

    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'doc-2',
      originalName: 'export.bin',
      mimeType: null,
      localPath: 'export.bin',
    });

    const response = await GET({} as any, makeParams('doc-2'));

    await unlink(tmpFile).catch(() => null);

    expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
  });

  it('rejects path traversal attempts via localPath', async () => {
    // Even if a malicious localPath ends up in DB
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'doc-evil',
      originalName: 'evil.pdf',
      mimeType: 'application/pdf',
      localPath: '../../../etc/passwd',
    });

    const response = await GET({} as any, makeParams('doc-evil'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('File unavailable');
  });

  it('rejects absolute path in localPath', async () => {
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'doc-abs',
      originalName: 'abs.pdf',
      mimeType: 'application/pdf',
      localPath: '/etc/passwd',
    });

    const response = await GET({} as any, makeParams('doc-abs'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('File unavailable');
  });

  it('handles legacy /app/storage/documents/ prefix', async () => {
    const tmpFile = path.join(testStorageRoot, 'legacy.pdf');
    await writeFile(tmpFile, Buffer.from('%PDF legacy'));

    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'doc-legacy',
      originalName: 'legacy.pdf',
      mimeType: 'application/pdf',
      localPath: '/app/storage/documents/legacy.pdf',
    });

    const response = await GET({} as any, makeParams('doc-legacy'));

    await unlink(tmpFile).catch(() => null);

    expect(response.status).toBe(200);
  });

  describe('Coach resource ownership (Lot C)', () => {
    it('allows student to download self-uploaded document', async () => {
      const tmpFile = path.join(testStorageRoot, 'self-uploaded.pdf');
      await writeFile(tmpFile, Buffer.from('%PDF-1.4 self uploaded'));

      (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
        id: 'doc-self',
        originalName: 'my-upload.pdf',
        mimeType: 'application/pdf',
        localPath: 'self-uploaded.pdf',
        userId: 'user-eleve-1',
        uploadedById: 'user-eleve-1',
      });

      const response = await GET({} as any, makeParams('doc-self'));

      await unlink(tmpFile).catch(() => null);

      expect(response.status).toBe(200);
    });

    it('allows student to download coach-uploaded resource', async () => {
      const tmpFile = path.join(testStorageRoot, 'coach-resource.pdf');
      await writeFile(tmpFile, Buffer.from('%PDF-1.4 coach uploaded'));

      (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
        id: 'doc-coach',
        originalName: 'coach-resource.pdf',
        mimeType: 'application/pdf',
        localPath: 'coach-resource.pdf',
        userId: 'user-eleve-1',
        uploadedById: 'coach-user-123',
        uploadedBy: { role: 'COACH' },
      });

      const response = await GET({} as any, makeParams('doc-coach'));

      await unlink(tmpFile).catch(() => null);

      expect(response.status).toBe(200);
    });

    it('denies access when student tries to download another student document', async () => {
      (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await GET({} as any, makeParams('doc-other-student'));
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Not found');
    });

    it('verifies ownership is enforced via userId not uploadedById', async () => {
      (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue(null);

      await GET({} as any, makeParams('doc-not-recipient'));

      expect(prisma.userDocument.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-eleve-1',
          }),
        })
      );
    });
  });
});
