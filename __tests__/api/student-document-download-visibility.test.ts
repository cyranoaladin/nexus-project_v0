import { Readable } from 'node:stream';
import { NextRequest } from 'next/server';
import { DocumentVisibilityScope } from '@prisma/client';
import { GET } from '@/app/api/student/documents/[id]/download/route';
import { prisma } from '@/lib/prisma';
import { openSecureDocument } from '@/lib/documents/secure-file-access';
import { STUDENT_DOCUMENT_SCOPES } from '@/lib/documents/student-visibility';
jest.mock('@/lib/guards', () => ({ requireRole: jest.fn().mockResolvedValue({ user: { id: 'synthetic-student', role: 'ELEVE' } }), isErrorResponse: jest.fn().mockReturnValue(false) }));
jest.mock('@/lib/prisma', () => ({ prisma: { userDocument: { findUnique: jest.fn(), findFirst: jest.fn() } } }));
jest.mock('@/lib/documents/storage-root', () => ({ getDocumentStorageRoot: () => '/synthetic-storage', LEGACY_STORAGE_PREFIX: '/synthetic-legacy/' }));
jest.mock('@/lib/documents/secure-file-access', () => ({
  ...jest.requireActual('@/lib/documents/secure-file-access'), openSecureDocument: jest.fn(),
}));
const request = () => new NextRequest('http://localhost/api/student/documents/synthetic-document/download');
const context = { params: Promise.resolve({ id: 'synthetic-document' }) };
const document = { id: 'synthetic-document', userId: 'synthetic-student', originalName: 'synthetic.pdf', mimeType: 'application/pdf', localPath: 'synthetic.pdf', unavailableReason: null, sizeBytes: 9 };
beforeEach(() => {
  jest.clearAllMocks();
  (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue(document);
  (openSecureDocument as jest.Mock).mockResolvedValue({ handle: { createReadStream: () => Readable.from(Buffer.from('synthetic')), close: jest.fn().mockResolvedValue(undefined) }, sizeBytes: 9 });
});
it('refuses an owned ADMIN_ONLY document before private file metadata or storage', async () => {
  (prisma.userDocument.findUnique as jest.Mock).mockResolvedValue({ id: document.id, userId: document.userId, visibilityScope: DocumentVisibilityScope.ADMIN_ONLY, user: { id: document.userId, student: { id: 'synthetic-profile' } } });
  const response = await GET(request(), context);
  expect(response.status).toBe(404);
  expect(prisma.userDocument.findFirst).not.toHaveBeenCalled();
  expect(openSecureDocument).not.toHaveBeenCalled();
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it.each(STUDENT_DOCUMENT_SCOPES)('serves the owned %s scope through a guarded metadata read', async visibilityScope => {
  (prisma.userDocument.findUnique as jest.Mock).mockResolvedValue({ id: document.id, userId: document.userId, visibilityScope, user: { id: document.userId, student: { id: 'synthetic-profile' } } });
  const response = await GET(request(), context);
  expect(response.status).toBe(200);
  expect(prisma.userDocument.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: document.id, userId: document.userId, visibilityScope } }));
  expect(await response.text()).toBe('synthetic');
});
it('does not open a tombstoned file or expose its internal reason', async () => {
  (prisma.userDocument.findUnique as jest.Mock).mockResolvedValue({ id: document.id, userId: document.userId, visibilityScope: DocumentVisibilityScope.STUDENT_ONLY, user: { id: document.userId, student: null } });
  (prisma.userDocument.findFirst as jest.Mock).mockResolvedValue({ ...document, unavailableReason: 'SYNTHETIC_PRIVATE_STORAGE_CANARY' });
  const response = await GET(request(), context);
  expect(response.status).toBe(410);
  expect(openSecureDocument).not.toHaveBeenCalled();
  expect(await response.text()).not.toContain('SYNTHETIC_PRIVATE_STORAGE_CANARY');
});

it('denies another owner before private metadata and file access', async () => {
  (prisma.userDocument.findUnique as jest.Mock).mockResolvedValue({ id: document.id, userId: 'synthetic-other-student', visibilityScope: DocumentVisibilityScope.STUDENT_ONLY, user: { id: 'synthetic-other-student', student: null } });
  const response = await GET(request(), context);
  expect(response.status).toBe(404);
  expect(prisma.userDocument.findFirst).not.toHaveBeenCalled();
  expect(openSecureDocument).not.toHaveBeenCalled();
});
it('does not log or serialize an authority driver exception', async () => {
  (prisma.userDocument.findUnique as jest.Mock).mockRejectedValueOnce(new Error('SYNTHETIC_PRIVATE_AUTHORITY_CANARY'));
  const logging = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const response = await GET(request(), context);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('SYNTHETIC_PRIVATE_AUTHORITY_CANARY');
    expect(logging).toHaveBeenCalledWith('STUDENT_DOCUMENT_AUTHORITY_READ_FAILED');
    expect(JSON.stringify(logging.mock.calls)).not.toContain('SYNTHETIC_PRIVATE_AUTHORITY_CANARY');
    expect(openSecureDocument).not.toHaveBeenCalled();
  } finally { logging.mockRestore(); }
});
