import { GET, PUT } from '@/app/api/eleve/nsi-pratique-2026/progress/route';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

const mockRequireRole = jest.fn();
jest.mock('@/lib/guards', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  isErrorResponse: (v: unknown) => v instanceof NextResponse,
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    nsiPracticeProgress: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

const mockCanAccessNsiPratique = jest.fn();
jest.mock('@/lib/nsi-pratique-2026/access', () => ({
  canAccessNsiPratique: (...args: unknown[]) => mockCanAccessNsiPratique(...args),
}));

function makePutRequest(body: unknown, contentLength?: string): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (contentLength) headers.set('content-length', contentLength);
  return new NextRequest('http://localhost/api/eleve/nsi-pratique-2026/progress', {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
}

const eleveSession = { user: { id: 'u1', role: 'ELEVE' } };

describe('GET /api/eleve/nsi-pratique-2026/progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanAccessNsiPratique.mockResolvedValue(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not ELEVE', async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns 403 when ELEVE is outside NSI pratique access scope', async () => {
    mockRequireRole.mockResolvedValue(eleveSession);
    mockCanAccessNsiPratique.mockResolvedValue(false);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('NSI pratique');
    expect(prisma.nsiPracticeProgress.findUnique).not.toHaveBeenCalled();
  });

  it('returns null data when no progress exists', async () => {
    mockRequireRole.mockResolvedValue(eleveSession);
    (prisma.nsiPracticeProgress.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
    expect(body.updatedAt).toBeNull();
  });

  it('returns progress data when it exists', async () => {
    const mockDate = new Date('2026-05-16T10:00:00Z');
    mockRequireRole.mockResolvedValue(eleveSession);
    (prisma.nsiPracticeProgress.findUnique as jest.Mock).mockResolvedValue({
      data: { subjects: { 1: { status: 'mastered' } } },
      updatedAt: mockDate,
      version: 1,
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.subjects['1'].status).toBe('mastered');
    expect(body.updatedAt).toBe('2026-05-16T10:00:00.000Z');
    expect(body.version).toBe(1);
  });
});

describe('GET /api/eleve/nsi-pratique-2026/progress — RBAC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanAccessNsiPratique.mockResolvedValue(true);
  });

  it('coach cannot access student progress route', async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('userId always comes from session, never from client', async () => {
    mockRequireRole.mockResolvedValue(eleveSession);
    (prisma.nsiPracticeProgress.findUnique as jest.Mock).mockResolvedValue(null);

    await GET();

    expect(prisma.nsiPracticeProgress.findUnique).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { data: true, updatedAt: true, version: true },
    });
  });
});

describe('PUT /api/eleve/nsi-pratique-2026/progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanAccessNsiPratique.mockResolvedValue(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
    const res = await PUT(makePutRequest({ data: {} }));
    expect(res.status).toBe(401);
  });

  it('returns 413 when content-length exceeds limit', async () => {
    mockRequireRole.mockResolvedValue(eleveSession);
    const res = await PUT(makePutRequest({ data: {} }, '300000'));
    expect(res.status).toBe(413);
  });

  it('returns 403 on save when ELEVE is outside NSI pratique access scope', async () => {
    mockRequireRole.mockResolvedValue(eleveSession);
    mockCanAccessNsiPratique.mockResolvedValue(false);

    const res = await PUT(makePutRequest({ data: { subjects: {} } }));

    expect(res.status).toBe(403);
    expect(prisma.nsiPracticeProgress.upsert).not.toHaveBeenCalled();
  });

  it('returns 400 when data is missing', async () => {
    mockRequireRole.mockResolvedValue(eleveSession);
    const res = await PUT(makePutRequest({ notData: true }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('non-null object');
  });

  it('returns 400 when data is an array', async () => {
    mockRequireRole.mockResolvedValue(eleveSession);
    const res = await PUT(makePutRequest({ data: [1, 2, 3] }));
    expect(res.status).toBe(400);
  });

  it('userId in upsert always comes from session, not client body', async () => {
    const mockDate = new Date('2026-05-16T11:00:00Z');
    mockRequireRole.mockResolvedValue(eleveSession);
    (prisma.nsiPracticeProgress.upsert as jest.Mock).mockResolvedValue({ updatedAt: mockDate });

    // Client attempts to send a userId in body — should be ignored
    const res = await PUT(makePutRequest({ data: { subjects: {} }, userId: 'other-user-id' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    // The upsert uses session.user.id, not the client-supplied userId
    expect(prisma.nsiPracticeProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } })
    );
  });

  it('upserts progress successfully', async () => {
    const mockDate = new Date('2026-05-16T11:00:00Z');
    mockRequireRole.mockResolvedValue(eleveSession);
    (prisma.nsiPracticeProgress.upsert as jest.Mock).mockResolvedValue({
      updatedAt: mockDate,
    });

    const progressData = { subjects: { 1: { status: 'in_progress' } } };
    const res = await PUT(makePutRequest({ data: progressData }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.updatedAt).toBe('2026-05-16T11:00:00.000Z');
    // Validated data includes defaults for missing keys
    expect(prisma.nsiPracticeProgress.upsert).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      update: { data: expect.objectContaining({ subjects: { 1: { status: 'in_progress' } } }) },
      create: { userId: 'u1', data: expect.objectContaining({ subjects: { 1: { status: 'in_progress' } } }) },
    });
  });
});
