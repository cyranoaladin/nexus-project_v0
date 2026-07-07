import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/documents/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn((value: unknown) => value instanceof Response),
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn().mockReturnValue('doc-secure-id'),
}));

function mockFile(name: string, type: string, content = '%PDF-1.4') {
  return {
    name,
    type,
    size: Buffer.byteLength(content),
    arrayBuffer: jest.fn().mockResolvedValue(Buffer.from(content).buffer),
  } as unknown as File;
}

function uploadRequest(file: File, userId = 'user-1') {
  const formData = {
    get: jest.fn((key: string) => {
      if (key === 'file') return file;
      if (key === 'userId') return userId;
      return null;
    }),
  };
  return {
    formData: jest.fn().mockResolvedValue(formData),
  } as unknown as NextRequest;
}

describe('POST /api/admin/documents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAnyRole as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });
    (isErrorResponse as unknown as jest.Mock).mockImplementation((value: unknown) => value instanceof Response);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (prisma.userDocument.create as jest.Mock).mockResolvedValue({
      id: 'doc-secure-id',
      title: 'bulletin.pdf',
      originalName: 'bulletin.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 8,
      localPath: '/app/storage/documents/doc-secure-id.pdf',
      userId: 'user-1',
      uploadedById: 'admin-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  it('requires ADMIN or ASSISTANTE role', async () => {
    const guardResponse = new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    (requireAnyRole as jest.Mock).mockResolvedValue(guardResponse);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);

    const response = await POST(uploadRequest(mockFile('bulletin.pdf', 'application/pdf')));

    expect(response.status).toBe(403);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects unsupported MIME types before writing files', async () => {
    const response = await POST(uploadRequest(mockFile('bad.exe', 'application/x-msdownload', 'bad')));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Type ou taille de fichier invalide');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('stores an allowed file and returns a projection without localPath', async () => {
    const response = await POST(uploadRequest(mockFile('bulletin.pdf', 'application/pdf')));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalled();
    expect(body.document).toEqual(expect.objectContaining({
      id: 'doc-secure-id',
      originalName: 'bulletin.pdf',
      mimeType: 'application/pdf',
    }));
    expect(JSON.stringify(body)).not.toContain('localPath');
    expect(JSON.stringify(body)).not.toContain('/app/storage');
  });
});
