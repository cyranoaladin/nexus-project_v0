import { buildCoreV2AriaConversationAuthorization } from '@/lib/core-v2/aria/conversation-context';

const student = {
  studentId: 'student-core-v2',
  userId: 'user-core-v2',
  firstName: 'Amel',
  lastName: 'Test',
  gradeLevel: 'TERMINALE' as const,
  academicTrack: 'GENERAL' as const,
  stmgPathway: null,
  schoolingStatus: 'CANDIDAT_LIBRE',
  school: null,
  specialties: [],
  hasAcademicSpecialtyEnrollment: true,
  academicEnrollments: [{ courseKey: 'philosophie-terminale', kind: 'SPECIALTY' as const }],
};

const globalEntitlement = {
  hasGenericAccess: true,
  hasGlobalAccess: true,
  courseKeys: [],
  grantIds: ['grant-global'],
  evaluatedAt: new Date('2026-09-23T00:00:00.000Z'),
  tier: 'ARIA_AUTONOMIE' as const,
};

describe('Core v2 native conversation authorization adapter', () => {
  test('builds a self-scoped context from Core v2 identity and canonical entitlement', () => {
    expect(buildCoreV2AriaConversationAuthorization({
      actor: { userId: student.userId, role: 'ELEVE' },
      student,
      courseKey: 'philosophie-terminale',
      entitlementContext: globalEntitlement,
    })).toMatchObject({
      actor: { userId: 'user-core-v2', role: 'ELEVE' },
      subject: { studentId: 'student-core-v2', userId: 'user-core-v2' },
      courseKey: 'philosophie-terminale',
      capabilities: { chat: true },
    });
  });

  test('does not widen a scoped grant to another academically relevant course', () => {
    expect(() => buildCoreV2AriaConversationAuthorization({
      actor: { userId: student.userId, role: 'ELEVE' },
      student: {
        ...student,
        academicEnrollments: [
          ...student.academicEnrollments,
          { courseKey: 'maths-expertes-terminale', kind: 'SPECIALTY' as const },
        ],
      },
      courseKey: 'maths-expertes-terminale',
      entitlementContext: {
        ...globalEntitlement,
        hasGlobalAccess: false,
        courseKeys: ['philosophie-terminale'],
      },
    })).toThrow('Aucun droit ARIA actif');
  });

  test('never accepts a course that is not enrolled in Core v2', () => {
    expect(() => buildCoreV2AriaConversationAuthorization({
      actor: { userId: student.userId, role: 'ELEVE' },
      student,
      courseKey: 'maths-expertes-terminale',
      entitlementContext: globalEntitlement,
    })).toThrow('cursus scolaire actif');
  });
});
