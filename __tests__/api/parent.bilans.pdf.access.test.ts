jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn((value) => value instanceof Response),
}));

jest.mock('@/lib/pdf/bilan-parent-pdfkit', () => ({
  renderBilanParentPDF: jest.fn(),
}));

import { NextRequest } from 'next/server';

import { GET } from '@/app/api/parent/bilans/[id]/pdf/route';
import { requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { renderBilanParentPDF } from '@/lib/pdf/bilan-parent-pdfkit';

const mockRequireRole = requireRole as jest.Mock;
const mockRenderPdf = renderBilanParentPDF as jest.Mock;

function request() {
  return new NextRequest('http://localhost/api/parent/bilans/bilan-1/pdf');
}

function params(id = 'bilan-1') {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/parent/bilans/[id]/pdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses unauthenticated users', async () => {
    mockRequireRole.mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }));

    const res = await GET(request(), params());

    expect(res.status).toBe(401);
  });

  it('returns a PDF for the parent owner of a published bilan', async () => {
    mockRequireRole.mockResolvedValue({ user: { id: 'parent-user-1', role: 'PARENT' } });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({
      children: [{ id: 'student-1' }],
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      subject: 'MATHEMATIQUES',
      studentName: 'Yasmine',
      globalScore: 16,
      parentsMarkdown: 'Parent-facing content',
      publishedAt: new Date('2026-05-01T10:00:00.000Z'),
      createdAt: new Date('2026-05-01T09:00:00.000Z'),
      stage: { title: 'Stage Printemps' },
      coach: { pseudonym: 'Coach A' },
      student: { user: { firstName: 'Yasmine', lastName: 'B.' } },
      contentInterne: 'internal',
      nexusMarkdown: 'nexus private',
    });
    mockRenderPdf.mockResolvedValue(Buffer.from('%PDF-safe'));

    const res = await GET(request(), params());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(mockRenderPdf).toHaveBeenCalledWith(
      expect.not.objectContaining({
        contentInterne: expect.anything(),
        nexusMarkdown: expect.anything(),
        rawAiOutput: expect.anything(),
      })
    );
  });

  it('does not return another child PDF to a parent', async () => {
    mockRequireRole.mockResolvedValue({ user: { id: 'parent-user-1', role: 'PARENT' } });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({
      children: [{ id: 'student-1' }],
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await GET(request(), params('bilan-other-child'));

    expect(res.status).toBe(404);
    expect(mockRenderPdf).not.toHaveBeenCalled();
    expect(prisma.bilan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'bilan-other-child',
          isPublished: true,
          studentId: { in: ['student-1'] },
        }),
      })
    );
  });

  it('refuses unpublished bilans for parent PDF access', async () => {
    mockRequireRole.mockResolvedValue({ user: { id: 'parent-user-1', role: 'PARENT' } });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({
      children: [{ id: 'student-1' }],
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await GET(request(), params('draft-bilan'));

    expect(res.status).toBe(404);
    expect(mockRenderPdf).not.toHaveBeenCalled();
  });

  it('returns a generic 500 without internal details when PDF rendering fails', async () => {
    mockRequireRole.mockResolvedValue({ user: { id: 'parent-user-1', role: 'PARENT' } });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({
      children: [{ id: 'student-1' }],
    });
    (prisma.bilan.findFirst as jest.Mock).mockResolvedValue({
      id: 'bilan-1',
      subject: 'FRANCAIS',
      studentName: 'Yasmine',
      globalScore: 14,
      parentsMarkdown: 'Parent-facing content',
      publishedAt: new Date('2026-05-01T10:00:00.000Z'),
      createdAt: new Date('2026-05-01T09:00:00.000Z'),
      stage: { title: 'Stage EAF' },
      coach: { pseudonym: 'Coach A' },
      student: { user: { firstName: 'Yasmine', lastName: 'B.' } },
    });
    mockRenderPdf.mockRejectedValue(new Error('localPath=/var/www/private/bilan.tex'));

    const res = await GET(request(), params());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'Erreur lors de la génération du PDF' });
    expect(JSON.stringify(body)).not.toContain('/var/www');
    expect(JSON.stringify(body)).not.toContain('localPath');
    expect(body).not.toHaveProperty('details');
  });
});
