import { NextRequest, NextResponse } from 'next/server';
import { GET, PUT } from '@/app/api/bilans/[id]/route';
import { GET as EXPORT_GET } from '@/app/api/bilans/[id]/export/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockIsErrorResponse = isErrorResponse as unknown as jest.Mock;

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET' });
}

function makePutRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/bilans/bilan-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function params(id = 'bilan-1') {
  return { params: Promise.resolve({ id }) };
}

describe('/api/bilans/[id] — ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsErrorResponse.mockReturnValue(false);
  });

  it('scopes parent reads to published bilans for their own children', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', email: 'parent@test.local' },
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeRequest('/api/bilans/bilan-1'), params());

    expect(res.status).toBe(404);
    expect(prisma.bilan.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'bilan-1',
        isPublished: true,
        student: { is: { parent: { userId: 'parent-1' } } },
      },
    }));
  });

  it('does not return internal Nexus fields to a parent with access', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', email: 'parent@test.local' },
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      studentName: 'Eleve',
      parentsMarkdown: 'Parent view',
      nexusMarkdown: 'Internal Nexus notes',
      errorDetails: 'provider stack trace',
      sourceData: { raw: true },
      analysisJson: { internal: true },
    });

    const res = await GET(makeRequest('/api/bilans/bilan-1'), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.parentsMarkdown).toBe('Parent view');
    expect(body.data.nexusMarkdown).toBeUndefined();
    expect(body.data.errorDetails).toBeUndefined();
    expect(body.data.sourceData).toBeUndefined();
    expect(body.data.analysisJson).toBeUndefined();
  });

  it('requires a coach-owned or assigned bilan before update', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'coach-user-1', role: 'COACH', email: 'coach@test.local' },
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await PUT(makePutRequest({ status: 'COMPLETED' }), params());

    expect(res.status).toBe(404);
    expect(prisma.bilan.update).not.toHaveBeenCalled();
    expect(prisma.bilan.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'bilan-1',
        OR: expect.any(Array),
      }),
    }));
  });

  it('does not export Nexus markdown to parent audience=all', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', email: 'parent@test.local' },
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      publicShareId: 'public-1',
      type: 'ASSESSMENT_QCM',
      subject: 'MATHS',
      studentName: 'Eleve',
      studentEmail: 'eleve@test.local',
      studentMarkdown: 'Student view',
      parentsMarkdown: 'Parent view',
      nexusMarkdown: 'Internal Nexus notes',
      globalScore: 80,
      confidenceIndex: 70,
      status: 'COMPLETED',
      isPublished: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    });

    const res = await EXPORT_GET(
      makeRequest('/api/bilans/bilan-1/export?format=markdown&audience=all'),
      params()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.content).toEqual({ parents: 'Parent view' });
  });

  it('denies Nexus audience export to parent', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', email: 'parent@test.local' },
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      publicShareId: 'public-1',
      type: 'ASSESSMENT_QCM',
      subject: 'MATHS',
      studentName: 'Eleve',
      studentEmail: 'eleve@test.local',
      studentMarkdown: 'Student view',
      parentsMarkdown: 'Parent view',
      nexusMarkdown: 'Internal Nexus notes',
      globalScore: 80,
      confidenceIndex: 70,
      status: 'COMPLETED',
      isPublished: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    });

    const res = await EXPORT_GET(
      makeRequest('/api/bilans/bilan-1/export?format=markdown&audience=nexus'),
      params()
    );

    expect(res.status).toBe(404);
  });

  it('returns guard response unchanged when auth fails', async () => {
    const denied = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mockRequireAnyRole.mockResolvedValue(denied);
    mockIsErrorResponse.mockReturnValue(true);

    const res = await GET(makeRequest('/api/bilans/bilan-1'), params());

    expect(res.status).toBe(403);
    expect(prisma.bilan.findFirst).not.toHaveBeenCalled();
  });
});
