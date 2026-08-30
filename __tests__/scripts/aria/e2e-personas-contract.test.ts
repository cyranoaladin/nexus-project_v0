import { ARIA_E2E_PERSONAS } from '@/scripts/e2e/aria-personas';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ARIA immutable disposable E2E personas', () => {
  it('defines the qualification personas plus an equally entitled NSI ownership peer', () => {
    expect(ARIA_E2E_PERSONAS.map(({ key }) => key)).toEqual([
      'ariaTerminaleMaths',
      'ariaPremiereMaths',
      'ariaNsi',
      'ariaNsiPeer',
      'ariaStmgNoChat',
      'ariaIncompleteProfile',
      'ariaNotEntitled',
    ]);
    expect(new Set(ARIA_E2E_PERSONAS.map(({ email }) => email)).size).toBe(7);
  });

  it('uses canonical course-scoped grants and never grants the not-entitled persona', () => {
    expect(ARIA_E2E_PERSONAS.find(({ key }) => key === 'ariaTerminaleMaths')).toMatchObject({
      chosenCourseKeys: ['eds-maths-terminale', 'eds-nsi-terminale'],
      entitlementCourseKeys: ['eds-maths-terminale', 'eds-nsi-terminale'],
    });
    expect(ARIA_E2E_PERSONAS.find(({ key }) => key === 'ariaPremiereMaths')).toMatchObject({
      chosenCourseKeys: ['eds-maths-premiere'],
      entitlementCourseKeys: ['eds-maths-premiere'],
    });
    expect(ARIA_E2E_PERSONAS.find(({ key }) => key === 'ariaNsi')).toMatchObject({
      chosenCourseKeys: ['eds-nsi-premiere'],
      entitlementCourseKeys: ['eds-nsi-premiere'],
    });
    expect(ARIA_E2E_PERSONAS.find(({ key }) => key === 'ariaNsiPeer')).toMatchObject({
      chosenCourseKeys: ['eds-nsi-premiere'],
      entitlementCourseKeys: ['eds-nsi-premiere'],
    });
    expect(ARIA_E2E_PERSONAS.find(({ key }) => key === 'ariaStmgNoChat')).toMatchObject({
      academicTrack: 'STMG',
      entitlementCourseKeys: ['stmg-sgn-premiere'],
    });
    expect(ARIA_E2E_PERSONAS.find(({ key }) => key === 'ariaIncompleteProfile')).toMatchObject({
      gradeLevel: 'AUTRE',
      chosenCourseKeys: [],
      entitlementCourseKeys: [],
    });
    expect(ARIA_E2E_PERSONAS.find(({ key }) => key === 'ariaNotEntitled')).toMatchObject({
      chosenCourseKeys: ['eds-nsi-premiere'],
      entitlementCourseKeys: [],
    });
  });

  it('seeds and exposes every persona through the private runtime credential manifest', () => {
    const seed = source('scripts/seed-e2e-db.ts');
    expect(seed).toMatch(/createAriaE2EPersonas/);
    expect(seed).toMatch(/\.\.\.ariaCredentials/);
    expect(seed).not.toMatch(/\.catch\(\(\) => \{\}\)/);
    expect(seed).not.toContain('Skip duplicates silently');
    const credentials = source('e2e/helpers/credentials.ts');
    const auth = source('e2e/helpers/auth.ts');
    const verifier = source('scripts/verify-e2e-seed.ts');
    for (const { key } of ARIA_E2E_PERSONAS) {
      expect(credentials).toContain(`'${key}'`);
      expect(auth).toContain(`${key}: '/dashboard/eleve'`);
      expect(verifier).toContain(`${key}: UserRole.ELEVE`);
    }
  });
});
