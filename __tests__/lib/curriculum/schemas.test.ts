import {
  academicYearSchema,
  curriculumVersionSchema,
} from '@/lib/curriculum/schemas/curriculum';

describe('curriculum schemas', () => {
  test('accepts a consecutive academic year', () => {
    expect(academicYearSchema.parse('2026-2027')).toBe('2026-2027');
  });

  test.each(['2026', '2026/2027', '2026-2028'])('rejects invalid academic year %s', (academicYear) => {
    expect(() => academicYearSchema.parse(academicYear)).toThrow();
  });

  test('accepts an official curriculum version with an auditable source', () => {
    const parsed = curriculumVersionSchema.parse({
      id: 'fr-maths-seconde-gt-2026',
      version: '2026.1',
      status: 'PUBLISHED',
      subject: 'MATHEMATICS',
      level: 'SECONDE',
      track: 'GENERAL_TECHNOLOGICAL',
      subjectVariant: 'COMMON',
      effectiveFromAcademicYear: '2026-2027',
      officialSources: [
        {
          id: 'bo-2026-14-mene2602914a',
          authority: 'MEN',
          title: 'Programme de mathématiques de la classe de seconde générale et technologique',
          uri: 'https://www.education.gouv.fr/bo/2026/Hebdo14/MENE2602914A',
          publicationDate: '2026-04-02',
        },
      ],
    });

    expect(parsed.id).toBe('fr-maths-seconde-gt-2026');
  });

  test('rejects a published curriculum without an official source', () => {
    expect(() => curriculumVersionSchema.parse({
      id: 'fr-maths-seconde-gt-2026',
      version: '2026.1',
      status: 'PUBLISHED',
      subject: 'MATHEMATICS',
      level: 'SECONDE',
      track: 'GENERAL_TECHNOLOGICAL',
      subjectVariant: 'COMMON',
      effectiveFromAcademicYear: '2026-2027',
      officialSources: [],
    })).toThrow();
  });
});
