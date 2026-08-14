import { NextRequest } from 'next/server';

import { auth } from '@/auth';
import { GET } from '@/app/dashboard/assistante/bilans/teacher-dossier/route';
import {
  buildStaffTeacherDossierDocument,
  StaffTeacherDossierError,
} from '@/lib/bilans/staff/teacher-dossier-service';

jest.mock('@/lib/bilans/staff/teacher-dossier-service', () => ({
  ...jest.requireActual('@/lib/bilans/staff/teacher-dossier-service'),
  buildStaffTeacherDossierDocument: jest.fn(),
}));

const url = 'http://localhost/dashboard/assistante/bilans/teacher-dossier?subject=MATHEMATIQUES&level=TERMINALE&format=html';

describe('Route du dossier enseignant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    (buildStaffTeacherDossierDocument as jest.Mock).mockResolvedValue({
      body: '<html>dossier</html>', contentType: 'text/html; charset=utf-8', filename: 'dossier-terminale.html',
    });
  });

  it('renders inline with private no-store headers for a staff role', async () => {
    const response = await GET(new NextRequest(url));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="dossier-terminale.html"');
    expect(buildStaffTeacherDossierDocument).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'staff-1', role: 'ASSISTANTE', subject: 'MATHEMATIQUES', level: 'TERMINALE', format: 'html',
    }));
  });

  it.each(['PARENT', 'ELEVE', 'COACH'])('returns 404 to role %s without ever calling the service', async (role) => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role } });

    const response = await GET(new NextRequest(url));

    expect(response.status).toBe(404);
    expect(buildStaffTeacherDossierDocument).not.toHaveBeenCalled();
  });

  it('returns 404 for an unauthenticated request without ever calling the service', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET(new NextRequest(url));

    expect(response.status).toBe(404);
    expect(buildStaffTeacherDossierDocument).not.toHaveBeenCalled();
  });

  it('rejects an unknown format before touching the database', async () => {
    const response = await GET(new NextRequest('http://localhost/dashboard/assistante/bilans/teacher-dossier?subject=MATHEMATIQUES&level=TERMINALE&format=doc'));

    expect(response.status).toBe(400);
    expect(buildStaffTeacherDossierDocument).not.toHaveBeenCalled();
  });

  it('requires subject and level before touching the database', async () => {
    const response = await GET(new NextRequest('http://localhost/dashboard/assistante/bilans/teacher-dossier?format=html'));

    expect(response.status).toBe(400);
    expect(buildStaffTeacherDossierDocument).not.toHaveBeenCalled();
  });

  it('does not disclose a group with no eligible bilan', async () => {
    (buildStaffTeacherDossierDocument as jest.Mock).mockRejectedValue(new StaffTeacherDossierError('DOSSIER_NO_ELIGIBLE_STUDENT'));

    const response = await GET(new NextRequest(url));

    expect(response.status).toBe(404);
  });

  it('reports a PDF renderer outage as a conflict, not a client error', async () => {
    (buildStaffTeacherDossierDocument as jest.Mock).mockRejectedValue(new StaffTeacherDossierError('TEACHER_DOSSIER_PDF_RENDER_FAILED'));

    const response = await GET(new NextRequest(`${url.replace('format=html', 'format=pdf')}`));

    expect(response.status).toBe(409);
  });

  it('forwards optional header fields from the query string', async () => {
    await GET(new NextRequest(`${url}&teacherName=Mme%20Trabelsi&room=B12`));

    expect(buildStaffTeacherDossierDocument).toHaveBeenCalledWith(expect.objectContaining({
      header: expect.objectContaining({ teacherName: 'Mme Trabelsi', room: 'B12', timeSlot: undefined, stageDates: undefined }),
    }));
  });
});
