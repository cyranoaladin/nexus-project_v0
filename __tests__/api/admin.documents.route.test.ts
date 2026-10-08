import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/documents/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { scanPrivateFile } from '@/lib/core-v2/diagnostics/virus-scan';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';

jest.mock('@/lib/core-v2/diagnostics/virus-scan', () => ({ scanPrivateFile: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({ guardSensitiveRateLimit: jest.fn() }));

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn((value: unknown) => value instanceof Response),
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn().mockReturnValue('doc-secure-id'),
}));

function mockFile(name: string, type: string, content = '%PDF-1.4') {
  return {
    name,
    type,
    size: Buffer.byteLength(content),
    arrayBuffer: jest.fn().mockResolvedValue(Uint8Array.from(Buffer.from(content)).buffer),
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
    method: 'POST', headers: new Headers({ Origin: 'https://nexusreussite.academy' }),
    formData: jest.fn().mockResolvedValue(formData),
  } as unknown as NextRequest;
}

describe('POST /api/admin/documents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (scanPrivateFile as jest.Mock).mockReset().mockResolvedValue({ clean: true, engine: 'synthetic-test-double' });
    (guardSensitiveRateLimit as jest.Mock).mockReset().mockResolvedValue(null);
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

  it.each(['csrf', 'rate'])('refuses %s before parsing or scanning', async kind => {
    const previous = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: 'development' });
    try {
    const request = uploadRequest(mockFile('bulletin.pdf', 'application/pdf'));
    if (kind === 'csrf') request.headers.set('Origin', 'https://attacker.example');
    else (guardSensitiveRateLimit as jest.Mock).mockResolvedValue(new Response('{}', { status: 429 }));
    expect((await POST(request)).status).toBe(kind === 'csrf' ? 403 : 429);
    expect(request.formData).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(scanPrivateFile).not.toHaveBeenCalled();
    } finally { Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: previous }); }
  });

  it('does not scan or delete a pre-existing file if exclusive creation fails', async () => {
    (writeFile as jest.Mock).mockRejectedValueOnce(new Error('EEXIST'));
    expect((await POST(uploadRequest(mockFile('bulletin.pdf', 'application/pdf')))).status).toBe(500);
    expect(scanPrivateFile).not.toHaveBeenCalled();
    expect(unlink).not.toHaveBeenCalled();
  });

  it('rejects unsupported MIME types before writing files', async () => {
    const response = await POST(uploadRequest(mockFile('bad.exe', 'application/x-msdownload', 'bad')));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Type ou taille de fichier invalide');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('stores an allowed file and returns a projection without localPath', async () => {
    (scanPrivateFile as jest.Mock).mockImplementation(async (filePath: string) => {
      expect(writeFile).toHaveBeenCalledWith(filePath, expect.any(Buffer), { mode: 0o600, flag: 'wx' });
      expect(prisma.userDocument.create).not.toHaveBeenCalled();
      return { clean: true, engine: 'synthetic-test-double' };
    });
    const response = await POST(uploadRequest(mockFile('bulletin.pdf', 'application/pdf')));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalled();
    expect(scanPrivateFile).toHaveBeenCalledTimes(1);
    expect(body.document).toEqual(expect.objectContaining({
      id: 'doc-secure-id',
      originalName: 'bulletin.pdf',
      mimeType: 'application/pdf',
    }));
    expect(JSON.stringify(body)).not.toContain('localPath');
    expect(JSON.stringify(body)).not.toContain('/app/storage');
  });

  it.each([
    ['MALWARE_DETECTED:synthetic-signature', 422, 'DOCUMENT_REJECTED'],
    ['AV_NOT_CONFIGURED', 503, 'DOCUMENT_SCAN_UNAVAILABLE'],
    ['AV_SCAN_TIMEOUT', 503, 'DOCUMENT_SCAN_UNAVAILABLE'],
  ])('refuses publication and removes only the new quarantine file when scanning fails: %s', async (reason, status, code) => {
    (scanPrivateFile as jest.Mock).mockRejectedValue(new Error(reason));
    const response = await POST(uploadRequest(mockFile('bulletin.pdf', 'application/pdf')));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
    expect(prisma.userDocument.create).not.toHaveBeenCalled();
    expect(unlink).toHaveBeenCalledWith((writeFile as jest.Mock).mock.calls[0][0]);
  });
});
