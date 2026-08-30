import { resolveAriaCourseAccess, resolveStudentAriaCourses, type StudentWithEnrollments } from '@/lib/aria/access';

const courseEntitlement = (...courseKeys: string[]) => ({
  hasGenericAccess: true,
  hasGlobalAccess: false,
  courseKeys,
  grantIds: ['entitlement-course'],
  evaluatedAt: new Date('2026-08-30T12:00:00.000Z'),
});

const globalEntitlement = {
  hasGenericAccess: true,
  hasGlobalAccess: true,
  courseKeys: [] as string[],
  grantIds: ['entitlement-global'],
  evaluatedAt: new Date('2026-08-30T12:00:00.000Z'),
};

describe('ARIA Course Access Resolver', () => {
  const terminaleStudent: StudentWithEnrollments = {
    id: 'student-tle-1',
    gradeLevel: 'TERMINALE',
    academicTrack: 'EDS_GENERALE',
    academicEnrollments: [
      { courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
      { courseKey: 'eds-nsi-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
    ],
  };

  const premiereStmgStudent: StudentWithEnrollments = {
    id: 'student-stmg-1',
    gradeLevel: 'PREMIERE',
    academicTrack: 'STMG',
    stmgPathway: null,
    academicEnrollments: [],
  };

  describe('Découplage des 4 dimensions', () => {
    it('reconnaît la pertinence académique selon les inscriptions et cours dérivés', () => {
      // Spécialité explicitement inscrite
      const mathsAccess = resolveAriaCourseAccess({
        courseKey: 'eds-maths-terminale',
        student: terminaleStudent,
      });
      expect(mathsAccess.academicallyRelevant).toBe(true);

      // Tronc commun dérivé (Philosophie en Terminale)
      const philoAccess = resolveAriaCourseAccess({
        courseKey: 'tc-philosophie-terminale',
        student: terminaleStudent,
      });
      expect(philoAccess.academicallyRelevant).toBe(true);

      // Cours d'un autre niveau (Première)
      const premiereAccess = resolveAriaCourseAccess({
        courseKey: 'eds-maths-premiere',
        student: terminaleStudent,
      });
      expect(premiereAccess.academicallyRelevant).toBe(false);
      expect(premiereAccess.status).toBe('UNSUPPORTED');
      expect(premiereAccess.lockReason).toBe('NOT_ENROLLED');
    });

    it('gère les droits commerciaux sans repli arbitraire vers aria_maths', () => {
      // Élève abonné uniquement à Maths
      const accessMaths = resolveAriaCourseAccess({
        courseKey: 'eds-maths-terminale',
        student: terminaleStudent,
        entitlements: courseEntitlement('eds-maths-terminale'),
        pinnedCourseKeys: ['eds-maths-terminale'],
      });
      expect(accessMaths.commerciallyEntitled).toBe(true);
      expect(accessMaths.status).toBe('AVAILABLE');

      // Élève non abonné à NSI
      const accessNsi = resolveAriaCourseAccess({
        courseKey: 'eds-nsi-terminale',
        student: terminaleStudent,
        entitlements: courseEntitlement('eds-maths-terminale'),
        pinnedCourseKeys: ['eds-nsi-terminale'],
      });
      expect(accessNsi.commerciallyEntitled).toBe(false);
      expect(accessNsi.status).toBe('LOCKED');
      expect(accessNsi.lockReason).toBe('NOT_ENTITLED');
    });

    it('ne laisse pas une préférence de pin masquer un cours réel et autorisé', () => {
      const access = resolveAriaCourseAccess({
        courseKey: 'eds-maths-terminale',
        student: terminaleStudent,
        entitlements: courseEntitlement('eds-maths-terminale'),
        pinnedCourseKeys: [],
      });
      expect(access.academicallyRelevant).toBe(true);
      expect(access.productSupported).toBe(true);
      expect(access.commerciallyEntitled).toBe(true);
      expect(access.pinnedForAria).toBe(false);
      expect(access.status).toBe('AVAILABLE');
    });

    it('résout correctement les cours de voie technologique STMG', () => {
      const sgnAccess = resolveAriaCourseAccess({
        courseKey: 'stmg-sgn-premiere',
        student: premiereStmgStudent,
        entitlements: globalEntitlement,
        pinnedCourseKeys: ['stmg-sgn-premiere'],
      });
      expect(sgnAccess.academicallyRelevant).toBe(true);
      expect(sgnAccess.productSupported).toBe(true);
      expect(sgnAccess.commerciallyEntitled).toBe(true);
      expect(sgnAccess.status).toBe('AVAILABLE');
    });
  });

  describe('resolveStudentAriaCourses', () => {
    it('génère un sommaire complet pour tous les cours scolaires de l élève', () => {
      const summaries = resolveStudentAriaCourses({
        student: terminaleStudent,
        pinnedCourseKeys: ['eds-maths-terminale'],
        entitlements: courseEntitlement('eds-maths-terminale'),
      });

      expect(summaries.length).toBeGreaterThan(0);
      const keys = summaries.map((s) => s.courseKey);
      expect(keys).toContain('eds-maths-terminale');
      expect(keys).toContain('eds-nsi-terminale');
      expect(keys).toContain('tc-philosophie-terminale');
      // Ne contient aucun cours de Première
      expect(keys).not.toContain('eds-maths-premiere');
      // Ne contient aucun cours STMG
      expect(keys).not.toContain('stmg-sgn-premiere');
    });
  });
});
