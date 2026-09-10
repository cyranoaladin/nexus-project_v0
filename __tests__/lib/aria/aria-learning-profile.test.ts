/**
 * Service de profil pédagogique ARIA.
 *
 * Vérifie surtout les INTERDITS : le service ne doit jamais toucher à
 * l'abonnement, aux entitlements ni au profil scolaire de l'élève.
 */

import { prisma } from '@/lib/prisma';
import {
  AriaProfileValidationError,
  ariaProfileUpdateSchema,
  defaultAriaCockpitProfile,
  getAriaCockpitProfile,
  upsertAriaCockpitProfile,
} from '@/lib/aria/cockpit/profile-service';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    ariaCockpitProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    subscription: { update: jest.fn(), updateMany: jest.fn() },
    student: { update: jest.fn(), updateMany: jest.fn() },
  },
}));

const TERMINALE_EDS = {
  gradeLevel: 'TERMINALE' as const,
  academicTrack: 'EDS_GENERALE' as const,
  specialties: ['MATHEMATIQUES' as const],
  stmgPathway: null,
};

function mockUpsertEcho() {
  (prisma.ariaCockpitProfile.upsert as jest.Mock).mockImplementation(async (args) => ({
    targetSession: args.create?.targetSession ?? args.update?.targetSession ?? null,
    pinnedCourseKeys: args.create?.pinnedCourseKeys ?? args.update?.pinnedCourseKeys ?? [],
    weeklyGoalMinutes: args.create?.weeklyGoalMinutes ?? args.update?.weeklyGoalMinutes ?? 180,
    learningGoals: args.create?.learningGoals ?? args.update?.learningGoals ?? [],
    preferences: args.create?.preferences ?? args.update?.preferences ?? {},
    curriculumVersion: 'v1',
    onboardingCompletedAt:
      args.create?.onboardingCompletedAt ?? args.update?.onboardingCompletedAt ?? null,
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsertEcho();
});

describe('schéma de mise à jour', () => {
  it('rejette toute clé non autorisée (strict)', () => {
    for (const forbidden of [
      { studentId: 'other-student' },
      { ariaSubjects: ['MATHEMATIQUES'] },
      { entitlements: ['aria_nsi'] },
      { gradeLevel: 'PREMIERE' },
      { academicTrack: 'STMG' },
      { specialties: ['NSI'] },
      { subscriptionId: 'sub-1' },
    ]) {
      const result = ariaProfileUpdateSchema.safeParse(forbidden);
      expect(result.success).toBe(false);
    }
  });

  it('borne le rythme hebdomadaire', () => {
    expect(ariaProfileUpdateSchema.safeParse({ weeklyGoalMinutes: 10 }).success).toBe(false);
    expect(ariaProfileUpdateSchema.safeParse({ weeklyGoalMinutes: 99999 }).success).toBe(false);
    expect(ariaProfileUpdateSchema.safeParse({ weeklyGoalMinutes: 180 }).success).toBe(true);
  });

  it('rejette un objectif inconnu', () => {
    expect(
      ariaProfileUpdateSchema.safeParse({ learningGoals: ['DEVENIR_ASTRONAUTE'] }).success,
    ).toBe(false);
    expect(
      ariaProfileUpdateSchema.safeParse({ learningGoals: ['PREPARER_BAC'] }).success,
    ).toBe(true);
  });
});

describe('getAriaCockpitProfile', () => {
  it("retourne le profil par défaut quand aucune ligne n'existe", async () => {
    (prisma.ariaCockpitProfile.findUnique as jest.Mock).mockResolvedValue(null);
    const profile = await getAriaCockpitProfile('student-1');
    expect(profile).toEqual(defaultAriaCockpitProfile());
    expect(profile.onboardingCompletedAt).toBeNull();
  });

  it('ignore une clé de cours retirée du catalogue', async () => {
    (prisma.ariaCockpitProfile.findUnique as jest.Mock).mockResolvedValue({
      targetSession: null,
      pinnedCourseKeys: ['maths-terminale-eds', 'cours-supprime'],
      weeklyGoalMinutes: 180,
      learningGoals: ['PREPARER_BAC', 'INCONNU'],
      preferences: { defaultPanel: 'TODAY', bidon: 1 },
      curriculumVersion: 'v1',
      onboardingCompletedAt: new Date('2026-08-01T10:00:00Z'),
    });

    const profile = await getAriaCockpitProfile('student-1');
    expect(profile.pinnedCourseKeys).toEqual(['maths-terminale-eds']);
    expect(profile.learningGoals).toEqual(['PREPARER_BAC']);
    // `preferences` non conforme → objet vide plutôt qu'une valeur douteuse.
    expect(profile.preferences).toEqual({});
    expect(profile.onboardingCompletedAt).toBe('2026-08-01T10:00:00.000Z');
  });
});

describe('upsertAriaCockpitProfile', () => {
  it('accepte une sélection cohérente', async () => {
    const profile = await upsertAriaCockpitProfile(
      'student-1',
      { pinnedCourseKeys: ['maths-terminale-eds'], weeklyGoalMinutes: 240 },
      TERMINALE_EDS,
    );
    expect(profile.pinnedCourseKeys).toEqual(['maths-terminale-eds']);
    expect(profile.weeklyGoalMinutes).toBe(240);
  });

  it('rejette une clé de cours inconnue du catalogue', async () => {
    await expect(
      upsertAriaCockpitProfile('student-1', { pinnedCourseKeys: ['cours-bidon'] }, TERMINALE_EDS),
    ).rejects.toBeInstanceOf(AriaProfileValidationError);
    expect(prisma.ariaCockpitProfile.upsert).not.toHaveBeenCalled();
  });

  it("rejette un cours hors de la scolarité de l'élève", async () => {
    await expect(
      upsertAriaCockpitProfile(
        'student-1',
        { pinnedCourseKeys: ['sgn-premiere-stmg'] },
        TERMINALE_EDS,
      ),
    ).rejects.toBeInstanceOf(AriaProfileValidationError);
    expect(prisma.ariaCockpitProfile.upsert).not.toHaveBeenCalled();
  });

  it('rejette une spécialité non suivie', async () => {
    await expect(
      upsertAriaCockpitProfile(
        'student-1',
        { pinnedCourseKeys: ['nsi-terminale-eds'] },
        TERMINALE_EDS,
      ),
    ).rejects.toBeInstanceOf(AriaProfileValidationError);
  });

  it("rejette une session d'examen non supportée", async () => {
    await expect(
      upsertAriaCockpitProfile('student-1', { targetSession: 2099 }, TERMINALE_EDS),
    ).rejects.toBeInstanceOf(AriaProfileValidationError);
  });

  it("n'écrit QUE dans aria_cockpit_profiles", async () => {
    await upsertAriaCockpitProfile(
      'student-1',
      { pinnedCourseKeys: ['maths-terminale-eds'], completeOnboarding: true },
      TERMINALE_EDS,
    );
    expect(prisma.ariaCockpitProfile.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
    expect(prisma.student.update).not.toHaveBeenCalled();
    expect(prisma.student.updateMany).not.toHaveBeenCalled();
  });

  it('scope toujours l’écriture sur le studentId fourni par la session', async () => {
    await upsertAriaCockpitProfile('student-42', { weeklyGoalMinutes: 200 }, TERMINALE_EDS);
    const args = (prisma.ariaCockpitProfile.upsert as jest.Mock).mock.calls[0][0];
    expect(args.where).toEqual({ studentId: 'student-42' });
    expect(args.create.studentId).toBe('student-42');
    // Aucun champ scolaire ni commercial dans la charge écrite.
    for (const forbidden of ['gradeLevel', 'academicTrack', 'specialties', 'ariaSubjects']) {
      expect(Object.keys(args.create)).not.toContain(forbidden);
      expect(Object.keys(args.update)).not.toContain(forbidden);
    }
  });

  it('marque l’onboarding terminé sans jamais pouvoir le dé-marquer', async () => {
    await upsertAriaCockpitProfile('student-1', { completeOnboarding: true }, TERMINALE_EDS);
    const withFlag = (prisma.ariaCockpitProfile.upsert as jest.Mock).mock.calls[0][0];
    expect(withFlag.update.onboardingCompletedAt).toBeInstanceOf(Date);

    jest.clearAllMocks();
    mockUpsertEcho();
    await upsertAriaCockpitProfile('student-1', { completeOnboarding: false }, TERMINALE_EDS);
    const withoutFlag = (prisma.ariaCockpitProfile.upsert as jest.Mock).mock.calls[0][0];
    expect(withoutFlag.update.onboardingCompletedAt).toBeUndefined();
  });
});
