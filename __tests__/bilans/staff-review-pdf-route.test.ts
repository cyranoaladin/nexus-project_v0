import { NextRequest } from 'next/server';

import { auth } from '@/auth';
import { GET } from '@/app/dashboard/assistante/bilans/[revisionId]/document/[audience]/route';
import {
  renderPendingReportPdf,
  StaffReviewError,
} from '@/lib/bilans/staff/review-service';

jest.mock('@/lib/bilans/staff/review-service', () => ({
  ...jest.requireActual('@/lib/bilans/staff/review-service'),
  renderPendingReportPdf: jest.fn(),
}));

const routeContext = (audience: string) => ({
  params: Promise.resolve({ revisionId: 'revision-1', audience }),
});

describe('PDF de revue assistante par audience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    (renderPendingReportPdf as jest.Mock).mockResolvedValue({
      pdf: Buffer.from('%PDF-1.4 accents é à è ê ç'),
      filename: 'bilan-nexus-eleve.pdf',
    });
  });

  it.each(['ELEVE', 'PARENTS', 'NEXUS'])('renders %s inline with private no-store headers', async (audience) => {
    const response = await GET(
      new NextRequest(`http://localhost/dashboard/assistante/bilans/revision-1/document/${audience}`),
      routeContext(audience),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="bilan-nexus-eleve.pdf"');
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
    expect(renderPendingReportPdf).toHaveBeenCalledWith({
      userId: 'staff-1',
      role: 'ASSISTANTE',
      revisionId: 'revision-1',
      audience,
    });
  });

  it('switches to attachment only when download=1', async () => {
    const response = await GET(
      new NextRequest('http://localhost/dashboard/assistante/bilans/revision-1/document/PARENTS?download=1'),
      routeContext('PARENTS'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="bilan-nexus-eleve.pdf"');
  });

  it.each(['PARENT', 'ELEVE'])('returns 404 to role %s without rendering', async (role) => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role } });

    const response = await GET(
      new NextRequest('http://localhost/dashboard/assistante/bilans/revision-1/document/ELEVE'),
      routeContext('ELEVE'),
    );

    expect(response.status).toBe(404);
    expect(renderPendingReportPdf).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown audience without rendering', async () => {
    const response = await GET(
      new NextRequest('http://localhost/dashboard/assistante/bilans/revision-1/document/ASSISTANTE'),
      routeContext('ASSISTANTE'),
    );

    expect(response.status).toBe(404);
    expect(renderPendingReportPdf).not.toHaveBeenCalled();
  });

  it('does not disclose a missing or non-reviewable revision', async () => {
    (renderPendingReportPdf as jest.Mock).mockRejectedValue(new StaffReviewError('NOT_FOUND'));

    const response = await GET(
      new NextRequest('http://localhost/dashboard/assistante/bilans/missing/document/NEXUS'),
      { params: Promise.resolve({ revisionId: 'missing', audience: 'NEXUS' }) },
    );

    expect(response.status).toBe(404);
  });

  it('reports an incomplete student identity as a review conflict', async () => {
    (renderPendingReportPdf as jest.Mock).mockRejectedValue(
      new StaffReviewError('REPORT_STUDENT_IDENTITY_REQUIRED'),
    );

    const response = await GET(
      new NextRequest('http://localhost/dashboard/assistante/bilans/revision-1/document/NEXUS'),
      routeContext('NEXUS'),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'REPORT_STUDENT_IDENTITY_REQUIRED' },
    });
  });
});
