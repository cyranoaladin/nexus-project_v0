/**
 * Admin Documents API — Complete Test Suite
 *
 * Tests: POST /api/admin/documents
 *
 * Source: app/api/admin/documents/route.ts
 *
 * Note: FormData parsing via NextRequest hangs in Jest's jsdom environment.
 * We test RBAC enforcement directly and mock request.formData() for the rest.
 */

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  stat: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  stat: jest.fn(),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn().mockReturnValue('mock-cuid-123'),
}));

import { POST } from '@/app/api/admin/documents/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { NextRequest, NextResponse } from 'next/server';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockIsErrorResponse = isErrorResponse as unknown as jest.Mock;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

/**
 * Build a NextRequest with a mocked formData() method to avoid jsdom timeout.
 */
function makeRequest(formDataMap: Record<string, unknown>): NextRequest {
  const req = new NextRequest('http://localhost:3000/api/admin/documents', { method: 'POST' });
  (req as any).formData = jest.fn().mockResolvedValue({
    get: (key: string) => formDataMap[key] ?? null,
  });
  return req;
}

describe('POST /api/admin/documents', () => {
  it('should return 403 for unauthorized role', async () => {
    const errorRes = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mockRequireAnyRole.mockResolvedValue(errorRes as any);
    mockIsErrorResponse.mockReturnValue(true);

    const req = makeRequest({ userId: 'u1', file: new File(['x'], 'test.pdf') });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('should return 400 when file or userId missing', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockIsErrorResponse.mockReturnValue(false);

    const req = makeRequest({ userId: 'u1' }); // no file
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('File');
  });

  it('should return 404 when target user not found', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockIsErrorResponse.mockReturnValue(false);
    prisma.user.findUnique.mockResolvedValue(null);

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const req = makeRequest({ userId: 'nonexistent', file });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('user not found');
  });

  it('should upload document successfully', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockIsErrorResponse.mockReturnValue(false);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@t.com' });
    prisma.userDocument.create.mockResolvedValue({
      id: 'mock-cuid-123',
      title: 'test.pdf',
      originalName: 'test.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 7,
      localPath: '/app/storage/documents/mock-cuid-123.pdf',
      userId: 'u1',
      uploadedById: 'a1',
    });

    const fakeFile = {
      name: 'test.pdf',
      type: 'application/pdf',
      size: 7,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(7)),
    };
    const req = makeRequest({ userId: 'u1', file: fakeFile });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe('mock-cuid-123');
    expect(body.originalName).toBe('test.pdf');
  });

  it('should return 500 on internal error', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockIsErrorResponse.mockReturnValue(false);
    prisma.user.findUnique.mockRejectedValue(new Error('DB error'));

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const req = makeRequest({ userId: 'u1', file });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
