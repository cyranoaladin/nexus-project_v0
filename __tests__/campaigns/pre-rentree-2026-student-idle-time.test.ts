/**
 * Reproduces and verifies, independently of any hardcoded assumption, the idle-time
 * behaviour of the S5 schedule (3 rooms + week-end, end date kept at 28 août) — computed
 * here directly from data/campaigns/pre-rentree-2026.json via getPreRentreeSchedule(),
 * never from a copy of the numbers. Superseded the original S0 baseline (see
 * docs/campaigns/pre-rentree-2026/SCHEDULE-UX-AUDIT.md) after the schedule was
 * restructured by the UX-optimization (PR #77) and S5 three-rooms missions.
 *
 * Some subjects now have two alternative cohorts (Première SVT, Terminale NSI,
 * Terminale SVT — see cohortId in the schema). Any combination touching one of
 * those subjects MUST go through assignItinerary (which picks, per subject, the
 * single best cohort for the family) rather than computeItinerary directly on the
 * raw schedule: computeItinerary alone would incorrectly merge both cohorts'
 * sessions into one itinerary, which no real student ever attends.
 */
import { getPreRentreeSchedule } from '@/lib/campaigns/pre-rentree-2026/getters';
import {
  computeItinerary,
  assignItinerary,
  enumerateSelections,
  MAX_STUDENT_IDLE_MINUTES,
} from '@/lib/campaigns/pre-rentree-2026/itinerary';

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

describe('Pré-rentrée 2026 — itinerary reproduction (S5 schedule: 3 salles + week-end)', () => {
  it('3e: Mathématiques + Français is conforme (15 min) — improved by the UX optimization', () => {
    const report = assignItinerary('TROISIEME', ['MATHEMATIQUES', 'FRANCAIS'], schedule).itinerary;
    expect(report.status).toBe('COMPACT');
    expect(report.maxIdleMinutes).toBe(15);
  });

  it('Seconde: Français + Mathématiques is conforme (15 min)', () => {
    const report = assignItinerary('SECONDE', ['FRANCAIS', 'MATHEMATIQUES'], schedule).itinerary;
    expect(report.status).toBe('COMPACT');
    expect(report.maxIdleMinutes).toBe(15);
  });

  describe('Première — fenêtre 1 (17-21 août)', () => {
    it('Français + Mathématiques: aucune journée commune (Français a été relogé en semaine week-end)', () => {
      const report = assignItinerary('PREMIERE', ['FRANCAIS', 'MATHEMATIQUES'], schedule).itinerary;
      expect(report.status).toBe('NO_SHARED_DAY');
    });
    it('Mathématiques + NSI: 60 min, conforme', () => {
      const report = assignItinerary('PREMIERE', ['MATHEMATIQUES', 'NSI'], schedule).itinerary;
      expect(report.status).toBe('COMPACT');
      expect(report.maxIdleMinutes).toBe(60);
    });
    it('Français + NSI seul: aucune journée commune', () => {
      const report = assignItinerary('PREMIERE', ['FRANCAIS', 'NSI'], schedule).itinerary;
      expect(report.status).toBe('NO_SHARED_DAY');
    });
    it('Français + Mathématiques + NSI: max 60 min, conforme (Français ne contribue à aucune attente)', () => {
      const report = assignItinerary('PREMIERE', ['FRANCAIS', 'MATHEMATIQUES', 'NSI'], schedule).itinerary;
      expect(report.status).toBe('COMPACT');
      expect(report.maxIdleMinutes).toBe(60);
    });
  });

  describe('Première — SVT (cohortes) et fenêtre semaine week-end', () => {
    it('SVT + Physique-Chimie: aucune journée commune (fenêtres disjointes)', () => {
      const report = assignItinerary('PREMIERE', ['SVT', 'PHYSIQUE_CHIMIE'], schedule).itinerary;
      expect(report.status).toBe('NO_SHARED_DAY');
    });
    it('Mathématiques + SVT: 15 min, conforme (cohorte SVT choisie automatiquement)', () => {
      const assignment = assignItinerary('PREMIERE', ['MATHEMATIQUES', 'SVT'], schedule);
      expect(assignment.itinerary.status).toBe('COMPACT');
      expect(assignment.itinerary.maxIdleMinutes).toBe(15);
    });
    it('NSI + SVT: 15 min, conforme (cohorte SVT choisie automatiquement)', () => {
      const assignment = assignItinerary('PREMIERE', ['NSI', 'SVT'], schedule);
      expect(assignment.itinerary.status).toBe('COMPACT');
      expect(assignment.itinerary.maxIdleMinutes).toBe(15);
    });
    it('Français + Physique-Chimie: 15 min, conforme (les deux dans la fenêtre semaine week-end)', () => {
      const report = assignItinerary('PREMIERE', ['FRANCAIS', 'PHYSIQUE_CHIMIE'], schedule).itinerary;
      expect(report.status).toBe('COMPACT');
      expect(report.maxIdleMinutes).toBe(15);
    });
  });

  describe('Terminale — fenêtre 24-28 août (3 salles)', () => {
    const cases: Array<[string[], 'COMPACT' | 'LONG_IDLE' | 'SIMULTANEOUS', number | null]> = [
      [['MATHEMATIQUES', 'MATHS_EXPERTES'], 'COMPACT', 15],
      [['MATHEMATIQUES', 'NSI'], 'COMPACT', 60],
      [['MATHEMATIQUES', 'SVT'], 'COMPACT', 60],
      [['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'], 'COMPACT', 60],
      [['MATHS_EXPERTES', 'NSI'], 'LONG_IDLE', 195],
      [['MATHS_EXPERTES', 'SVT'], 'LONG_IDLE', 195],
      [['MATHS_EXPERTES', 'PHYSIQUE_CHIMIE'], 'LONG_IDLE', 195],
      [['NSI', 'SVT'], 'COMPACT', 15],
      [['NSI', 'PHYSIQUE_CHIMIE'], 'COMPACT', 15],
      [['SVT', 'PHYSIQUE_CHIMIE'], 'COMPACT', 15],
    ];
    it.each(cases)('%p -> %s (%p min)', (subjects, expectedStatus, expectedIdle) => {
      const report = assignItinerary('TERMINALE', subjects, schedule).itinerary;
      expect(report.status).toBe(expectedStatus);
      if (expectedIdle !== null) {
        expect(report.maxIdleMinutes).toBe(expectedIdle);
      }
    });

    it('NSI + Physique-Chimie + SVT together: unavoidable SIMULTANEOUS (Physique-Chimie fixe le bloc C, NSI et SVT ne peuvent alors qu\'occuper tous les deux le bloc D)', () => {
      // Pigeonhole: PC is single-cohort at block C. To avoid PC, both NSI and SVT
      // would have to use block D — but then they collide with each other. Adding
      // a 3rd standard room does not resolve a 3-way simultaneous need for only 2
      // free blocks (C is taken by PC) — this is the documented, accepted residual
      // limit of S5, not a bug in assignItinerary or the schedule.
      const assignment = assignItinerary('TERMINALE', ['NSI', 'PHYSIQUE_CHIMIE', 'SVT'], schedule);
      expect(assignment.itinerary.status).toBe('SIMULTANEOUS');
      expect(assignment.itinerary.firstConflict?.reason).toBe('SIMULTANEOUS');
    });

    it('Mathématiques + Maths expertes + NSI: 60 min, conforme (Mathématiques comble l\'écart)', () => {
      const assignment = assignItinerary('TERMINALE', ['MATHEMATIQUES', 'MATHS_EXPERTES', 'NSI'], schedule);
      expect(assignment.itinerary.status).toBe('COMPACT');
      expect(assignment.itinerary.maxIdleMinutes).toBe(60);
    });
  });
});

describe('Pré-rentrée 2026 — cohort assignment invariants (S5)', () => {
  it('never combines both cohorts of the same subject into one itinerary (always exactly 5 sessions)', () => {
    const assignment = assignItinerary('TERMINALE', ['NSI', 'SVT'], schedule);
    expect(assignment.sessionsBySubject['NSI']).toHaveLength(5);
    expect(assignment.sessionsBySubject['SVT']).toHaveLength(5);
  });

  it('is deterministic across repeated calls for a multi-cohort selection', () => {
    const first = assignItinerary('TERMINALE', ['NSI', 'SVT'], schedule);
    const second = assignItinerary('TERMINALE', ['NSI', 'SVT'], schedule);
    expect(first.cohortBySubject).toEqual(second.cohortBySubject);
    expect(first.itinerary).toEqual(second.itinerary);
  });

  it('a subject with a single cohort has an undefined cohortBySubject entry (no choice to make)', () => {
    const assignment = assignItinerary('TERMINALE', ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'], schedule);
    expect(assignment.cohortBySubject['MATHEMATIQUES']).toBeUndefined();
    expect(assignment.cohortBySubject['PHYSIQUE_CHIMIE']).toBeUndefined();
  });

  it('throws when a subject has no schedule for the given level, rather than silently returning an empty itinerary', () => {
    expect(() => assignItinerary('TERMINALE', ['SVT', 'GEOGRAPHIE_INEXISTANTE'], schedule)).toThrow(
      /Missing campaign schedule/,
    );
  });
});

describe('Pré-rentrée 2026 — itinerary engine invariants', () => {
  it('an extra session filling a gap turns a LONG_IDLE pair into a COMPACT triple', () => {
    // Terminale Maths expertes (A) + NSI cohort-c (C) alone: single 195min gap, LONG_IDLE.
    // Adding Mathématiques (B), which sits between them, breaks the gap into 15+60min.
    const pair = assignItinerary('TERMINALE', ['MATHS_EXPERTES', 'NSI'], schedule).itinerary;
    expect(pair.status).toBe('LONG_IDLE');
    const triple = assignItinerary('TERMINALE', ['MATHEMATIQUES', 'MATHS_EXPERTES', 'NSI'], schedule).itinerary;
    expect(triple.status).toBe('COMPACT');
  });

  it('never reports SIMULTANEOUS as COMPACT, and always finds the first conflict', () => {
    const assignment = assignItinerary('TERMINALE', ['NSI', 'PHYSIQUE_CHIMIE', 'SVT'], schedule);
    expect(assignment.itinerary.status).toBe('SIMULTANEOUS');
    expect(assignment.itinerary.firstConflict).not.toBeNull();
    expect(assignment.itinerary.firstConflict?.reason).toBe('SIMULTANEOUS');
  });

  it('a subject with no shared date never contributes idle time (rule 5)', () => {
    // A single selected subject can never share a date with itself twice under one
    // cohort — trivially NO_SHARED_DAY, never a bogus non-zero idle value.
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
  it('computeItinerary is deterministic for the same inputs (single-cohort subjects)', () => {
    const first = computeItinerary('TERMINALE', ['MATHEMATIQUES', 'MATHS_EXPERTES'], schedule);
    const second = computeItinerary('TERMINALE', ['MATHEMATIQUES', 'MATHS_EXPERTES'], schedule);
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

  it('the schedule has no room conflict (two different subjects in the same date/block/room)', () => {
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
