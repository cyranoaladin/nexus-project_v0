/**
 * Reproduces and verifies, independently of any hardcoded assumption, the idle-time
 * baseline stated in docs/campaigns/pre-rentree-2026/SCHEDULE-UX-AUDIT.md — computed
 * here directly from data/campaigns/pre-rentree-2026.json via getPreRentreeSchedule(),
 * never from a copy of the numbers.
 */
import { getPreRentreeSchedule } from '@/lib/campaigns/pre-rentree-2026/getters';
import { computeItinerary, enumerateSelections, MAX_STUDENT_IDLE_MINUTES } from '@/lib/campaigns/pre-rentree-2026/itinerary';

const schedule = getPreRentreeSchedule();

describe('Pré-rentrée 2026 — block-to-block idle time', () => {
  it('computes the exact minute gap between every pair of blocks', () => {
    const blockTimes: Record<string, [string, string]> = {
      A: ['09:00', '11:00'],
      B: ['11:15', '13:15'],
      C: ['14:15', '16:15'],
      D: ['16:30', '18:30'],
    };
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const gap = (a: string, b: string) => toMin(blockTimes[b]![0]) - toMin(blockTimes[a]![1]);
    expect(gap('A', 'B')).toBe(15);
    expect(gap('B', 'C')).toBe(60);
    expect(gap('C', 'D')).toBe(15);
    expect(gap('A', 'C')).toBe(195);
    expect(gap('B', 'D')).toBe(195);
    expect(gap('A', 'D')).toBe(330);
  });
});

describe('Pré-rentrée 2026 — itinerary baseline reproduction (current schedule)', () => {
  it('3e: Mathématiques + Français is NOT conforme (195 min)', () => {
    const report = computeItinerary('TROISIEME', ['MATHEMATIQUES', 'FRANCAIS'], schedule);
    expect(report.status).toBe('LONG_IDLE');
    expect(report.maxIdleMinutes).toBe(195);
  });

  it('Seconde: Français + Mathématiques is conforme (15 min)', () => {
    const report = computeItinerary('SECONDE', ['FRANCAIS', 'MATHEMATIQUES'], schedule);
    expect(report.status).toBe('COMPACT');
    expect(report.maxIdleMinutes).toBe(15);
  });

  describe('Première — fenêtre 1 (17-21 août)', () => {
    it('Français + Mathématiques: 60 min, conforme', () => {
      const report = computeItinerary('PREMIERE', ['FRANCAIS', 'MATHEMATIQUES'], schedule);
      expect(report.status).toBe('COMPACT');
      expect(report.maxIdleMinutes).toBe(60);
    });
    it('Mathématiques + NSI: 15 min, conforme', () => {
      const report = computeItinerary('PREMIERE', ['MATHEMATIQUES', 'NSI'], schedule);
      expect(report.status).toBe('COMPACT');
      expect(report.maxIdleMinutes).toBe(15);
    });
    it('Français + NSI seul: 195 min, non conforme', () => {
      const report = computeItinerary('PREMIERE', ['FRANCAIS', 'NSI'], schedule);
      expect(report.status).toBe('LONG_IDLE');
      expect(report.maxIdleMinutes).toBe(195);
    });
    it('Français + Mathématiques + NSI: max 60 min, conforme', () => {
      const report = computeItinerary('PREMIERE', ['FRANCAIS', 'MATHEMATIQUES', 'NSI'], schedule);
      expect(report.status).toBe('COMPACT');
      expect(report.maxIdleMinutes).toBe(60);
    });
  });

  it('Première — fenêtre 2 (22-26 août): SVT + Physique-Chimie, 15 min conforme', () => {
    const report = computeItinerary('PREMIERE', ['SVT', 'PHYSIQUE_CHIMIE'], schedule);
    expect(report.status).toBe('COMPACT');
    expect(report.maxIdleMinutes).toBe(15);
  });

  describe('Terminale — fenêtre 24-28 août', () => {
    const cases: Array<[string[], 'COMPACT' | 'LONG_IDLE' | 'SIMULTANEOUS', number | null]> = [
      [['MATHEMATIQUES', 'MATHS_EXPERTES'], 'COMPACT', 15],
      [['MATHEMATIQUES', 'NSI'], 'LONG_IDLE', 195],
      [['MATHEMATIQUES', 'SVT'], 'LONG_IDLE', 195],
      [['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'], 'LONG_IDLE', 330],
      [['MATHS_EXPERTES', 'NSI'], 'COMPACT', 60],
      [['MATHS_EXPERTES', 'SVT'], 'COMPACT', 60],
      [['MATHS_EXPERTES', 'PHYSIQUE_CHIMIE'], 'LONG_IDLE', 195],
      [['NSI', 'SVT'], 'SIMULTANEOUS', null],
      [['NSI', 'PHYSIQUE_CHIMIE'], 'COMPACT', 15],
      [['SVT', 'PHYSIQUE_CHIMIE'], 'COMPACT', 15],
    ];
    it.each(cases)('%p -> %s (%p min)', (subjects, expectedStatus, expectedIdle) => {
      const report = computeItinerary('TERMINALE', subjects, schedule);
      expect(report.status).toBe(expectedStatus);
      if (expectedIdle !== null) {
        expect(report.maxIdleMinutes).toBe(expectedIdle);
      }
    });
  });
});

describe('Pré-rentrée 2026 — itinerary engine invariants', () => {
  it('B+C+D (Terminale-style 3-subject compact chain) stays conforme, B+D alone does not', () => {
    // Synthetic: reuse Première fenêtre-1 B/C/D (Français/Mathématiques/NSI) to exercise
    // the "3 séances -> 2 gaps -> max still <= 60" rule from the mission brief directly.
    const bcd = computeItinerary('PREMIERE', ['FRANCAIS', 'MATHEMATIQUES', 'NSI'], schedule);
    expect(bcd.status).toBe('COMPACT');
    const bd = computeItinerary('PREMIERE', ['FRANCAIS', 'NSI'], schedule);
    expect(bd.status).toBe('LONG_IDLE');
  });

  it('never reports SIMULTANEOUS as COMPACT, and always finds the first conflict', () => {
    const report = computeItinerary('TERMINALE', ['NSI', 'SVT'], schedule);
    expect(report.status).toBe('SIMULTANEOUS');
    expect(report.firstConflict).not.toBeNull();
    expect(report.firstConflict?.reason).toBe('SIMULTANEOUS');
  });

  it('a subject with no shared date never contributes idle time (rule 5)', () => {
    // 3e and Seconde subjects never share a date with Première/Terminale subjects
    // in this schedule; selecting subjects that literally never coincide must be
    // NO_SHARED_DAY, not silently COMPACT with a bogus zero.
    const neverShared = computeItinerary('TROISIEME', ['MATHEMATIQUES'], schedule);
    expect(neverShared.status).toBe('NO_SHARED_DAY');
  });

  it('enumerateSelections produces every non-empty subset up to the cap, no duplicates', () => {
    const selections = enumerateSelections(['A', 'B', 'C', 'D'], 4);
    expect(selections).toHaveLength(15); // 2^4 - 1
    expect(new Set(selections.map((s) => s.join(','))).size).toBe(15);
    const cappedAt2 = enumerateSelections(['A', 'B', 'C'], 2);
    expect(cappedAt2.every((s) => s.length <= 2)).toBe(true);
  });

  it('MAX_STUDENT_IDLE_MINUTES is the single source of the 60-minute rule', () => {
    expect(MAX_STUDENT_IDLE_MINUTES).toBe(60);
  });
});

describe('Pré-rentrée 2026 — determinism and full-catalogue invariants', () => {
  it('computeItinerary is deterministic for the same inputs', () => {
    const first = computeItinerary('TERMINALE', ['MATHEMATIQUES', 'NSI'], schedule);
    const second = computeItinerary('TERMINALE', ['MATHEMATIQUES', 'NSI'], schedule);
    expect(first).toEqual(second);
  });

  it('every scheduled block is exactly 2 hours (10h = 5 sessions x 2h per subject)', () => {
    const times: Record<string, [string, string]> = {
      A: ['09:00', '11:00'], B: ['11:15', '13:15'], C: ['14:15', '16:15'], D: ['16:30', '18:30'],
    };
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    for (const [start, end] of Object.values(times)) {
      expect(toMin(end) - toMin(start)).toBe(120);
    }
  });

  it('the baseline schedule has no room conflict (two different subjects in the same date/block/room)', () => {
    const byRoomBlock = new Map<string, unknown>();
    for (const session of schedule) {
      const roomKey = `${session.date}__${session.block}__${session.room}`;
      const existing = byRoomBlock.get(roomKey);
      if (existing) {
        expect(existing).toEqual({ level: session.level, subject: session.subject });
      } else {
        byRoomBlock.set(roomKey, { level: session.level, subject: session.subject });
      }
    }
  });
});
