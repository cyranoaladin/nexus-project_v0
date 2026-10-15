import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/documents/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { scanPrivateBytes } from '@/lib/security/private-file-antivirus';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';

jest.mock('@/lib/security/private-file-antivirus', () => ({ scanPrivateBytes: jest.fn() }));
jest.mock('@/lib/security/private-file-write', () => ({ writePrivateFileExclusive: jest.fn((path, bytes) =>
  require('fs/promises').writeFile(path, bytes, { mode: 0o600, flag: 'wx' })) }));
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
    (scanPrivateBytes as jest.Mock).mockReset().mockResolvedValue({ clean: true, engine: 'synthetic-test-double' });
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

  it('refuses a Core-only uploader before parsing, writing or scanning legacy documents', async () => {
    (requireAnyRole as jest.Mock).mockResolvedValue({user:{id:'core-only-admin',role:'ADMIN',authority:'CORE_V2'}});
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const request=uploadRequest(mockFile('bulletin.pdf','application/pdf'));
    expect((await POST(request)).status).toBe(403);
    expect(request.formData).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(scanPrivateBytes).not.toHaveBeenCalled();
    expect(prisma.userDocument.create).not.toHaveBeenCalled();
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
    expect(scanPrivateBytes).not.toHaveBeenCalled();
    } finally { Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: previous }); }
  });

  it('scans before exclusive creation and never deletes a pre-existing file on collision', async () => {
    (writeFile as jest.Mock).mockRejectedValueOnce(new Error('EEXIST'));
    expect((await POST(uploadRequest(mockFile('bulletin.pdf', 'application/pdf')))).status).toBe(500);
    expect(scanPrivateBytes).toHaveBeenCalledTimes(1);
    expect(prisma.userDocument.create).not.toHaveBeenCalled();
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
    (scanPrivateBytes as jest.Mock).mockImplementation(async (clear: Buffer) => {
      expect(clear).toEqual(Buffer.from('%PDF-1.4'));
      expect(mkdir).not.toHaveBeenCalled();
      expect(writeFile).not.toHaveBeenCalled();
      expect(prisma.userDocument.create).not.toHaveBeenCalled();
      return { clean: true, engine: 'synthetic-test-double' };
    });
    const response = await POST(uploadRequest(mockFile('bulletin.pdf', 'application/pdf')));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalled();
    expect(scanPrivateBytes).toHaveBeenCalledTimes(1);
    expect(body.document).toEqual(expect.objectContaining({
      id: 'doc-secure-id',
      originalName: 'bulletin.pdf',
      mimeType: 'application/pdf',
    }));
    expect(JSON.stringify(body)).not.toContain('localPath');
    expect(JSON.stringify(body)).not.toContain('/app/storage');
  });

  it.each([
    ['MALWARE_DETECTED', 422, 'DOCUMENT_REJECTED'],
    ['AV_NOT_CONFIGURED', 503, 'DOCUMENT_SCAN_UNAVAILABLE'],
    ['AV_SCAN_TIMEOUT', 503, 'DOCUMENT_SCAN_UNAVAILABLE'],
  ])('refuses publication and removes only the new quarantine file when scanning fails: %s', async (reason, status, code) => {
    (scanPrivateBytes as jest.Mock).mockRejectedValue(new Error(reason));
    const response = await POST(uploadRequest(mockFile('bulletin.pdf', 'application/pdf')));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
    expect(prisma.userDocument.create).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(unlink).not.toHaveBeenCalled();
  });
});
