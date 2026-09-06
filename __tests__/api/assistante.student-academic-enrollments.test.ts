/**
 * GET/PUT /api/assistante/students/[studentId]/academic-enrollments
 *
 * Expose la carte scolaire résolue d'un élève (Task 6) et permet à
 * ADMIN/ASSISTANTE de la modifier atomiquement via
 * `updateStudentAcademicProfile`. Vérifie : accès ADMIN/ASSISTANTE
 * uniquement, `Student.id` (jamais `userId`) comme clé de lecture, la
 * traduction des erreurs métier (400 identité/choix invalide, 409 révision
 * périmée), et la provenance transmise à la commande selon le rôle appelant.
 */

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: (value: unknown) => value instanceof Response,
}));
jest.mock('@/lib/rbac', () => ({ can: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: { student: { findUnique: jest.fn() } },
}));
jest.mock('@/lib/curriculum/enrollment', () => {
  const actual = jest.requireActual('@/lib/curriculum/enrollment');
  return {
    ...actual,
    listStudentEnrollments: jest.fn(),
    resolveStudentCourses: jest.fn(),
  };
});
jest.mock('@/lib/curriculum/student-academic-profile', () => {
  const actual = jest.requireActual('@/lib/curriculum/student-academic-profile');
  return {
    ...actual,
    updateStudentAcademicProfile: jest.fn(),
  };
});

import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/assistante/students/[studentId]/academic-enrollments/route';
import { requireAnyRole } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import {
  listStudentEnrollments,
  resolveStudentCourses,
  AcademicEnrollmentError,
} from '@/lib/curriculum/enrollment';
import {
  updateStudentAcademicProfile,
  AcademicRevisionConflictError,
} from '@/lib/curriculum/student-academic-profile';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockCan = can as jest.Mock;
const mockFindUnique = prisma.student.findUnique as jest.Mock;
const mockListStudentEnrollments = listStudentEnrollments as jest.Mock;
const mockResolveStudentCourses = resolveStudentCourses as jest.Mock;
const mockUpdateStudentAcademicProfile = updateStudentAcademicProfile as jest.Mock;

const STUDENT_ROW = {
  id: 'student-1',
  gradeLevel: 'TERMINALE',
  academicTrack: 'EDS_GENERALE',
  stmgPathway: null,
  schoolingStatus: 'SCHOOL_ENROLLED',
  academicRevision: 4,
};

function getRequest() {
  return new Request('http://localhost/api/assistante/students/student-1/academic-enrollments');
}

function putRequest(body: unknown) {
  return new NextRequest(
    'http://localhost:3000/api/assistante/students/student-1/academic-enrollments',
    { method: 'PUT', body: JSON.stringify(body) },
  );
}

function params(studentId = 'student-1') {
  return { params: Promise.resolve({ studentId }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCan.mockReturnValue(true);
  mockFindUnique.mockResolvedValue(STUDENT_ROW);
  mockListStudentEnrollments.mockResolvedValue([]);
  mockResolveStudentCourses.mockReturnValue([]);
});

describe('GET /api/assistante/students/[studentId]/academic-enrollments', () => {
  it.each(['ADMIN', 'ASSISTANTE'])('renvoie la carte scolaire résolue pour %s', async (role) => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role } });
    const courses = [{ course: { courseKey: 'tc-philosophie-terminale' }, academicStatus: 'DERIVED', enrollmentSource: null }];
    mockResolveStudentCourses.mockReturnValue(courses);

    const response = await GET(getRequest(), params());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      studentId: 'student-1',
      gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE',
      stmgPathway: null,
      schoolingStatus: 'SCHOOL_ENROLLED',
      academicRevision: 4,
      courses,
    });
  });

  it('refuse les rôles autres que ADMIN/ASSISTANTE — délègue à requireAnyRole', async () => {
    const forbidden = new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    mockRequireAnyRole.mockResolvedValue(forbidden);

    const response = await GET(getRequest(), params());

    expect(response.status).toBe(403);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockRequireAnyRole).toHaveBeenCalledWith(['ADMIN', 'ASSISTANTE']);
  });

  it('refuse quand can() interdit la lecture STUDENT malgré le rôle', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    mockCan.mockReturnValue(false);

    const response = await GET(getRequest(), params());

    expect(response.status).toBe(403);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('interroge uniquement Student.id — jamais userId', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });

    await GET(getRequest(), params('student-1'));

    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    const call = mockFindUnique.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'student-1' });
  });

  it('404 quand le Student.id est introuvable', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });
    mockFindUnique.mockResolvedValue(null);

    const response = await GET(getRequest(), params('nope'));

    expect(response.status).toBe(404);
  });
});

describe('PUT /api/assistante/students/[studentId]/academic-enrollments', () => {
  const validBody = { courseKeys: ['eds-nsi-terminale'], expectedRevision: 4 };

  it.each(['ADMIN', 'ASSISTANTE'])(
    'applique la mutation et transmet la provenance %s',
    async (role) => {
      mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-9', role } });
      mockUpdateStudentAcademicProfile.mockResolvedValue({
        studentId: 'student-1',
        academicRevision: 5,
        gradeLevel: 'TERMINALE',
        academicTrack: 'EDS_GENERALE',
        stmgPathway: null,
        schoolingStatus: 'SCHOOL_ENROLLED',
        courses: [],
      });

      const response = await PUT(putRequest(validBody), params());

      expect(response.status).toBe(200);
      expect(mockUpdateStudentAcademicProfile).toHaveBeenCalledWith(
        'student-1',
        {},
        ['eds-nsi-terminale'],
        4,
        { source: role, verifiedById: 'staff-9' },
      );
      const body = await response.json();
      expect(body).toMatchObject({ success: true, academicRevision: 5 });
    },
  );

  it('refuse les rôles autres que ADMIN/ASSISTANTE — délègue à requireAnyRole', async () => {
    const forbidden = new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    mockRequireAnyRole.mockResolvedValue(forbidden);

    const response = await PUT(putRequest(validBody), params());

    expect(response.status).toBe(403);
    expect(mockUpdateStudentAcademicProfile).not.toHaveBeenCalled();
    expect(mockRequireAnyRole).toHaveBeenCalledWith(['ADMIN', 'ASSISTANTE']);
  });

  it('refuse quand can() interdit UPDATE STUDENT malgré le rôle', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    mockCan.mockReturnValue(false);

    const response = await PUT(putRequest(validBody), params());

    expect(response.status).toBe(403);
    expect(mockUpdateStudentAcademicProfile).not.toHaveBeenCalled();
  });

  it('interroge uniquement Student.id avant mutation — jamais userId', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });
    mockUpdateStudentAcademicProfile.mockResolvedValue({
      studentId: 'student-1', academicRevision: 5, gradeLevel: 'TERMINALE',
      academicTrack: 'EDS_GENERALE', stmgPathway: null, schoolingStatus: null, courses: [],
    });

    await PUT(putRequest(validBody), params('student-1'));

    const call = mockFindUnique.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'student-1' });
  });

  it('404 quand le Student.id est introuvable', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });
    mockFindUnique.mockResolvedValue(null);

    const response = await PUT(putRequest(validBody), params('nope'));

    expect(response.status).toBe(404);
    expect(mockUpdateStudentAcademicProfile).not.toHaveBeenCalled();
  });

  it('400 avec les issues quand la commande rejette une identité/choix incohérent', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    mockUpdateStudentAcademicProfile.mockRejectedValue(
      new AcademicEnrollmentError(['enseignement inconnu: nawak']),
    );

    const response = await PUT(putRequest({ courseKeys: ['nawak'], expectedRevision: 4 }), params());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: 'Validation failed', details: { issues: ['enseignement inconnu: nawak'] } });
  });

  it('409 avec un code stable quand la révision attendue est périmée', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    mockUpdateStudentAcademicProfile.mockRejectedValue(new AcademicRevisionConflictError());

    const response = await PUT(putRequest({ courseKeys: [], expectedRevision: 0 }), params());

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toMatchObject({ error: 'ACADEMIC_REVISION_CONFLICT' });
  });

  it('400 quand expectedRevision est absente du corps', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });

    const response = await PUT(putRequest({ courseKeys: [] }), params());

    expect(response.status).toBe(400);
    expect(mockUpdateStudentAcademicProfile).not.toHaveBeenCalled();
  });

  it('transmet les changements d’identité seulement quand ils sont présents dans le corps (absent = inchangé)', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });
    mockUpdateStudentAcademicProfile.mockResolvedValue({
      studentId: 'student-1', academicRevision: 5, gradeLevel: 'PREMIERE',
      academicTrack: 'STMG', stmgPathway: 'GF', schoolingStatus: null, courses: [],
    });

    await PUT(
      putRequest({
        gradeLevel: 'PREMIERE',
        academicTrack: 'STMG',
        stmgPathway: 'GF',
        schoolingStatus: null,
        courseKeys: [],
        expectedRevision: 4,
      }),
      params(),
    );

    expect(mockUpdateStudentAcademicProfile).toHaveBeenCalledWith(
      'student-1',
      { gradeLevel: 'PREMIERE', academicTrack: 'STMG', stmgPathway: 'GF', schoolingStatus: null },
      [],
      4,
      { source: 'ADMIN', verifiedById: 'staff-1' },
    );
  });
});
