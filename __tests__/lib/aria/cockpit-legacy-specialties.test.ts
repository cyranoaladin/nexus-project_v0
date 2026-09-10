import { resolveLegacySpecialties } from '@/lib/aria/cockpit/legacy-specialties';
import { listStudentEnrollments } from '@/lib/curriculum/enrollment';

jest.mock('@/lib/curriculum/enrollment', () => ({ listStudentEnrollments: jest.fn() }));

// Real catalog entries (lib/curriculum/catalog.ts), not invented: a course
// carrying a legacySubject, and one that deliberately doesn't (per this
// module's own docstring: "HGGSP, HLP" and similar are ignored rather than
// arbitrarily attached).
const COURSE_WITH_LEGACY_SUBJECT = 'tc-maths-quatrieme';
const COURSE_WITHOUT_LEGACY_SUBJECT = 'tc-grand-oral-terminale';

describe('resolveLegacySpecialties', () => {
  it('collects the legacySubject of SPECIALTY enrollments that have one', async () => {
    (listStudentEnrollments as jest.Mock).mockResolvedValue([
      { courseKey: COURSE_WITH_LEGACY_SUBJECT, kind: 'SPECIALTY', source: 'STAFF_ASSIGNED' },
    ]);
    const specialties = await resolveLegacySpecialties('student-1');
    expect(specialties).toEqual(['MATHEMATIQUES']);
  });

  it('ignores a SPECIALTY enrollment whose course has no legacySubject (e.g. Grand oral)', async () => {
    (listStudentEnrollments as jest.Mock).mockResolvedValue([
      { courseKey: COURSE_WITHOUT_LEGACY_SUBJECT, kind: 'SPECIALTY', source: 'STAFF_ASSIGNED' },
    ]);
    const specialties = await resolveLegacySpecialties('student-1');
    expect(specialties).toEqual([]);
  });

  it('ignores a non-SPECIALTY enrollment (e.g. OPTION) even when its course has a legacySubject', async () => {
    (listStudentEnrollments as jest.Mock).mockResolvedValue([
      { courseKey: COURSE_WITH_LEGACY_SUBJECT, kind: 'OPTION', source: 'STAFF_ASSIGNED' },
    ]);
    const specialties = await resolveLegacySpecialties('student-1');
    expect(specialties).toEqual([]);
  });

  it('returns an empty list when the student has no enrollments', async () => {
    (listStudentEnrollments as jest.Mock).mockResolvedValue([]);
    expect(await resolveLegacySpecialties('student-1')).toEqual([]);
  });
});
