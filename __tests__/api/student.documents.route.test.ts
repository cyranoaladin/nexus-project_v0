/**
 * Student Documents API — Complete Test Suite
 *
 * Tests: GET /api/student/documents
 *
 * Source: app/api/student/documents/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { GET } from '@/app/api/student/documents/route';
import { auth } from '@/auth';

const mockAuth = auth as jest.Mock;

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

describe('GET /api/student/documents', () => {
  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Non autorisé');
  });

  it('should return 401 for non-ELEVE role', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'PARENT' } } as any);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('should return documents for authenticated student', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    prisma.userDocument.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        title: 'Bilan Maths',
        originalName: 'bilan.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12345,
        createdAt: new Date('2026-02-15'),
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.documents).toHaveLength(1);
    expect(body.documents[0].title).toBe('Bilan Maths');
    expect(prisma.userDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('should return empty array when no documents', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    prisma.userDocument.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.documents).toEqual([]);
  });

  it('should return 500 on DB error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);
    prisma.userDocument.findMany.mockRejectedValue(new Error('DB error'));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
