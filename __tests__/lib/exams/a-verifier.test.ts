import { A_VERIFIER, isAVerifier, requireResolved } from '@/lib/exams/a-verifier';

describe('A_VERIFIER sentinel', () => {
  test('isAVerifier detects the sentinel and only the sentinel', () => {
    expect(isAVerifier(A_VERIFIER)).toBe(true);
    expect(isAVerifier(6)).toBe(false);
    expect(isAVerifier(0)).toBe(false);
  });

  test('requireResolved throws with the field name when given the sentinel', () => {
    expect(() => requireResolved(A_VERIFIER, 'ep-histoire-geo.coefficientModaliteB')).toThrow(
      /ep-histoire-geo\.coefficientModaliteB.*À_VERIFIER/,
    );
  });

  test('requireResolved returns the value unchanged when it is a firm value', () => {
    expect(requireResolved(6, 'anything')).toBe(6);
  });
});
