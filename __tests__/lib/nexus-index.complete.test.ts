/**
 * Nexus Index — Complete Test Suite
 *
 * Tests pure computation functions (no DB):
 * - computeFromData, computeAssiduite, computeProgression,
 *   computeEngagement, computeRegularite, computeTrend
 * - PILLAR_WEIGHTS, MIN_SESSIONS_FOR_INDEX
 *
 * Source: lib/nexus-index.ts
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

function makeSession(overrides: Partial<{
  status: string;
  scheduledDate: Date;
  rating: number | null;
  studentAttended: boolean | null;
  completedAt: Date | null;
}> = {}) {
  return {
    status: 'COMPLETED',
    scheduledDate: new Date('2026-01-15'),
    rating: null,
    studentAttended: true,
    completedAt: new Date('2026-01-15'),
    ...overrides,
  };
}

function makeReport(overrides: Partial<{
  performanceRating: number;
  engagementLevel: string | null;
  createdAt: Date;
}> = {}) {
  return {
    performanceRating: 4,
    engagementLevel: 'HIGH',
    createdAt: new Date('2026-01-15'),
    ...overrides,
  };
}

function buildBaseData(overrides: Partial<NexusIndexData> = {}): NexusIndexData {
  return {
    sessions: [
      makeSession({ scheduledDate: new Date('2026-01-01') }),
      makeSession({ scheduledDate: new Date('2026-01-08') }),
      makeSession({ scheduledDate: new Date('2026-01-15') }),
      makeSession({ scheduledDate: new Date('2026-01-22') }),
    ],
    reports: [
      makeReport({ performanceRating: 4, createdAt: new Date('2026-01-01') }),
      makeReport({ performanceRating: 4, createdAt: new Date('2026-01-15') }),
    ],
    ariaConversationCount: 3,
    ariaFeedbackCount: 5,
    diagnosticCount: 1,
    student: { id: 'student-1', createdAt: new Date('2025-12-01') },
    ...overrides,
  };
}

// ─── computeFromData ─────────────────────────────────────────────────────────

describe('computeFromData', () => {
  it('should return null when student is null', () => {
    // Arrange
    const data = buildBaseData({ student: null });

    // Act
    const result = computeFromData(data);

    // Assert
    expect(result).toBeNull();
  });

  it('should return NexusIndex=0 for new student with insufficient sessions', () => {
    // Arrange: fewer than MIN_SESSIONS_FOR_INDEX sessions
    const data = buildBaseData({
      sessions: [makeSession(), makeSession()],
    });

    // Act
    const result = computeFromData(data);

    // Assert
    expect(result).not.toBeNull();
    expect(result!.globalScore).toBe(0);
    expect(result!.level).toBe('debutant');
    expect(result!.trend).toBe('stable');
  });

  it('should compute a valid NexusIndex for student with enough data', () => {
    // Arrange
    const data = buildBaseData();

    // Act
    const result = computeFromData(data);

    // Assert
    expect(result).not.toBeNull();
    expect(result!.globalScore).toBeGreaterThanOrEqual(0);
    expect(result!.globalScore).toBeLessThanOrEqual(100);
    expect(result!.pillars).toHaveLength(4);
    expect(result!.computedAt).toBeTruthy();
  });

  it('should cap NexusIndex at 100', () => {
    // Arrange: perfect data
    const data = buildBaseData({
      sessions: Array.from({ length: 20 }, (_, i) =>
        makeSession({
          scheduledDate: new Date(2026, 0, i + 1),
          studentAttended: true,
        })
      ),
      reports: Array.from({ length: 10 }, (_, i) =>
        makeReport({
          performanceRating: 5,
          createdAt: new Date(2026, 0, i + 1),
        })
      ),
      ariaConversationCount: 10,
      ariaFeedbackCount: 20,
      diagnosticCount: 5,
    });

    // Act
    const result = computeFromData(data);

    // Assert
    expect(result).not.toBeNull();
    expect(result!.globalScore).toBeLessThanOrEqual(100);
  });

  it('should include all 4 pillars with correct keys', () => {
    // Arrange
    const data = buildBaseData();

    // Act
    const result = computeFromData(data);

    // Assert
    expect(result).not.toBeNull();
    const keys = result!.pillars.map((p) => p.key);
    expect(keys).toContain('assiduite');
    expect(keys).toContain('progression');
    expect(keys).toContain('engagement');
    expect(keys).toContain('regularite');
  });

  it('should be deterministic for identical inputs', () => {
    // Arrange
    const data = buildBaseData();

    // Act
    const r1 = computeFromData(data);
    const r2 = computeFromData(data);

    // Assert
    expect(r1!.globalScore).toBe(r2!.globalScore);
    expect(r1!.level).toBe(r2!.level);
    expect(r1!.trend).toBe(r2!.trend);
  });

  it('should include dataPoints count', () => {
    // Arrange
    const data = buildBaseData();

    // Act
    const result = computeFromData(data);

    // Assert: sessions + reports + ariaConversations + diagnostics
    expect(result).not.toBeNull();
    expect(result!.dataPoints).toBe(4 + 2 + 3 + 1);
  });
});

// ─── computeAssiduite ────────────────────────────────────────────────────────

describe('computeAssiduite', () => {
  it('should return 100 for all COMPLETED sessions with studentAttended=true', () => {
    // Arrange
    const sessions = [
      makeSession({ status: 'COMPLETED', studentAttended: true }),
      makeSession({ status: 'COMPLETED', studentAttended: true }),
      makeSession({ status: 'COMPLETED', studentAttended: true }),
    ];

    // Act
    const score = computeAssiduite(sessions);

    // Assert
    expect(score).toBe(100);
  });

  it('should return 50 (neutral) when no past sessions exist', () => {
    // Arrange: only future sessions
    const sessions = [
      makeSession({ status: 'SCHEDULED' }),
      makeSession({ status: 'CONFIRMED' }),
    ];

    // Act
    const score = computeAssiduite(sessions);

    // Assert
    expect(score).toBe(50);
  });

  it('should return 0 for all NO_SHOW sessions', () => {
    // Arrange
    const sessions = [
      makeSession({ status: 'NO_SHOW' }),
      makeSession({ status: 'NO_SHOW' }),
    ];

    // Act
    const score = computeAssiduite(sessions);

    // Assert
    expect(score).toBe(0);
  });

  it('should give 80% credit for COMPLETED with studentAttended=null', () => {
    // Arrange
    const sessions = [
      makeSession({ status: 'COMPLETED', studentAttended: null }),
    ];

    // Act
    const score = computeAssiduite(sessions);

    // Assert: 0.8/1 * 100 = 80
    expect(score).toBe(80);
  });

  it('should penalize CANCELLED sessions', () => {
    // Arrange: 1 completed, 1 cancelled
    const sessions = [
      makeSession({ status: 'COMPLETED', studentAttended: true }),
      makeSession({ status: 'CANCELLED' }),
    ];

    // Act
    const score = computeAssiduite(sessions);

    // Assert: 1.0/2 * 100 = 50
    expect(score).toBe(50);
  });

  it('should exclude SCHEDULED and CONFIRMED from calculation', () => {
    // Arrange
    const sessions = [
      makeSession({ status: 'COMPLETED', studentAttended: true }),
      makeSession({ status: 'SCHEDULED' }),
      makeSession({ status: 'CONFIRMED' }),
    ];

    // Act
    const score = computeAssiduite(sessions);

    // Assert: only 1 relevant session (COMPLETED), score = 100
    expect(score).toBe(100);
  });
});

// ─── computeProgression ──────────────────────────────────────────────────────

describe('computeProgression', () => {
  it('should return 50 (neutral) when no reports exist', () => {
    expect(computeProgression([])).toBe(50);
  });

  it('should return 100 for all 5-star ratings', () => {
    // Arrange
    const reports = [
      makeReport({ performanceRating: 5 }),
      makeReport({ performanceRating: 5 }),
    ];

    // Act
    const score = computeProgression(reports);

    // Assert: (5-1)/4 * 100 = 100
    expect(score).toBe(100);
  });

  it('should return 0 for all 1-star ratings', () => {
    // Arrange
    const reports = [
      makeReport({ performanceRating: 1 }),
      makeReport({ performanceRating: 1 }),
    ];

    // Act
    const score = computeProgression(reports);

    // Assert: (1-1)/4 * 100 = 0
    expect(score).toBe(0);
  });

  it('should weight recent reports 2x vs older ones', () => {
    // Arrange: old report = 1 star, recent report = 5 stars
    const now = new Date();
    const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

    const reports = [
      makeReport({ performanceRating: 1, createdAt: oldDate }),
      makeReport({ performanceRating: 5, createdAt: recentDate }),
    ];

    // Act
    const score = computeProgression(reports);

    // Assert: weighted avg should be closer to 5 than to 1
    // old: weight=1, normalized=0; recent: weight=2, normalized=100
    // weighted = (0*1 + 100*2) / (1+2) = 200/3 ≈ 67
    expect(score).toBeGreaterThan(50);
  });
});

// ─── computeEngagement ───────────────────────────────────────────────────────

describe('computeEngagement', () => {
  it('should return 0 for no engagement at all', () => {
    expect(computeEngagement(0, 0, 0, 0, 0)).toBe(0);
  });

  it('should return 100 for maximum engagement across all signals', () => {
    // Arrange: all maxed out
    const score = computeEngagement(10, 5, 10, 2, 5);

    // Assert: 40 + 25 + 15 + 10 + 10 = 100
    expect(score).toBe(100);
  });

  it('should cap session points at 40 (10 sessions = max)', () => {
    // Arrange: 20 sessions (above cap)
    const score = computeEngagement(20, 0, 0, 0, 0);

    // Assert: min(20/10, 1) * 40 = 40
    expect(score).toBe(40);
  });

  it('should cap ARIA conversation points at 25 (5 conversations = max)', () => {
    const score = computeEngagement(0, 10, 0, 0, 0);
    expect(score).toBe(25);
  });

  it('should cap feedback points at 15 (10 feedbacks = max)', () => {
    const score = computeEngagement(0, 0, 20, 0, 0);
    expect(score).toBe(15);
  });

  it('should cap diagnostic points at 10 (2 diagnostics = max)', () => {
    const score = computeEngagement(0, 0, 0, 5, 0);
    expect(score).toBe(10);
  });

  it('should cap report points at 10 (5 reports = max)', () => {
    const score = computeEngagement(0, 0, 0, 0, 10);
    expect(score).toBe(10);
  });

  it('should reward ARIA usage up to a ceiling', () => {
    // Arrange: only ARIA usage
    const withAria = computeEngagement(0, 5, 10, 0, 0);
    const withoutAria = computeEngagement(0, 0, 0, 0, 0);

    // Assert
    expect(withAria).toBeGreaterThan(withoutAria);
    expect(withAria).toBeLessThanOrEqual(40); // 25 + 15 = 40 max from ARIA
  });
});

// ─── computeRegularite ───────────────────────────────────────────────────────

describe('computeRegularite', () => {
  it('should return 30 (low baseline) for fewer than 2 sessions', () => {
    const sessions = [makeSession()];
    const createdAt = new Date('2025-12-01');

    expect(computeRegularite(sessions, createdAt)).toBe(30);
  });

  it('should return high score for weekly sessions without gaps', () => {
    // Arrange: 4 sessions, 1 per week
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession({
        scheduledDate: new Date(now.getTime() - (i * 7 + 1) * 24 * 60 * 60 * 1000),
      })
    );
    const createdAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Act
    const score = computeRegularite(sessions, createdAt);

    // Assert
    expect(score).toBeGreaterThan(50);
  });

  it('should penalize long gaps (>14 days) between sessions', () => {
    // Arrange: 2 sessions with 30-day gap
    const now = new Date();
    const sessions = [
      makeSession({ scheduledDate: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000) }),
      makeSession({ scheduledDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) }),
    ];
    const createdAt = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000);

    // Act
    const score = computeRegularite(sessions, createdAt);

    // Assert: should have gap penalty
    expect(score).toBeLessThan(80);
  });

  it('should return value in [0, 100] range', () => {
    // Arrange
    const now = new Date();
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({
        scheduledDate: new Date(now.getTime() - i * 3 * 24 * 60 * 60 * 1000),
      })
    );
    const createdAt = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Act
    const score = computeRegularite(sessions, createdAt);

    // Assert
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ─── computeTrend ────────────────────────────────────────────────────────────

describe('computeTrend', () => {
  it('should return "stable" when no sessions or reports', () => {
    expect(computeTrend([], [])).toBe('stable');
  });

  it('should return "up" when recent performance is better', () => {
    // Arrange
    const now = new Date();
    const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const oldDate = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000);

    const sessions = [
      makeSession({ status: 'CANCELLED', scheduledDate: oldDate }),
      makeSession({ status: 'COMPLETED', scheduledDate: recentDate }),
    ];
    const reports = [
      makeReport({ performanceRating: 2, createdAt: oldDate }),
      makeReport({ performanceRating: 5, createdAt: recentDate }),
    ];

    // Act
    const trend = computeTrend(sessions, reports);

    // Assert
    expect(trend).toBe('up');
  });

  it('should return "down" when recent performance is worse', () => {
    // Arrange
    const now = new Date();
    const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const oldDate = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000);

    const sessions = [
      makeSession({ status: 'COMPLETED', scheduledDate: oldDate }),
      makeSession({ status: 'CANCELLED', scheduledDate: recentDate }),
    ];
    const reports = [
      makeReport({ performanceRating: 5, createdAt: oldDate }),
      makeReport({ performanceRating: 1, createdAt: recentDate }),
    ];

    // Act
    const trend = computeTrend(sessions, reports);

    // Assert
    expect(trend).toBe('down');
  });

  it('should return "stable" when performance is consistent', () => {
    // Arrange: same performance in both windows
    const now = new Date();
    const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const oldDate = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000);

    const sessions = [
      makeSession({ status: 'COMPLETED', scheduledDate: oldDate }),
      makeSession({ status: 'COMPLETED', scheduledDate: recentDate }),
    ];
    const reports = [
      makeReport({ performanceRating: 3, createdAt: oldDate }),
      makeReport({ performanceRating: 3, createdAt: recentDate }),
    ];

    // Act
    const trend = computeTrend(sessions, reports);

    // Assert
    expect(trend).toBe('stable');
  });
});

// ─── PILLAR_WEIGHTS ──────────────────────────────────────────────────────────

describe('PILLAR_WEIGHTS', () => {
  it('should sum to 1.0', () => {
    const sum = PILLAR_WEIGHTS.assiduite + PILLAR_WEIGHTS.progression +
                PILLAR_WEIGHTS.engagement + PILLAR_WEIGHTS.regularite;
    expect(sum).toBeCloseTo(1.0);
  });

  it('should weight assiduité at 30%', () => {
    expect(PILLAR_WEIGHTS.assiduite).toBe(0.30);
  });

  it('should weight progression at 30%', () => {
    expect(PILLAR_WEIGHTS.progression).toBe(0.30);
  });

  it('should weight engagement at 20%', () => {
    expect(PILLAR_WEIGHTS.engagement).toBe(0.20);
  });

  it('should weight régularité at 20%', () => {
    expect(PILLAR_WEIGHTS.regularite).toBe(0.20);
  });
});

// ─── MIN_SESSIONS_FOR_INDEX ──────────────────────────────────────────────────

describe('MIN_SESSIONS_FOR_INDEX', () => {
  it('should be 3', () => {
    expect(MIN_SESSIONS_FOR_INDEX).toBe(3);
  });
});

// ─── Level Classification ────────────────────────────────────────────────────

describe('Level Classification via computeFromData', () => {
  it('should classify "excellent" for globalScore >= 80', () => {
    // Arrange: high scores across all pillars
    const data = buildBaseData({
      sessions: Array.from({ length: 15 }, (_, i) =>
        makeSession({
          scheduledDate: new Date(2026, 0, i + 1),
          studentAttended: true,
        })
      ),
      reports: Array.from({ length: 8 }, (_, i) =>
        makeReport({
          performanceRating: 5,
          createdAt: new Date(2026, 0, i + 1),
        })
      ),
      ariaConversationCount: 5,
      ariaFeedbackCount: 10,
      diagnosticCount: 2,
    });

    // Act
    const result = computeFromData(data);

    // Assert
    expect(result).not.toBeNull();
    expect(result!.globalScore).toBeGreaterThanOrEqual(80);
    expect(result!.level).toBe('excellent');
  });

  it('should classify "debutant" for globalScore < 20', () => {
    // Arrange: minimal data, just above threshold
    const data = buildBaseData({
      sessions: [
        makeSession({ status: 'NO_SHOW' }),
        makeSession({ status: 'NO_SHOW' }),
        makeSession({ status: 'NO_SHOW' }),
      ],
      reports: [makeReport({ performanceRating: 1 })],
      ariaConversationCount: 0,
      ariaFeedbackCount: 0,
      diagnosticCount: 0,
    });

    // Act
    const result = computeFromData(data);

    // Assert
    expect(result).not.toBeNull();
    expect(result!.globalScore).toBeLessThan(20);
    expect(result!.level).toBe('debutant');
  });
});
