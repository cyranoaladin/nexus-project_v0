import {
  isExcludedPaperEntryAccountEmail,
  isVisiblePaperEntryHousehold,
  paperEntryVisibleStudentWhere,
} from '@/lib/bilans/saisie-papier/test-account-filter';

describe('Exclusion des comptes synthétiques de la recherche de saisie papier', () => {
  it.each([
    'parent@example.test',
    'eleve@invalid.residual',
    'prod-SMOKE@nexusreussite.academy',
    'agent_do_not_use@nexusreussite.academy',
    'account-residual@nexusreussite.academy',
    'parent-technique@nexusreussite.academy',
  ])('excludes %s case-insensitively', (email) => {
    expect(isExcludedPaperEntryAccountEmail(email)).toBe(true);
  });

  it.each([
    'famille.ben-salah@gmail.com',
    'eleve@nexus-student.local',
    null,
  ])('keeps a real account %s visible', (email) => {
    expect(isExcludedPaperEntryAccountEmail(email)).toBe(false);
  });

  it('excludes the whole household when either the student or parent identity matches', () => {
    expect(isVisiblePaperEntryHousehold({
      studentEmail: 'student-smoke@nexus-student.local',
      parentEmail: 'famille@gmail.com',
    })).toBe(false);
    expect(isVisiblePaperEntryHousehold({
      studentEmail: 'student@nexus-student.local',
      parentEmail: 'parent@example.test',
    })).toBe(false);
    expect(isVisiblePaperEntryHousehold({
      studentEmail: 'student@nexus-student.local',
      parentEmail: 'famille@gmail.com',
    })).toBe(true);
  });

  it('builds a database guard for both identities of the household', () => {
    const serialized = JSON.stringify(paperEntryVisibleStudentWhere());
    expect(serialized).toContain('"user"');
    expect(serialized).toContain('"parent"');
    expect(serialized).toContain('@example.test');
    expect(serialized).toContain('@invalid.residual');
    expect(serialized).toContain('parent-technique@nexusreussite.academy');
  });
});
