/**
 * Unit tests for Nexus Index™ — Pure computation tests (no DB).
 *
 * Tests cover:
 * - Each pillar independently
 * - Global score composition
 * - Trend computation
 * - Edge cases (empty data, single session, extreme values)
 * - Level classification
 */

import {
  computeFromData,
  computeAssiduite,
  computeProgression,
  computeEngagement,
  computeRegularite,
  computeTrend,
  PILLAR_WEIGHTS,
  MIN_SESSIONS_FOR_INDEX,
  type NexusIndexData,
  type NexusIndexResult,
} from '@/lib/nexus-index';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function makeSession(
  overrides: Partial<{
    status: string;
    scheduledDate: Date;
    rating: number | null;
    studentAttended: boolean | null;
    completedAt: Date | null;
  }> = {}
) {
  return {
    status: 'COMPLETED',
    scheduledDate: daysAgo(7),
    rating: 4,
    studentAttended: true,
    completedAt: daysAgo(7),
    ...overrides,
  };
}

function makeReport(
  overrides: Partial<{
    performanceRating: number;
    engagementLevel: string | null;
    createdAt: Date;
  }> = {}
) {
  return {
    performanceRating: 4,
    engagementLevel: 'HIGH',
    createdAt: daysAgo(7),
    ...overrides,
  };
}

function makeData(overrides: Partial<NexusIndexData> = {}): NexusIndexData {
  return {
    sessions: [
      makeSession({ scheduledDate: daysAgo(21) }),
      makeSession({ scheduledDate: daysAgo(14) }),
      makeSession({ scheduledDate: daysAgo(7) }),
    ],
    reports: [makeReport()],
    ariaConversationCount: 2,
    ariaFeedbackCount: 3,
    diagnosticCount: 1,
    student: { id: 'student-1', createdAt: daysAgo(60) },
    ...overrides,
  };
}

// ─── computeFromData ─────────────────────────────────────────────────────────

describe('computeFromData', () => {
  it('returns null when student is null', () => {
    const result = computeFromData(makeData({ student: null }));
    expect(result).toBeNull();
  });

  it('returns zeroed pillars when sessions < MIN_SESSIONS_FOR_INDEX', () => {
    const result = computeFromData(
      makeData({
        sessions: [makeSession(), makeSession()], // Only 2
      })
    );
    expect(result).not.toBeNull();
    expect(result!.globalScore).toBe(0);
    expect(result!.pillars.every((p) => p.score === 0)).toBe(true);
    expect(result!.trend).toBe('stable');
    expect(result!.level).toBe('debutant');
  });

  it('returns a valid NexusIndexResult with sufficient data', () => {
    const result = computeFromData(makeData());
    expect(result).not.toBeNull();
    expect(result!.globalScore).toBeGreaterThanOrEqual(0);
    expect(result!.globalScore).toBeLessThanOrEqual(100);
    expect(result!.pillars).toHaveLength(4);
    expect(result!.computedAt).toBeDefined();
    expect(result!.dataPoints).toBeGreaterThan(0);
  });

  it('pillar weights sum to 1.0', () => {
    const sum = Object.values(PILLAR_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('global score equals sum of weighted pillars', () => {
    const result = computeFromData(makeData())!;
    const expectedGlobal = result.pillars.reduce(
      (sum, p) => sum + p.weighted,
      0
    );
    expect(result.globalScore).toBe(Math.max(0, Math.min(100, expectedGlobal)));
  });
});

// ─── Assiduité ───────────────────────────────────────────────────────────────

describe('computeAssiduite', () => {
  it('returns 100 for all completed + attended sessions', () => {
    const sessions = [
      makeSession({ status: 'COMPLETED', studentAttended: true }),
      makeSession({ status: 'COMPLETED', studentAttended: true }),
      makeSession({ status: 'COMPLETED', studentAttended: true }),
    ];
    expect(computeAssiduite(sessions)).toBe(100);
  });

  it('returns 80 for completed sessions with null attendance', () => {
    const sessions = [
      makeSession({ status: 'COMPLETED', studentAttended: null }),
    ];
    expect(computeAssiduite(sessions)).toBe(80);
  });

  it('returns 0 for all cancelled sessions', () => {
    const sessions = [
      makeSession({ status: 'CANCELLED' }),
      makeSession({ status: 'CANCELLED' }),
    ];
    expect(computeAssiduite(sessions)).toBe(0);
  });

  it('returns 0 for all no-show sessions', () => {
    const sessions = [
      makeSession({ status: 'NO_SHOW' }),
      makeSession({ status: 'NO_SHOW' }),
    ];
    expect(computeAssiduite(sessions)).toBe(0);
  });

  it('returns 50 when no relevant sessions exist', () => {
    // Only future scheduled sessions
    const sessions = [makeSession({ status: 'SCHEDULED' })];
    expect(computeAssiduite(sessions)).toBe(50);
  });

  it('handles mixed statuses correctly', () => {
    const sessions = [
      makeSession({ status: 'COMPLETED', studentAttended: true }), // 1.0
      makeSession({ status: 'CANCELLED' }), // 0
      makeSession({ status: 'COMPLETED', studentAttended: true }), // 1.0
      makeSession({ status: 'NO_SHOW' }), // 0
    ];
    // 2.0 / 4 = 0.5 → 50
    expect(computeAssiduite(sessions)).toBe(50);
  });

  it('ignores SCHEDULED and CONFIRMED sessions', () => {
    const sessions = [
      makeSession({ status: 'COMPLETED', studentAttended: true }),
      makeSession({ status: 'SCHEDULED' }),
      makeSession({ status: 'CONFIRMED' }),
    ];
    // Only 1 relevant session (COMPLETED), 1/1 = 100
    expect(computeAssiduite(sessions)).toBe(100);
  });
});

// ─── Progression ─────────────────────────────────────────────────────────────

describe('computeProgression', () => {
  it('returns 50 when no reports exist', () => {
    expect(computeProgression([])).toBe(50);
  });

  it('returns 100 for all 5-star ratings', () => {
    const reports = [
      makeReport({ performanceRating: 5 }),
      makeReport({ performanceRating: 5 }),
    ];
    expect(computeProgression(reports)).toBe(100);
  });

  it('returns 0 for all 1-star ratings', () => {
    const reports = [
      makeReport({ performanceRating: 1 }),
      makeReport({ performanceRating: 1 }),
    ];
    expect(computeProgression(reports)).toBe(0);
  });

  it('returns 50 for all 3-star ratings', () => {
    const reports = [
      makeReport({ performanceRating: 3 }),
      makeReport({ performanceRating: 3 }),
    ];
    expect(computeProgression(reports)).toBe(50);
  });

  it('weights recent reports more heavily', () => {
    const reports = [
      makeReport({ performanceRating: 2, createdAt: daysAgo(60) }), // Old, weight 1
      makeReport({ performanceRating: 5, createdAt: daysAgo(5) }), // Recent, weight 2
    ];
    // Old: (2-1)/4*100 = 25, weight 1 → 25
    // Recent: (5-1)/4*100 = 100, weight 2 → 200
    // Total: 225 / 3 = 75
    expect(computeProgression(reports)).toBe(75);
  });
});

// ─── Engagement ──────────────────────────────────────────────────────────────

describe('computeEngagement', () => {
  it('returns 0 for zero activity', () => {
    expect(computeEngagement(0, 0, 0, 0, 0)).toBe(0);
  });

  it('returns 100 for maximum activity', () => {
    expect(computeEngagement(10, 5, 10, 2, 5)).toBe(100);
  });

  it('caps at 100 for excessive activity', () => {
    expect(computeEngagement(100, 100, 100, 100, 100)).toBe(100);
  });

  it('computes partial engagement correctly', () => {
    // 5 sessions (50% of 40 = 20) + 0 ARIA + 0 feedback + 1 diagnostic (50% of 10 = 5) + 0 reports
    expect(computeEngagement(5, 0, 0, 1, 0)).toBe(25);
  });

  it('values sessions most heavily', () => {
    const sessionsOnly = computeEngagement(10, 0, 0, 0, 0);
    const ariaOnly = computeEngagement(0, 5, 0, 0, 0);
    expect(sessionsOnly).toBeGreaterThan(ariaOnly);
  });
});

// ─── Régularité ──────────────────────────────────────────────────────────────

describe('computeRegularite', () => {
  it('returns 30 for fewer than 2 completed sessions', () => {
    expect(computeRegularite([makeSession()], daysAgo(60))).toBe(30);
  });

  it('returns high score for weekly sessions with no gaps', () => {
    const sessions = [
      makeSession({ scheduledDate: daysAgo(28) }),
      makeSession({ scheduledDate: daysAgo(21) }),
      makeSession({ scheduledDate: daysAgo(14) }),
      makeSession({ scheduledDate: daysAgo(7) }),
    ];
    const score = computeRegularite(sessions, daysAgo(35));
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it('penalizes long gaps between sessions', () => {
    const regularSessions = [
      makeSession({ scheduledDate: daysAgo(28) }),
      makeSession({ scheduledDate: daysAgo(21) }),
      makeSession({ scheduledDate: daysAgo(14) }),
      makeSession({ scheduledDate: daysAgo(7) }),
    ];

    const gappySessions = [
      makeSession({ scheduledDate: daysAgo(90) }),
      makeSession({ scheduledDate: daysAgo(60) }),
      makeSession({ scheduledDate: daysAgo(7) }),
    ];

    const regularScore = computeRegularite(regularSessions, daysAgo(35));
    const gappyScore = computeRegularite(gappySessions, daysAgo(100));

    expect(regularScore).toBeGreaterThan(gappyScore);
  });
});

// ─── Trend ───────────────────────────────────────────────────────────────────

describe('computeTrend', () => {
  it('returns stable when no data', () => {
    expect(computeTrend([], [])).toBe('stable');
  });

  it('returns up when recent performance is better', () => {
    const sessions = [
      // Previous window: cancelled
      makeSession({ status: 'CANCELLED', scheduledDate: daysAgo(45) }),
      makeSession({ status: 'CANCELLED', scheduledDate: daysAgo(40) }),
      // Recent window: completed
      makeSession({ status: 'COMPLETED', scheduledDate: daysAgo(10) }),
      makeSession({ status: 'COMPLETED', scheduledDate: daysAgo(5) }),
    ];
    const reports = [
      makeReport({ performanceRating: 2, createdAt: daysAgo(45) }),
      makeReport({ performanceRating: 5, createdAt: daysAgo(5) }),
    ];
    expect(computeTrend(sessions, reports)).toBe('up');
  });

  it('returns down when recent performance is worse', () => {
    const sessions = [
      // Previous window: completed
      makeSession({ status: 'COMPLETED', scheduledDate: daysAgo(45) }),
      makeSession({ status: 'COMPLETED', scheduledDate: daysAgo(40) }),
      // Recent window: cancelled
      makeSession({ status: 'CANCELLED', scheduledDate: daysAgo(10) }),
      makeSession({ status: 'CANCELLED', scheduledDate: daysAgo(5) }),
    ];
    const reports = [
      makeReport({ performanceRating: 5, createdAt: daysAgo(45) }),
      makeReport({ performanceRating: 1, createdAt: daysAgo(5) }),
    ];
    expect(computeTrend(sessions, reports)).toBe('down');
  });

  it('returns stable when performance is consistent', () => {
    const sessions = [
      makeSession({ status: 'COMPLETED', scheduledDate: daysAgo(45) }),
      makeSession({ status: 'COMPLETED', scheduledDate: daysAgo(10) }),
    ];
    const reports = [
      makeReport({ performanceRating: 3, createdAt: daysAgo(45) }),
      makeReport({ performanceRating: 3, createdAt: daysAgo(10) }),
    ];
    expect(computeTrend(sessions, reports)).toBe('stable');
  });
});

// ─── Level Classification ────────────────────────────────────────────────────

describe('level classification', () => {
  it('classifies excellent (≥80)', () => {
    const data = makeData({
      sessions: Array.from({ length: 10 }, (_, i) =>
        makeSession({
          status: 'COMPLETED',
          studentAttended: true,
          scheduledDate: daysAgo(7 * (i + 1)),
        })
      ),
      reports: Array.from({ length: 5 }, (_, i) =>
        makeReport({ performanceRating: 5, createdAt: daysAgo(7 * (i + 1)) })
      ),
      ariaConversationCount: 5,
      ariaFeedbackCount: 10,
      diagnosticCount: 2,
      student: { id: 's1', createdAt: daysAgo(90) },
    });
    const result = computeFromData(data)!;
    expect(result.level).toBe('excellent');
    expect(result.globalScore).toBeGreaterThanOrEqual(80);
  });

  it('classifies debutant for minimal data', () => {
    const result = computeFromData(
      makeData({ sessions: [makeSession(), makeSession()] })
    )!;
    expect(result.level).toBe('debutant');
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles student with zero sessions gracefully', () => {
    const result = computeFromData(makeData({ sessions: [] }));
    expect(result).not.toBeNull();
    expect(result!.globalScore).toBe(0);
  });

  it('handles student created today', () => {
    const result = computeFromData(
      makeData({
        student: { id: 's1', createdAt: new Date() },
        sessions: [
          makeSession({ scheduledDate: new Date() }),
          makeSession({ scheduledDate: new Date() }),
          makeSession({ scheduledDate: new Date() }),
        ],
      })
    );
    expect(result).not.toBeNull();
    expect(result!.globalScore).toBeGreaterThanOrEqual(0);
    expect(result!.globalScore).toBeLessThanOrEqual(100);
  });

  it('never returns score below 0 or above 100', () => {
    // Extreme negative scenario
    const worstCase = computeFromData(
      makeData({
        sessions: [
          makeSession({ status: 'NO_SHOW' }),
          makeSession({ status: 'CANCELLED' }),
          makeSession({ status: 'CANCELLED' }),
        ],
        reports: [makeReport({ performanceRating: 1 })],
        ariaConversationCount: 0,
        ariaFeedbackCount: 0,
        diagnosticCount: 0,
      })
    )!;
    expect(worstCase.globalScore).toBeGreaterThanOrEqual(0);
    expect(worstCase.globalScore).toBeLessThanOrEqual(100);

    // Extreme positive scenario
    const bestCase = computeFromData(
      makeData({
        sessions: Array.from({ length: 20 }, (_, i) =>
          makeSession({
            status: 'COMPLETED',
            studentAttended: true,
            scheduledDate: daysAgo(3 * (i + 1)),
          })
        ),
        reports: Array.from({ length: 10 }, (_, i) =>
          makeReport({
            performanceRating: 5,
            createdAt: daysAgo(3 * (i + 1)),
          })
        ),
        ariaConversationCount: 100,
        ariaFeedbackCount: 100,
        diagnosticCount: 100,
        student: { id: 's1', createdAt: daysAgo(90) },
      })
    )!;
    expect(bestCase.globalScore).toBeGreaterThanOrEqual(0);
    expect(bestCase.globalScore).toBeLessThanOrEqual(100);
  });

  it('MIN_SESSIONS_FOR_INDEX is 3', () => {
    expect(MIN_SESSIONS_FOR_INDEX).toBe(3);
  });

  it('computedAt is a valid ISO string', () => {
    const result = computeFromData(makeData())!;
    expect(() => new Date(result.computedAt)).not.toThrow();
    expect(new Date(result.computedAt).toISOString()).toBe(result.computedAt);
  });

  it('dataPoints counts all data sources', () => {
    const data = makeData({
      sessions: [makeSession(), makeSession(), makeSession()],
      reports: [makeReport(), makeReport()],
      ariaConversationCount: 3,
      diagnosticCount: 1,
    });
    const result = computeFromData(data)!;
    // 3 sessions + 2 reports + 3 aria + 1 diagnostic = 9
    expect(result.dataPoints).toBe(9);
  });
});
