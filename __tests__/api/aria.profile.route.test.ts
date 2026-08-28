/**
 * Route /api/aria/profile — contrat et sécurité.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GET, PUT } from '@/app/api/aria/profile/route';
import { isErrorResponse, requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import {
  AriaProfileValidationError,
  getAriaLearningProfile,
  upsertAriaLearningProfile,
} from '@/lib/aria/profile/service';

jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({ prisma: { student: { findUnique: jest.fn() } } }));
jest.mock('@/lib/aria/profile/service', () => {
  const actual = jest.requireActual('@/lib/aria/profile/service');
  return {
    ...actual,
    getAriaLearningProfile: jest.fn(),
    upsertAriaLearningProfile: jest.fn(),
  };
});

const STUDENT = {
  id: 'student-1',
  gradeLevel: 'TERMINALE',
  academicTrack: 'EDS_GENERALE',
  specialties: ['MATHEMATIQUES'],
  stmgPathway: null,
  school: 'Lycée Test',
};

const PROFILE = {
  targetSession: null,
  selectedCourseKeys: ['maths-terminale-eds'],
  weeklyGoalMinutes: 180,
  learningGoals: [],
  preferences: {},
  curriculumVersion: 'v1',
  onboardingCompletedAt: '2026-08-01T10:00:00.000Z',
};

function authenticate() {
  (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role: 'ELEVE' } });
  (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/aria/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (getAriaLearningProfile as jest.Mock).mockResolvedValue(PROFILE);
  (upsertAriaLearningProfile as jest.Mock).mockResolvedValue(PROFILE);
});

describe('GET /api/aria/profile', () => {
  it('propage le refus de la garde de rôle', async () => {
    const denial = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    (requireRole as jest.Mock).mockResolvedValue(denial);
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);

    const response = await GET();
    expect(response.status).toBe(403);
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });

  it('exige le rôle ELEVE', async () => {
    await GET().catch(() => null);
    expect(requireRole).toHaveBeenCalledWith('ELEVE');
  });

  it('résout l’élève par session.user.id uniquement', async () => {
    authenticate();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(STUDENT);

    await GET();
    expect(prisma.student.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });

  it('retourne 404 si aucun profil élève', async () => {
    authenticate();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(404);
  });

  it('retourne profil scolaire, profil ARIA et setupState', async () => {
    authenticate();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(STUDENT);

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.academicProfile.gradeLevel).toBe('TERMINALE');
    expect(body.ariaProfile.selectedCourseKeys).toEqual(['maths-terminale-eds']);
    expect(body.setupState).toBe('READY');
    expect(body.academicProfileReadOnly).toBe(true);
  });

  it('signale ACADEMIC_PROFILE_INCOMPLETE quand le profil scolaire est incomplet', async () => {
    authenticate();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      ...STUDENT,
      gradeLevel: null,
    });

    const body = await (await GET()).json();
    expect(body.setupState).toBe('ACADEMIC_PROFILE_INCOMPLETE');
    expect(body.academicProfile.incomplete).toBe(true);
  });
});

describe('PUT /api/aria/profile', () => {
  it('rejette un corps JSON invalide', async () => {
    authenticate();
    const request = new NextRequest('http://localhost/api/aria/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'pas du json',
    });
    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it('rejette (400) toute clé non autorisée', async () => {
    authenticate();
    for (const forbidden of [
      { studentId: 'autre-eleve' },
      { ariaSubjects: ['NSI'] },
      { gradeLevel: 'PREMIERE' },
      { academicTrack: 'STMG' },
    ]) {
      const response = await PUT(makeRequest(forbidden));
      expect(response.status).toBe(400);
    }
    expect(upsertAriaLearningProfile).not.toHaveBeenCalled();
  });

  it('rejette (400) un rythme hors bornes', async () => {
    authenticate();
    const response = await PUT(makeRequest({ weeklyGoalMinutes: 100000 }));
    expect(response.status).toBe(400);
  });

  it('n’accepte jamais un studentId externe : il vient de la session', async () => {
    authenticate();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(STUDENT);

    await PUT(makeRequest({ weeklyGoalMinutes: 240 }));
    expect(upsertAriaLearningProfile).toHaveBeenCalledWith(
      'student-1',
      expect.objectContaining({ weeklyGoalMinutes: 240 }),
      expect.objectContaining({ gradeLevel: 'TERMINALE' }),
    );
  });

  it('traduit une erreur métier en 400', async () => {
    authenticate();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(STUDENT);
    (upsertAriaLearningProfile as jest.Mock).mockRejectedValue(
      new AriaProfileValidationError(['cours inconnus du catalogue: x']),
    );

    const response = await PUT(makeRequest({ selectedCourseKeys: ['x'] }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.details.issues[0]).toContain('cours inconnus');
  });

  it('retourne 404 si aucun profil élève', async () => {
    authenticate();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);
    const response = await PUT(makeRequest({ weeklyGoalMinutes: 240 }));
    expect(response.status).toBe(404);
  });
});
