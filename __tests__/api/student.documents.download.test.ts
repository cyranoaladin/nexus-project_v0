import { GET } from '@/app/api/student/documents/[id]/download/route';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
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
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue(mockEleveSession);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
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
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'nexus-test-'));
    const tmpFile = path.join(tmpDir, 'fiche.pdf');
    await writeFile(tmpFile, Buffer.from('%PDF-1.4 fake content'));

    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'doc-1',
      originalName: 'fiche revision.pdf',
      mimeType: 'application/pdf',
      localPath: tmpFile,
    });

    const response = await GET({} as any, makeParams('doc-1'));

    await unlink(tmpFile).catch(() => null);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('returns 500 when file does not exist on disk', async () => {
    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'doc-1',
      originalName: 'missing.pdf',
      mimeType: 'application/pdf',
      localPath: '/tmp/nexus-nonexistent-file-that-should-never-exist.pdf',
    });

    const response = await GET({} as any, makeParams('doc-1'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('File unavailable');
  });

  it('falls back to application/octet-stream when mimeType is null', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'nexus-test-'));
    const tmpFile = path.join(tmpDir, 'export.bin');
    await writeFile(tmpFile, Buffer.from('\x00\x01\x02'));

    (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({
      id: 'doc-2',
      originalName: 'export.bin',
      mimeType: null,
      localPath: tmpFile,
    });

    const response = await GET({} as any, makeParams('doc-2'));

    await unlink(tmpFile).catch(() => null);

    expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
  });
});
