import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HANDLERS = [
  'create-attempt.ts',
  'get-attempt.ts',
  'patch-answers.ts',
  'submit-attempt.ts',
  'get-status.ts',
  'get-report.ts',
] as const;

describe('Canonical attempt pack feature-flag boundary', () => {
  test.each(HANDLERS)('%s applies the shared guard exactly once', (file) => {
    const source = readFileSync(resolve(process.cwd(), 'lib/bilans/api', file), 'utf8');

    expect(source.match(/\bassertAttemptPackEnabled\(/g) ?? []).toHaveLength(1);
    expect(source).not.toMatch(/\bdependencies\.resolvePack\(/);
    expect(source).not.toMatch(/\bresolveEnabledPack\(/);
    expect(source).not.toMatch(/\b403\b/);
  });

  test('submit checks the pack before idempotency, row locking or writes', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'lib/bilans/api/submit-attempt.ts'),
      'utf8',
    );
    const guard = source.indexOf('assertAttemptPackEnabled(');

    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(source.lastIndexOf('executeIdempotently({'));
    expect(guard).toBeLessThan(source.indexOf('FOR UPDATE'));
  });

  test.each([
    ['create-attempt.ts', 'await resolveSessionStudent('],
    ['get-attempt.ts', 'canonicalAssessmentAttempt.findFirst('],
    ['patch-answers.ts', 'await attempts.findFirst('],
    ['submit-attempt.ts', 'canonicalAssessmentAttempt.findFirst('],
    ['get-status.ts', 'canonicalAssessmentAttempt.findFirst('],
    ['get-report.ts', 'await resolveAudience('],
  ])('%s resolves ownership before applying the pack guard', (file, ownershipMarker) => {
    const source = readFileSync(resolve(process.cwd(), 'lib/bilans/api', file), 'utf8');

    expect(source.indexOf(ownershipMarker)).toBeGreaterThan(-1);
    expect(source.indexOf(ownershipMarker)).toBeLessThan(source.indexOf('assertAttemptPackEnabled('));
  });
});
