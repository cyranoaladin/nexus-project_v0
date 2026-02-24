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

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
}));

import { GET } from '@/app/api/documents/[id]/route';
import { auth } from '@/auth';
import { readFile } from 'fs/promises';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

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
    prisma.userDocument.findUnique.mockResolvedValue(null);

    const res = await GET(...makeRequest('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('should return 403 when user is not owner and not staff', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'other-user', role: 'ELEVE' } } as any);
    prisma.userDocument.findUnique.mockResolvedValue({
      id: 'doc-1', userId: 'u1', localPath: '/app/storage/documents/test.pdf',
      mimeType: 'application/pdf', originalName: 'test.pdf', sizeBytes: 1024,
    });

    const res = await GET(...makeRequest('doc-1'));
    expect(res.status).toBe(403);
  });

  it('should return document for owner', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    prisma.userDocument.findUnique.mockResolvedValue({
      id: 'doc-1', userId: 'u1', localPath: '/app/storage/documents/test.pdf',
      mimeType: 'application/pdf', originalName: 'test.pdf', sizeBytes: 1024,
    });
    mockReadFile.mockResolvedValue(Buffer.from('fake-pdf-content') as any);

    const res = await GET(...makeRequest('doc-1'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('test.pdf');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('should return document for ADMIN', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as any);
    prisma.userDocument.findUnique.mockResolvedValue({
      id: 'doc-1', userId: 'u1', localPath: '/app/storage/documents/test.pdf',
      mimeType: 'application/pdf', originalName: 'test.pdf', sizeBytes: 1024,
    });
    mockReadFile.mockResolvedValue(Buffer.from('fake-pdf-content') as any);

    const res = await GET(...makeRequest('doc-1'));
    expect(res.status).toBe(200);
  });

  it('should return document for ASSISTANTE', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'assist-1', role: 'ASSISTANTE' } } as any);
    prisma.userDocument.findUnique.mockResolvedValue({
      id: 'doc-1', userId: 'u1', localPath: '/app/storage/documents/test.pdf',
      mimeType: 'application/pdf', originalName: 'test.pdf', sizeBytes: 1024,
    });
    mockReadFile.mockResolvedValue(Buffer.from('fake-pdf-content') as any);

    const res = await GET(...makeRequest('doc-1'));
    expect(res.status).toBe(200);
  });

  it('should return 404 when file missing on disk', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    prisma.userDocument.findUnique.mockResolvedValue({
      id: 'doc-1', userId: 'u1', localPath: '/app/storage/documents/missing.pdf',
      mimeType: 'application/pdf', originalName: 'missing.pdf', sizeBytes: 1024,
    });
    mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

    const res = await GET(...makeRequest('doc-1'));
    expect(res.status).toBe(404);
  });

  it('should return 500 on DB error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    prisma.userDocument.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await GET(...makeRequest('doc-1'));
    expect(res.status).toBe(500);
  });
});
