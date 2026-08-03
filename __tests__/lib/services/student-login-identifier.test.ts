import {
  buildStudentLoginIdentifier,
  isStudentLoginIdentifierCompatible,
} from '@/lib/services/student-login-identifier';

describe('buildStudentLoginIdentifier', () => {
  it('produit un identifiant ASCII exploitable avec des noms accentués', () => {
    const identifier = buildStudentLoginIdentifier({
      firstName: 'Élève',
      lastName: 'D’Ângelo',
      uniqueSuffix: 'A1b2',
    });

    expect(identifier).toBe('eleve.d.angelo.a1b2@nexus-student.local');
    expect(identifier).toMatch(/^[a-z0-9]+(?:\.[a-z0-9]+)*@nexus-student\.local$/);
  });

  it('borne la partie locale sans produire de segment vide', () => {
    const identifier = buildStudentLoginIdentifier({
      firstName: 'É'.repeat(100),
      lastName: '---',
      uniqueSuffix: 'abcd',
    });
    const [localPart] = identifier.split('@');

    expect(localPart.length).toBeLessThanOrEqual(64);
    expect(identifier).toMatch(/^[a-z0-9]+(?:\.[a-z0-9]+)*@nexus-student\.local$/);
  });

  it('distingue deux homonymes et les variantes ne différant que par leurs accents', () => {
    const first = buildStudentLoginIdentifier({
      firstName: 'Élève',
      lastName: 'D’Ângelo',
      uniqueSuffix: 'child-one',
    });
    const second = buildStudentLoginIdentifier({
      firstName: 'Eleve',
      lastName: 'D Angelo',
      uniqueSuffix: 'child-two',
    });

    expect(first).not.toBe(second);
    expect(isStudentLoginIdentifierCompatible(first)).toBe(true);
    expect(isStudentLoginIdentifierCompatible(second)).toBe(true);
  });

  it('refuse un identifiant historique accentué mais préserve un email ASCII valide', () => {
    expect(isStudentLoginIdentifierCompatible('élève.test@nexus-student.local')).toBe(false);
    expect(isStudentLoginIdentifierCompatible('student@example.test')).toBe(true);
  });
});
