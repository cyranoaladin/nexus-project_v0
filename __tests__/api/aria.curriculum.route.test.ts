/**
 * Route /api/aria/curriculum — projection sûre de la carte scolaire.
 */

import { NextResponse } from 'next/server';
import { GET } from '@/app/api/aria/curriculum/route';
import { isErrorResponse, requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { getUserEntitlements } from '@/lib/entitlement';
import { getAriaLearningProfile } from '@/lib/aria/profile/service';

jest.mock('@/lib/guards', () => ({ requireRole: jest.fn(), isErrorResponse: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { student: { findUnique: jest.fn() } } }));
jest.mock('@/lib/entitlement', () => ({ getUserEntitlements: jest.fn() }));
jest.mock('@/lib/aria/profile/service', () => ({ getAriaLearningProfile: jest.fn() }));

const STUDENT = {
  id: 'student-1',
  gradeLevel: 'TERMINALE',
  academicTrack: 'EDS_GENERALE',
  specialties: ['MATHEMATIQUES', 'NSI'],
  stmgPathway: null,
  school: null,
};

function authenticate() {
  (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role: 'ELEVE' } });
  (isErrorResponse as unknown as jest.Mock).mockReturnValue(false);
}

beforeEach(() => {
  jest.clearAllMocks();
  (getAriaLearningProfile as jest.Mock).mockResolvedValue({
    targetSession: null,
    selectedCourseKeys: ['maths-terminale-eds'],
    weeklyGoalMinutes: 180,
    learningGoals: [],
    preferences: {},
    curriculumVersion: 'v1',
    onboardingCompletedAt: '2026-08-01T10:00:00.000Z',
  });
  (getUserEntitlements as jest.Mock).mockResolvedValue([
    { id: 'e1', features: ['aria_maths'] },
  ]);
});

describe('GET /api/aria/curriculum', () => {
  it('propage le refus de la garde de rôle', async () => {
    (requireRole as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );
    (isErrorResponse as unknown as jest.Mock).mockReturnValue(true);

    const response = await GET();
    expect(response.status).toBe(401);
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });

  it('retourne 404 si aucun profil élève', async () => {
    authenticate();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
  });

  it('sépare cours disponibles, verrouillés et non supportés', async () => {
    authenticate();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(STUDENT);

    const body = await (await GET()).json();
    expect(body.availableCourseKeys).toContain('maths-terminale-eds');
    // NSI est supportée par le produit mais absente de l'abonnement.
    expect(body.lockedCourseKeys).toContain('nsi-terminale-eds');
    // EMC est suivie mais pas encore outillée.
    expect(body.unsupportedCourseKeys).toContain('emc-terminale');
  });

  it('expose des résumés de graphes sans aucun chemin fichier', async () => {
    authenticate();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(STUDENT);

    const response = await GET();
    const body = await response.json();
    const raw = JSON.stringify(body);

    expect(body.skillGraphs.length).toBeGreaterThan(0);
    for (const summary of body.skillGraphs) {
      expect(summary.available).toBe(true);
      expect(summary.competencyCount).toBeGreaterThan(0);
    }
    // Aucune fuite de chemin filesystem ni d'extension de fichier.
    expect(raw).not.toMatch(/\.json/);
    expect(raw).not.toMatch(/programmes\//);
    expect(raw).not.toMatch(/lib\/diagnostics/);
    expect(raw).not.toMatch(/\/home\//);
  });

  it('n’expose que des provenances symboliques', async () => {
    authenticate();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(STUDENT);

    const body = await (await GET()).json();
    const allowed = new Set([
      'COMPILED_SKILL_GRAPH',
      'RAG_CAPABILITY',
      'HUB_RESOURCE',
      'ARIA_CHAT_SUBJECT',
      'NATIONAL_CURRICULUM',
    ]);
    for (const view of body.courses) {
      for (const provenance of view.course.provenance) {
        expect(allowed.has(provenance)).toBe(true);
      }
    }
  });

  it('reste fonctionnel si la résolution des entitlements échoue', async () => {
    authenticate();
    (prisma.student.findUnique as jest.Mock).mockResolvedValue(STUDENT);
    (getUserEntitlements as jest.Mock).mockRejectedValue(new Error('DB down'));

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    // Fail-closed : aucun cours n'est ouvert commercialement.
    expect(body.availableCourseKeys).toHaveLength(0);
    expect(body.lockedCourseKeys.length).toBeGreaterThan(0);
  });
});
