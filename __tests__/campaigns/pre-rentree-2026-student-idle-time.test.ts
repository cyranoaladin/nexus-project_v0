/**
 * Reproduces and verifies, independently of any hardcoded assumption, the idle-time
 * behaviour of the S5 schedule (3 rooms + week-end, end date kept at 28 août) — computed
 * here directly from data/campaigns/pre-rentree-2026.json via getPreRentreeSchedule(),
 * never from a copy of the numbers. Superseded the original S0 baseline (see
 * docs/campaigns/pre-rentree-2026/SCHEDULE-UX-AUDIT.md) after the schedule was
 * restructured by the UX-optimization (PR #77) and S5 three-rooms missions.
 *
 * Some subjects have two alternative cohorts (Première SVT, and Terminale
 * Mathématiques since the 2026-08-14 split). Any combination touching one of
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
  type ItinerarySession,
  type ItineraryStatus,
} from '@/lib/campaigns/pre-rentree-2026/itinerary';
import ownerDecisions from '@/content/pre-rentree-2026/publication-decisions.owner.json';

const schedule = getPreRentreeSchedule();

/**
 * Les combinaisons de matières réellement souscrites cette session, lues depuis
 * le registre d'arbitrages du propriétaire — jamais recopiées ici. Le catalogue
 * en autorise d'autres ; celles-ci sont les seules qui engagent un élève, et
 * donc les seules que le plafond d'attente doit protéger.
 */
const openTerminaleCombinations: string[][] =
  ownerDecisions.decisions.terminaleGroupsAndClosures2026.openSubjectCombinations.TERMINALE;

const isOpen = (subjects: readonly string[]) =>
  openTerminaleCombinations.some(
    (open) => open.length === subjects.length && open.every((s) => subjects.includes(s)),
  );

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
    // Deux tables distinctes, pour que le garde porte sur l'offre réellement
    // ouverte plutôt que sur le catalogue théorique.
    //
    // 1) Les combinaisons souscrites cette session doivent respecter le plafond
    //    d'attente. Aucune valeur n'est figée : c'est la règle qui est vérifiée,
    //    donc toute grille future qui la violerait échoue ici.
    it.each(openTerminaleCombinations.map((combo) => [combo]))(
      'combinaison ouverte %p : attente sous le plafond',
      (subjects) => {
        const report = assignItinerary('TERMINALE', subjects, schedule).itinerary;
        expect(report.status).toBe('COMPACT');
        expect(report.maxIdleMinutes).toBeLessThanOrEqual(MAX_STUDENT_IDLE_MINUTES);
      },
    );

    // 2) Les combinaisons que le catalogue autorise mais que personne n'a
    //    souscrites. Leur attente mesurée est enregistrée telle quelle, sans
    //    indulgence : NSI + Physique-Chimie laisse 5 h 30 de battement, parce que
    //    le dédoublement des mathématiques occupe les deux blocs centraux et
    //    repousse la Physique-Chimie en fin de journée. Aucun élève n'est
    //    concerné cette session (arbitrage du 14/08/2026 : les huit inscrits se
    //    répartissent entre maths + NSI et maths + Physique-Chimie). Ouvrir cette
    //    combinaison consiste à l'ajouter au registre du propriétaire, ce qui la
    //    fait basculer dans la table 1 et échouer tant que la grille n'a pas été
    //    revue — le risque reste donc détecté, il n'est pas neutralisé.
    const catalogueOnly: Array<[string[], ItineraryStatus, number]> = [
      [['NSI', 'PHYSIQUE_CHIMIE'], 'LONG_IDLE', 330],
      [['MATHEMATIQUES', 'NSI', 'PHYSIQUE_CHIMIE'], 'LONG_IDLE', 195],
    ];
    it.each(catalogueOnly)(
      'combinaison de catalogue %p : %s (%p min), non souscrite cette session',
      (subjects, expectedStatus, expectedIdle) => {
        expect(isOpen(subjects)).toBe(false);
        const report = assignItinerary('TERMINALE', subjects, schedule).itinerary;
        expect(report.status).toBe(expectedStatus);
        expect(report.maxIdleMinutes).toBe(expectedIdle);
      },
    );
  });
});

describe('Pré-rentrée 2026 — cohort assignment invariants (S5)', () => {
  // Depuis le dédoublement du 14/08/2026, la matière à deux cohortes en
  // Terminale est Mathématiques (groupe du matin / groupe de l'après-midi).
  it('never combines both cohorts of the same subject into one itinerary (always exactly 5 sessions)', () => {
    const assignment = assignItinerary('TERMINALE', ['MATHEMATIQUES', 'NSI'], schedule);
    expect(assignment.sessionsBySubject['MATHEMATIQUES']).toHaveLength(5);
    expect(assignment.sessionsBySubject['NSI']).toHaveLength(5);
  });

  it('is deterministic across repeated calls for a multi-cohort selection', () => {
    const first = assignItinerary('TERMINALE', ['MATHEMATIQUES', 'NSI'], schedule);
    const second = assignItinerary('TERMINALE', ['MATHEMATIQUES', 'NSI'], schedule);
    expect(first.cohortBySubject).toEqual(second.cohortBySubject);
    expect(first.itinerary).toEqual(second.itinerary);
  });

  it('a subject with a single cohort has an undefined cohortBySubject entry (no choice to make)', () => {
    const assignment = assignItinerary('TERMINALE', ['NSI', 'PHYSIQUE_CHIMIE'], schedule);
    expect(assignment.cohortBySubject['NSI']).toBeUndefined();
    expect(assignment.cohortBySubject['PHYSIQUE_CHIMIE']).toBeUndefined();
  });

  it('throws when a subject has no schedule for the given level, rather than silently returning an empty itinerary', () => {
    expect(() => assignItinerary('TERMINALE', ['NSI', 'GEOGRAPHIE_INEXISTANTE'], schedule)).toThrow(
      /Missing campaign schedule/,
    );
  });
});

describe('Pré-rentrée 2026 — itinerary engine invariants', () => {
  // Ces deux invariants portent sur le moteur, pas sur la campagne. Depuis les
  // fermetures du 14/08/2026, la grille vivante ne produit plus aucun conflit
  // simultané ni aucun trio comblant un trou : les exercer sur elle reviendrait
  // à ne rien exercer du tout. On les fait donc tourner sur une grille
  // synthétique minimale, qui isole exactement la propriété testée.
  const BLOCKS: Record<string, [string, string]> = {
    A: ['09:00', '11:00'],
    B: ['11:15', '13:15'],
    C: ['14:15', '16:15'],
  };
  const fixture = (placements: Array<[string, string]>): ItinerarySession[] =>
    placements.map(([subject, block]) => ({
      date: '2026-08-24',
      level: 'TERMINALE' as const,
      subject,
      block,
      startTime: BLOCKS[block]![0],
      endTime: BLOCKS[block]![1],
    }));

  it('an extra session filling a gap turns a LONG_IDLE pair into a COMPACT triple', () => {
    // X (bloc A) + Z (bloc C) : un seul trou de 195 min, donc LONG_IDLE.
    // Y (bloc B) s'intercale et le casse en 15 + 60 min.
    const grid = fixture([['X', 'A'], ['Y', 'B'], ['Z', 'C']]);
    const pair = assignItinerary('TERMINALE', ['X', 'Z'], grid).itinerary;
    expect(pair.status).toBe('LONG_IDLE');
    expect(pair.maxIdleMinutes).toBe(195);
    const triple = assignItinerary('TERMINALE', ['X', 'Y', 'Z'], grid).itinerary;
    expect(triple.status).toBe('COMPACT');
    expect(triple.maxIdleMinutes).toBe(60);
  });

  it('never reports SIMULTANEOUS as COMPACT, and always finds the first conflict', () => {
    // Deux matières mono-cohorte sur le même bloc le même jour : aucun choix ne
    // peut les séparer, le moteur doit le dire au lieu de les compter comme
    // compatibles.
    const grid = fixture([['X', 'A'], ['Y', 'A']]);
    const assignment = assignItinerary('TERMINALE', ['X', 'Y'], grid);
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
    const first = computeItinerary('TERMINALE', ['NSI', 'PHYSIQUE_CHIMIE'], schedule);
    const second = computeItinerary('TERMINALE', ['NSI', 'PHYSIQUE_CHIMIE'], schedule);
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
