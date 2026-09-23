import { toCanonicalAriaCourseKey } from '@/lib/aria/curriculum/course-key-aliases';

describe('toCanonicalAriaCourseKey', () => {
  it('translates real cockpit product-catalog keys to canonical curriculum enrollment keys', () => {
    expect(toCanonicalAriaCourseKey('maths-premiere-eds')).toBe('eds-maths-premiere');
    expect(toCanonicalAriaCourseKey('maths-terminale-eds')).toBe('eds-maths-terminale');
    expect(toCanonicalAriaCourseKey('nsi-premiere-eds')).toBe('eds-nsi-premiere');
    expect(toCanonicalAriaCourseKey('nsi-terminale-eds')).toBe('eds-nsi-terminale');
    expect(toCanonicalAriaCourseKey('maths-premiere-stmg')).toBe('stmg-maths-premiere');
    expect(toCanonicalAriaCourseKey('sgn-premiere-stmg')).toBe('stmg-sgn-premiere');
    expect(toCanonicalAriaCourseKey('management-premiere-stmg')).toBe('stmg-management-premiere');
    expect(toCanonicalAriaCourseKey('droit-eco-premiere-stmg')).toBe('stmg-droit-eco-premiere');
    expect(toCanonicalAriaCourseKey('physique-chimie-premiere-eds')).toBe('eds-physique-chimie-premiere');
    expect(toCanonicalAriaCourseKey('svt-terminale-eds')).toBe('eds-svt-terminale');
    expect(toCanonicalAriaCourseKey('ses-terminale-eds')).toBe('eds-ses-terminale');
    expect(toCanonicalAriaCourseKey('maths-expertes-terminale')).toBe('opt-maths-expertes-terminale');
    expect(toCanonicalAriaCourseKey('maths-complementaires-terminale')).toBe('opt-maths-complementaires-terminale');
  });

  it('returns an already-canonical key unchanged (no-op for every real-DB test and non-cockpit caller)', () => {
    expect(toCanonicalAriaCourseKey('eds-maths-premiere')).toBe('eds-maths-premiere');
  });

  it('returns an unknown key unchanged, leaving rejection to the caller\'s own canonical-catalog lookup', () => {
    expect(toCanonicalAriaCourseKey('not-a-real-course-key')).toBe('not-a-real-course-key');
  });

  it('returns an empty string unchanged', () => {
    expect(toCanonicalAriaCourseKey('')).toBe('');
  });
});
