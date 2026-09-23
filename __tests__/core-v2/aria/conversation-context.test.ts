import { buildCoreV2AriaConversationAuthorization } from '@/lib/core-v2/aria/conversation-context';
import type { CoreV2AriaStudentContext } from '@/lib/core-v2/aria/student-context';
import type { Subject } from '@prisma/client';

const student: CoreV2AriaStudentContext = {
  studentId: 'student-core-v2',
  userId: 'user-core-v2',
  firstName: 'Amel',
  lastName: 'Test',
  gradeLevel: 'TERMINALE' as const,
  academicTrack: 'EDS_GENERALE',
  stmgPathway: null,
  schoolingStatus: 'CANDIDAT_LIBRE',
  school: null,
  specialties: [] as readonly Subject[],
  hasAcademicSpecialtyEnrollment: false,
  academicEnrollments: [],
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
        specialties: ['MATHEMATIQUES' as Subject],
        academicEnrollments: [{ courseKey: 'eds-maths-terminale', kind: 'SPECIALTY' }],
      },
      courseKey: 'maths-terminale-eds',
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

  test('accepts a real OPTION enrollment through the canonical course resolver', () => {
    expect(buildCoreV2AriaConversationAuthorization({
      actor: { userId: student.userId, role: 'ELEVE' },
      student: {
        ...student,
        academicEnrollments: [{ courseKey: 'opt-maths-expertes-terminale', kind: 'OPTION' }],
      },
      courseKey: 'maths-expertes-terminale',
      entitlementContext: globalEntitlement,
    }).courseKey).toBe('maths-expertes-terminale');
  });

  test('derives a STMG track module without inventing an enrollment row', () => {
    expect(buildCoreV2AriaConversationAuthorization({
      actor: { userId: student.userId, role: 'ELEVE' },
      student: {
        ...student,
        academicTrack: 'STMG',
        stmgPathway: 'RHC',
      },
      courseKey: 'parcours-rhc-terminale-stmg',
      entitlementContext: globalEntitlement,
    }).courseKey).toBe('parcours-rhc-terminale-stmg');
  });

  test.each([
    ['maths-premiere-eds', 'cursus scolaire actif'],
    ['maths-terminale-stmg', 'cursus scolaire actif'],
    ['cours-inconnu', 'Cours ARIA introuvable'],
  ])('rejects invalid academic course %s', (courseKey, message) => {
    expect(() => buildCoreV2AriaConversationAuthorization({
      actor: { userId: student.userId, role: 'ELEVE' },
      student,
      courseKey,
      entitlementContext: globalEntitlement,
    })).toThrow(message);
  });

  test('rejects a valid academic course without a commercial grant', () => {
    expect(() => buildCoreV2AriaConversationAuthorization({
      actor: { userId: student.userId, role: 'ELEVE' },
      student,
      courseKey: 'philosophie-terminale',
      entitlementContext: {
        ...globalEntitlement,
        hasGenericAccess: false,
        hasGlobalAccess: false,
        grantIds: [],
        tier: null,
      },
    })).toThrow('Aucun droit ARIA actif');
  });

  test('does not authorize generation when the resolved capability has no chat', () => {
    expect(() => buildCoreV2AriaConversationAuthorization({
      actor: { userId: student.userId, role: 'ELEVE' },
      student,
      courseKey: 'philosophie-terminale',
      entitlementContext: { ...globalEntitlement, tier: null },
    })).toThrow('chat ARIA');
  });
});
