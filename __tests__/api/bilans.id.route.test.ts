import { NextRequest, NextResponse } from 'next/server';
import { GET, PUT } from '@/app/api/bilans/[id]/route';
import { GET as EXPORT_GET, POST as EXPORT_POST } from '@/app/api/bilans/[id]/export/route';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { notifyParentPeriodicBilanPublished } from '@/lib/aria/notifications/notify-parent-periodic-bilan-published';

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

jest.mock('@/lib/aria/notifications/notify-parent-periodic-bilan-published', () => ({
  notifyParentPeriodicBilanPublished: jest.fn(),
}));

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockIsErrorResponse = isErrorResponse as unknown as jest.Mock;
const mockNotifyParentPeriodicBilanPublished = notifyParentPeriodicBilanPublished as jest.Mock;

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

  it('rejects unsafe bilan ids before querying', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.local' },
    });

    const res = await GET(makeRequest('/api/bilans/../secret'), params('../secret'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Données');
    expect(prisma.bilan.findFirst).not.toHaveBeenCalled();
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

  it('rejects unknown update fields before mutating a bilan', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.local' },
    });

    const res = await PUT(makePutRequest({ status: 'COMPLETED', metadata: { raw: true } }), params());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Données');
    expect(prisma.bilan.findFirst).not.toHaveBeenCalled();
    expect(prisma.bilan.update).not.toHaveBeenCalled();
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

  it('rejects unsupported export audience before loading the bilan', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.local' },
    });

    const res = await EXPORT_GET(
      makeRequest('/api/bilans/bilan-1/export?format=markdown&audience=raw'),
      params()
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Données');
    expect(prisma.bilan.findFirst).not.toHaveBeenCalled();
  });

  it('rejects unsupported export generation formats before loading the bilan', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.local' },
    });

    const res = await EXPORT_POST(
      new NextRequest('http://localhost:3000/api/bilans/bilan-1/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'zip' }),
      }),
      params()
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Données');
    expect(prisma.bilan.findFirst).not.toHaveBeenCalled();
  });

  it('refuses to publish an ARIA_PERIODIC bilan with no recorded review', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'assistante-1', role: 'ASSISTANTE', email: 'assistante@test.local' },
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      type: 'ARIA_PERIODIC',
      isPublished: false,
      reviewDecision: null,
    });

    const res = await PUT(makePutRequest({ isPublished: true }), params());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('revue approuvée');
    expect(prisma.bilan.update).not.toHaveBeenCalled();
  });

  it('refuses to publish an ARIA_PERIODIC bilan whose recorded review was REJECTED', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'assistante-1', role: 'ASSISTANTE', email: 'assistante@test.local' },
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      type: 'ARIA_PERIODIC',
      isPublished: false,
      reviewDecision: 'REJECTED',
    });

    const res = await PUT(makePutRequest({ isPublished: true }), params());

    expect(res.status).toBe(403);
    expect(prisma.bilan.update).not.toHaveBeenCalled();
  });

  it('allows publishing an ARIA_PERIODIC bilan when reviewDecision APPROVED is submitted in the same request, and records the reviewer', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'assistante-1', role: 'ASSISTANTE', email: 'assistante@test.local' },
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      type: 'ARIA_PERIODIC',
      isPublished: false,
      reviewDecision: null,
    });
    (prisma.bilan.update as jest.Mock).mockResolvedValue({ id: 'bilan-1', isPublished: true });

    const res = await PUT(makePutRequest({ reviewDecision: 'APPROVED', isPublished: true }), params());

    expect(res.status).toBe(200);
    expect(prisma.bilan.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'bilan-1' },
      data: expect.objectContaining({
        reviewDecision: 'APPROVED',
        reviewedById: 'assistante-1',
        isPublished: true,
      }),
    }));
  });

  it('allows publishing an ARIA_PERIODIC bilan when an APPROVED review was already persisted in an earlier request', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'assistante-1', role: 'ASSISTANTE', email: 'assistante@test.local' },
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      type: 'ARIA_PERIODIC',
      isPublished: false,
      reviewDecision: 'APPROVED',
    });
    (prisma.bilan.update as jest.Mock).mockResolvedValue({ id: 'bilan-1', isPublished: true });

    const res = await PUT(makePutRequest({ isPublished: true }), params());

    expect(res.status).toBe(200);
    expect(prisma.bilan.update).toHaveBeenCalled();
  });

  it('does not gate publication for non-ARIA_PERIODIC bilan types (no regression)', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.local' },
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      type: 'STAGE_POST',
      isPublished: false,
      reviewDecision: null,
    });
    (prisma.bilan.update as jest.Mock).mockResolvedValue({ id: 'bilan-1', isPublished: true });

    const res = await PUT(makePutRequest({ isPublished: true }), params());

    expect(res.status).toBe(200);
    expect(prisma.bilan.update).toHaveBeenCalled();
  });

  it('republishing an already-published bilan is idempotent — never overwrites the original publishedAt', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.local' },
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      type: 'ARIA_PERIODIC',
      isPublished: true,
      reviewDecision: 'APPROVED',
    });
    (prisma.bilan.update as jest.Mock).mockResolvedValue({ id: 'bilan-1', isPublished: true });

    const res = await PUT(makePutRequest({ isPublished: true }), params());

    expect(res.status).toBe(200);
    expect(prisma.bilan.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'bilan-1' },
      data: expect.not.objectContaining({ publishedAt: expect.anything() }),
    }));
    expect(mockNotifyParentPeriodicBilanPublished).not.toHaveBeenCalled();
  });

  it('queues a parent notification exactly once on a real ARIA_PERIODIC false->true publish transition', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.local' },
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      type: 'ARIA_PERIODIC',
      isPublished: false,
      reviewDecision: 'APPROVED',
      studentId: 'student-1',
      subject: 'MATHS',
    });
    (prisma.bilan.update as jest.Mock).mockResolvedValue({ id: 'bilan-1', isPublished: true });

    const res = await PUT(makePutRequest({ isPublished: true }), params());

    expect(res.status).toBe(200);
    expect(mockNotifyParentPeriodicBilanPublished).toHaveBeenCalledTimes(1);
    expect(mockNotifyParentPeriodicBilanPublished).toHaveBeenCalledWith({
      bilanId: 'bilan-1',
      studentId: 'student-1',
      subject: 'MATHS',
    });
  });

  it('never fails an already-persisted publication when the notification itself throws', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.local' },
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      type: 'ARIA_PERIODIC',
      isPublished: false,
      reviewDecision: 'APPROVED',
      studentId: 'student-1',
      subject: 'MATHS',
    });
    (prisma.bilan.update as jest.Mock).mockResolvedValue({ id: 'bilan-1', isPublished: true });
    mockNotifyParentPeriodicBilanPublished.mockRejectedValue(new Error('outbox unavailable'));

    const res = await PUT(makePutRequest({ isPublished: true }), params());

    expect(res.status).toBe(200);
  });

  it('does not queue a parent notification for a non-ARIA_PERIODIC publish (no regression)', async () => {
    mockRequireAnyRole.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.local' },
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      type: 'STAGE_POST',
      isPublished: false,
      reviewDecision: null,
      studentId: 'student-1',
      subject: 'MATHS',
    });
    (prisma.bilan.update as jest.Mock).mockResolvedValue({ id: 'bilan-1', isPublished: true });

    const res = await PUT(makePutRequest({ isPublished: true }), params());

    expect(res.status).toBe(200);
    expect(mockNotifyParentPeriodicBilanPublished).not.toHaveBeenCalled();
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
