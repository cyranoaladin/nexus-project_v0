/**
 * Sécurité des routes du cockpit ARIA (§28).
 *
 * Ici les gardes RÉELLES de `lib/guards` sont exercées (seul `auth()` est
 * simulé) : le test prouve l'enforcement effectif, pas un mock complaisant.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { GET as getCockpit } from '@/app/api/aria/cockpit/route';
import { GET as getCurriculum } from '@/app/api/aria/curriculum/route';
import { GET as getProfile, PUT as putProfile } from '@/app/api/aria/profile/route';
import { buildStudentDashboardPayload } from '@/lib/dashboard/student-payload';
import { upsertAriaLearningProfile } from '@/lib/aria/profile/service';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { student: { findUnique: jest.fn() } } }));
jest.mock('@/lib/entitlement', () => ({ getUserEntitlements: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/dashboard/student-payload', () => ({
  buildStudentDashboardPayload: jest.fn(),
}));
jest.mock('@/lib/aria/profile/service', () => {
  const actual = jest.requireActual('@/lib/aria/profile/service');
  return {
    ...actual,
    getAriaLearningProfile: jest.fn().mockResolvedValue({
      targetSession: null,
      selectedCourseKeys: [],
      weeklyGoalMinutes: 180,
      learningGoals: [],
      preferences: {},
      curriculumVersion: 'v1',
      onboardingCompletedAt: null,
    }),
    upsertAriaLearningProfile: jest.fn().mockResolvedValue({
      targetSession: null,
      selectedCourseKeys: [],
      weeklyGoalMinutes: 180,
      learningGoals: [],
      preferences: {},
      curriculumVersion: 'v1',
      onboardingCompletedAt: null,
    }),
  };
});

const VICTIM_STUDENT = {
  id: 'student-victime',
  gradeLevel: 'TERMINALE',
  academicTrack: 'EDS_GENERALE',
  specialties: ['MATHEMATIQUES'],
  stmgPathway: null,
  school: null,
};

function signIn(role: string, userId = 'user-attaquant') {
  (auth as jest.Mock).mockResolvedValue({
    user: { id: userId, role, email: `${userId}@example.test` },
    expires: '2099-01-01T00:00:00.000Z',
  });
}

function putRequest(body: unknown, url = 'http://localhost/api/aria/profile') {
  return new NextRequest(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.student.findUnique as jest.Mock).mockResolvedValue(VICTIM_STUDENT);
});

describe('authentification', () => {
  it('refuse un appelant non authentifié sur les trois routes', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    expect((await getProfile()).status).toBe(401);
    expect((await getCurriculum()).status).toBe(401);
    expect((await getCockpit()).status).toBe(401);
    expect((await putProfile(putRequest({ weeklyGoalMinutes: 200 }))).status).toBe(401);
  });

  it('refuse une session sans rôle', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', email: 'a@b.test' },
      expires: '2099-01-01T00:00:00.000Z',
    });
    expect((await getProfile()).status).toBe(401);
  });
});

describe('autorisation par rôle', () => {
  it.each(['PARENT', 'COACH', 'ADMIN', 'ASSISTANTE'])(
    'refuse le rôle %s sur les trois routes',
    async (role) => {
      signIn(role);
      expect((await getProfile()).status).toBe(403);
      expect((await getCurriculum()).status).toBe(403);
      expect((await getCockpit()).status).toBe(403);
      expect((await putProfile(putRequest({ weeklyGoalMinutes: 200 }))).status).toBe(403);
    },
  );

  it('ne touche jamais la base quand le rôle est refusé', async () => {
    signIn('PARENT');
    await getProfile();
    await getCurriculum();
    await getCockpit();
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
    expect(buildStudentDashboardPayload).not.toHaveBeenCalled();
  });
});

describe('impossibilité d’accéder aux données d’un autre élève', () => {
  it('ignore un studentId injecté dans le corps du PUT', async () => {
    signIn('ELEVE', 'user-attaquant');
    const response = await putProfile(putRequest({ studentId: 'student-victime' }));
    // Schéma strict : la clé inconnue fait échouer la validation.
    expect(response.status).toBe(400);
    expect(upsertAriaLearningProfile).not.toHaveBeenCalled();
  });

  it('ignore un studentId injecté en query string', async () => {
    signIn('ELEVE', 'user-attaquant');
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      ...VICTIM_STUDENT,
      id: 'student-attaquant',
    });

    await putProfile(
      putRequest(
        { weeklyGoalMinutes: 200 },
        'http://localhost/api/aria/profile?studentId=student-victime',
      ),
    );

    // L'élève est résolu par la session, jamais par la query.
    expect(prisma.student.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-attaquant' } }),
    );
    expect(upsertAriaLearningProfile).toHaveBeenCalledWith(
      'student-attaquant',
      expect.anything(),
      expect.anything(),
    );
  });

  it('résout toujours l’élève par session.user.id sur GET', async () => {
    signIn('ELEVE', 'user-42');
    await getProfile();
    expect(prisma.student.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-42' } }),
    );
  });

  it('passe l’userId de session au builder du cockpit', async () => {
    signIn('ELEVE', 'user-42');
    (buildStudentDashboardPayload as jest.Mock).mockRejectedValue(new Error('stop'));
    await getCockpit();
    expect(buildStudentDashboardPayload).toHaveBeenCalledWith('user-42');
  });
});

describe('non-mutation des droits commerciaux', () => {
  it('refuse toute tentative de modification d’abonnement ou d’entitlement', async () => {
    signIn('ELEVE');
    for (const payload of [
      { ariaSubjects: ['NSI'] },
      { entitlements: ['aria_nsi'] },
      { subscriptionId: 'sub-1' },
      { ariaCost: 0 },
      { planName: 'IMMERSION' },
      { credits: 9999 },
    ]) {
      const response = await putProfile(putRequest(payload));
      expect(response.status).toBe(400);
    }
    expect(upsertAriaLearningProfile).not.toHaveBeenCalled();
  });

  it('refuse toute tentative de modification du profil scolaire', async () => {
    signIn('ELEVE');
    for (const payload of [
      { gradeLevel: 'PREMIERE' },
      { academicTrack: 'STMG' },
      { specialties: ['NSI'] },
      { stmgPathway: 'GF' },
      { school: 'Autre lycée' },
    ]) {
      const response = await putProfile(putRequest(payload));
      expect(response.status).toBe(400);
    }
    expect(upsertAriaLearningProfile).not.toHaveBeenCalled();
  });
});

describe('robustesse des entrées', () => {
  it('rejette un corps non-objet', async () => {
    signIn('ELEVE');
    for (const body of ['"texte"', '42', 'null', '[]']) {
      const request = new NextRequest('http://localhost/api/aria/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      expect((await putProfile(request)).status).toBe(400);
    }
  });

  it('rejette une clé de cours ressemblant à un chemin de fichier', async () => {
    signIn('ELEVE');
    const response = await putProfile(
      putRequest({ selectedCourseKeys: ['../../../etc/passwd'] }),
    );
    expect(response.status).toBe(400);
  });
});
