import { computeMastery, type MasteryEvidencePoint } from '@/lib/aria/domain/mastery/mastery-level';

function point(outcome: MasteryEvidencePoint['outcome'], daysAgo: number): MasteryEvidencePoint {
  return { outcome, observedAt: new Date(Date.UTC(2026, 0, 10 - daysAgo)) };
}

describe('computeMastery', () => {
  it('returns NOT_STARTED with no evidence at all', () => {
    expect(computeMastery([])).toBe('NOT_STARTED');
  });

  it('returns DEVELOPING after a single incorrect attempt', () => {
    expect(computeMastery([point('INCORRECT', 0)])).toBe('DEVELOPING');
  });

  it('returns DEVELOPING after a single correct attempt (streak of 1)', () => {
    expect(computeMastery([point('CORRECT', 0)])).toBe('DEVELOPING');
  });

  it('returns DEVELOPING after a partially-correct attempt (does not extend the streak)', () => {
    expect(computeMastery([point('PARTIALLY_CORRECT', 0)])).toBe('DEVELOPING');
  });

  it('returns PROFICIENT after two consecutive correct attempts', () => {
    expect(computeMastery([point('CORRECT', 0), point('CORRECT', 1)])).toBe('PROFICIENT');
  });

  it('returns MASTERED after three consecutive correct attempts', () => {
    expect(computeMastery([point('CORRECT', 0), point('CORRECT', 1), point('CORRECT', 2)])).toBe('MASTERED');
  });

  it('stays MASTERED with a longer correct streak (caps, does not keep climbing)', () => {
    expect(computeMastery([
      point('CORRECT', 0), point('CORRECT', 1), point('CORRECT', 2), point('CORRECT', 3), point('CORRECT', 4),
    ])).toBe('MASTERED');
  });

  it('a recent slip resets the streak even with an older correct run (recency-weighted, not cumulative)', () => {
    expect(computeMastery([
      point('INCORRECT', 0), point('CORRECT', 1), point('CORRECT', 2), point('CORRECT', 3),
    ])).toBe('DEVELOPING');
  });

  it('breaks the streak at the most recent non-correct attempt, counting only what follows it', () => {
    expect(computeMastery([
      point('CORRECT', 0), point('CORRECT', 1), point('INCORRECT', 2), point('CORRECT', 3),
    ])).toBe('PROFICIENT');
  });

  it('is order-independent: sorts by observedAt internally rather than trusting array order', () => {
    const newestFirst = [point('CORRECT', 0), point('CORRECT', 1), point('CORRECT', 2)];
    const shuffled = [newestFirst[1]!, newestFirst[2]!, newestFirst[0]!];
    expect(computeMastery(shuffled)).toBe(computeMastery(newestFirst));
    expect(computeMastery(shuffled)).toBe('MASTERED');
  });

  it('a partially-correct attempt breaks a streak exactly like an incorrect one', () => {
    expect(computeMastery([
      point('PARTIALLY_CORRECT', 0), point('CORRECT', 1), point('CORRECT', 2),
    ])).toBe('DEVELOPING');
  });
});
