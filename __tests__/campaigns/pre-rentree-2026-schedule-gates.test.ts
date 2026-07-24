/**
 * Planning pré-rentrée 2026 — modèle fenêtres + week-end (nouvelle grille finalisée).
 *
 * Vérifie les 4 gates opérationnels sur la grille complète, la complétude de chaque
 * module (5 séances sur 5 jours consécutifs), la disponibilité Terminale (aucune
 * séance avant le 24 août) et le seuil d'ouverture universel (constante unique).
 *
 * Règle : si un gate échoue, ce test échoue et le rapporte — aucun gate n'est
 * assoupli ici pour le faire passer.
 */
import manifest from '@/data/campaigns/pre-rentree-2026.json';
import pricingData from '@/data/pricing.canonical.json';
import offersData from '@/content/pre-rentree-2026/offers.json';
import { PRE_RENTREE_MIN_COHORT_OPENING } from '@/lib/campaigns/pre-rentree-2026/schema';

type Slot = { level: string; subject: string; block: string; room: string; teacherRole: string };
type Window = { windowId: string; windowLabel: string; days: string[]; slots: Slot[] };

type Session = {
  date: string;
  windowId: string;
  level: string;
  subject: string;
  block: string;
  room: string;
  teacherRole: string;
};

const windows = manifest.schedule as unknown as Window[];
const blocks = manifest.blocks as Array<{ id: string; startTime: string; endTime: string }>;
const blockDuration = new Map(
  blocks.map((b) => {
    const [sh, sm] = b.startTime.split(':').map(Number);
    const [eh, em] = b.endTime.split(':').map(Number);
    return [b.id, (eh * 60 + em - sh * 60 - sm) / 60];
  }),
);

function expandSessions(): Session[] {
  const sessions: Session[] = [];
  for (const window of windows) {
    for (const date of window.days) {
      for (const slot of window.slots) {
        sessions.push({
          date,
          windowId: window.windowId,
          level: slot.level,
          subject: slot.subject,
          block: slot.block,
          room: slot.room,
          teacherRole: slot.teacherRole,
        });
      }
    }
  }
  return sessions;
}

const sessions = expandSessions();

describe('Pré-rentrée 2026 — grille fenêtres + week-end : gates opérationnels', () => {
  it('GATE noTeacherConflict : un enseignant ne peut être sur 2 blocs de la même salle... en fait sur 2 CRÉNEAUX SIMULTANÉS le même jour', () => {
    const byTeacherDay = new Map<string, Session[]>();
    for (const session of sessions) {
      const key = `${session.teacherRole}__${session.date}`;
      const list = byTeacherDay.get(key) ?? [];
      list.push(session);
      byTeacherDay.set(key, list);
    }
    const violations: string[] = [];
    for (const [key, list] of byTeacherDay) {
      const blocksSeen = new Set<string>();
      for (const session of list) {
        if (blocksSeen.has(session.block)) {
          violations.push(`${key} a 2 séances au même bloc ${session.block}`);
        }
        blocksSeen.add(session.block);
      }
    }
    expect(violations).toEqual([]);
  });

  it('GATE noTeacherConflict : D (Physique-Chimie) et E (SVT) — vérification explicite des blocs distincts les 24-25-26 août', () => {
    const overlapDays = ['2026-08-24', '2026-08-25', '2026-08-26'];
    for (const day of overlapDays) {
      const dTeacherSessions = sessions.filter((s) => s.teacherRole === 'TEACHER_D_PHYSIQUE_CHIMIE' && s.date === day);
      const eTeacherSessions = sessions.filter((s) => s.teacherRole === 'TEACHER_E_SVT' && s.date === day);
      // D fait PC-1re (bloc B, weekend-window) ET PC-Tle (bloc D, fenêtre 2) : 2 séances, blocs distincts.
      expect(dTeacherSessions.length).toBe(2);
      expect(new Set(dTeacherSessions.map((s) => s.block)).size).toBe(2);
      // E fait SVT-1re (bloc A, weekend-window) ET SVT-Tle (bloc C, fenêtre 2) : 2 séances, blocs distincts.
      expect(eTeacherSessions.length).toBe(2);
      expect(new Set(eTeacherSessions.map((s) => s.block)).size).toBe(2);
    }
  });

  it('GATE noRoomConflict : jamais 2 séances dans la même salle au même bloc le même jour', () => {
    const byRoomBlockDay = new Map<string, Session[]>();
    for (const session of sessions) {
      const key = `${session.room}__${session.block}__${session.date}`;
      const list = byRoomBlockDay.get(key) ?? [];
      list.push(session);
      byRoomBlockDay.set(key, list);
    }
    const violations = [...byRoomBlockDay.entries()].filter(([, list]) => list.length > 1);
    expect(violations).toEqual([]);
  });

  it('GATE noLevelConflict : une même matière d’un niveau n’est jamais dédoublée sur 2 salles/blocs simultanés', () => {
    // Distinct des "incompatibilités" (V1.5) : ici on vérifie l'intégrité des données
    // (pas de double affectation redondante de la MÊME matière), pas l'absence de
    // matières différentes au même bloc — un niveau peut légitimement avoir 2 matières
    // différentes au même bloc dans 2 salles différentes (ex. Terminale bloc A/C) :
    // c'est une incompatibilité de choix pour l'élève, pas une erreur de données.
    const byLevelSubjectDay = new Map<string, Session[]>();
    for (const session of sessions) {
      const key = `${session.level}__${session.subject}__${session.date}`;
      const list = byLevelSubjectDay.get(key) ?? [];
      list.push(session);
      byLevelSubjectDay.set(key, list);
    }
    const violations = [...byLevelSubjectDay.entries()].filter(([, list]) => list.length > 1);
    expect(violations).toEqual([]);
  });

  it('GATE noLevelConflict : après résolution du conflit salle 2/bloc A (24-25-26 août), seul le bloc C reste une incompatibilité Terminale (NSI/SVT) ; PC Tle a été déplacé au bloc D', () => {
    // Résolution actée (arbitrage utilisateur) : la salle 2 sur 24-25-26 août devait loger
    // 4 modules simultanés (SVT 1re @A, PC 1re @B, PC Tle, SVT Tle) sur 4 blocs disponibles.
    // PC Tle a été déplacé du bloc A vers le bloc D (seul bloc salle-2 libre sur toute la
    // fenêtre 2), ce qui supprime le conflit de salle SANS toucher SVT 1re/PC 1re/SVT Tle.
    // Conséquence pédagogique : Maths Tle (bloc A) et PC Tle (bloc D) ne sont plus au même
    // bloc — un même élève de Terminale peut désormais cumuler les deux. Seule
    // l'incompatibilité NSI/SVT (bloc C) subsiste, exactement comme demandé au brief
    // ("Tle NSI+SVT incompatibles (bloc C)").
    const terminaleByBlockDay = new Map<string, Set<string>>();
    for (const session of sessions.filter((s) => s.level === 'TERMINALE')) {
      const key = `${session.block}__${session.date}`;
      const set = terminaleByBlockDay.get(key) ?? new Set<string>();
      set.add(session.subject);
      terminaleByBlockDay.set(key, set);
    }
    const subjectsAtBlock = (blockId: string) => [...terminaleByBlockDay.entries()]
      .filter(([key]) => key.startsWith(`${blockId}__`))
      .map(([, subjects]) => subjects);

    // Bloc A : Maths Tle seule (plus de PC Tle) → aucune incompatibilité.
    expect(subjectsAtBlock('A').every((subjects) => subjects.size === 1 && subjects.has('MATHEMATIQUES'))).toBe(true);
    // Bloc B : Maths expertes Tle seule → aucune incompatibilité.
    expect(subjectsAtBlock('B').every((subjects) => subjects.size === 1 && subjects.has('MATHS_EXPERTES'))).toBe(true);
    // Bloc C : NSI + SVT simultanés → incompatibilité confirmée (demandée au brief).
    expect(subjectsAtBlock('C').every((subjects) => subjects.has('NSI') && subjects.has('SVT'))).toBe(true);
    // Bloc D : PC Tle seule (nouvel emplacement) → aucune incompatibilité.
    expect(subjectsAtBlock('D').every((subjects) => subjects.size === 1 && subjects.has('PHYSIQUE_CHIMIE'))).toBe(true);
  });

  it('GATE dailyLoadValid : le rôle A (Maths/NSI) ne dépasse jamais 4 blocs par jour', () => {
    const byTeacherDay = new Map<string, Set<string>>();
    for (const session of sessions) {
      const key = `${session.teacherRole}__${session.date}`;
      const set = byTeacherDay.get(key) ?? new Set<string>();
      set.add(session.block);
      byTeacherDay.set(key, set);
    }
    for (const [key, blockSet] of byTeacherDay) {
      if (key.startsWith('TEACHER_A_MATHS_NSI__')) {
        expect(blockSet.size).toBeLessThanOrEqual(4);
      } else {
        expect(blockSet.size).toBeLessThanOrEqual(3);
      }
    }
  });

  it('GATE dailyLoadValid : le rôle A atteint bien 4 blocs/jour en fenêtre 1 (17-21 août)', () => {
    const day = '2026-08-17';
    const aBlocks = new Set(
      sessions.filter((s) => s.teacherRole === 'TEACHER_A_MATHS_NSI' && s.date === day).map((s) => s.block),
    );
    expect(aBlocks.size).toBe(4);
  });
});

describe('Pré-rentrée 2026 — complétude des modules (5 séances, 5 jours consécutifs)', () => {
  it('chaque module (niveau/matière) a exactement 5 séances', () => {
    const byModule = new Map<string, Session[]>();
    for (const session of sessions) {
      const key = `${session.level}/${session.subject}`;
      const list = byModule.get(key) ?? [];
      list.push(session);
      byModule.set(key, list);
    }
    const wrongCount = [...byModule.entries()].filter(([, list]) => list.length !== 5);
    expect(wrongCount).toEqual([]);
    // 14 modules attendus : 7 (fenêtre 1) + 2 (week-end/début F2) + 5 (fenêtre 2).
    expect(byModule.size).toBe(14);
  });

  it('les 5 séances de chaque module tombent sur 5 jours consécutifs (calendrier)', () => {
    const byModule = new Map<string, Session[]>();
    for (const session of sessions) {
      const key = `${session.level}/${session.subject}`;
      const list = byModule.get(key) ?? [];
      list.push(session);
      byModule.set(key, list);
    }
    const nonConsecutive: string[] = [];
    for (const [key, list] of byModule) {
      const dates = list.map((s) => new Date(`${s.date}T12:00:00Z`).getTime()).sort((a, b) => a - b);
      for (let i = 1; i < dates.length; i += 1) {
        const diffDays = (dates[i] - dates[i - 1]) / (24 * 60 * 60 * 1000);
        if (diffDays !== 1) {
          nonConsecutive.push(key);
          break;
        }
      }
    }
    expect(nonConsecutive).toEqual([]);
  });

  it('total des séances calendrier = 70 (14 modules × 5 jours)', () => {
    expect(sessions.length).toBe(70);
  });
});

describe('Pré-rentrée 2026 — disponibilité des élèves de Terminale', () => {
  it('aucune séance Terminale avant le 24 août (les 2 élèves de Terminale démarrent le 24)', () => {
    const terminaleSessions = sessions.filter((s) => s.level === 'TERMINALE');
    expect(terminaleSessions.length).toBeGreaterThan(0);
    const earliestDate = terminaleSessions.map((s) => s.date).sort()[0];
    expect(earliestDate >= '2026-08-24').toBe(true);
  });

  it('toutes les matières Terminale (Maths, NSI, PC, SVT, Maths expertes) démarrent bien le 24 août ou après', () => {
    const bySubject = new Map<string, string[]>();
    for (const session of sessions.filter((s) => s.level === 'TERMINALE')) {
      const list = bySubject.get(session.subject) ?? [];
      list.push(session.date);
      bySubject.set(session.subject, list);
    }
    expect(bySubject.size).toBe(5);
    for (const [subject, dates] of bySubject) {
      const earliest = dates.sort()[0];
      expect(earliest >= '2026-08-24').toBe(true);
      // sanity: subject name is part of the failure message context if this ever fails
      void subject;
    }
  });
});

describe('Pré-rentrée 2026 — seuil d’ouverture : constante unique (arbitrage direction du 2026-07-24)', () => {
  it('3 inscrits minimum, pour Fondations ET Premium — aucune valeur dupliquée par offre/niveau/matière', () => {
    const capacity = manifest.capacityByOffer as {
      FONDATIONS: { minPerCohort: number; maxPerCohort: number };
      PREMIUM: { minPerCohort: number; maxPerCohort: number };
    };
    // Arbitrage direction (2026-07-24) : "3 partout" prime sur l'ancien plancher
    // Fondations à 4 (commercial_exception PRE2026-3E-350 mis à jour en conséquence
    // dans data/pricing.canonical.json — scope "groupe de 3 à 6 élèves").
    expect(capacity.FONDATIONS.minPerCohort).toBe(PRE_RENTREE_MIN_COHORT_OPENING);
    expect(capacity.PREMIUM.minPerCohort).toBe(PRE_RENTREE_MIN_COHORT_OPENING);
    expect(capacity.FONDATIONS.minPerCohort).toBe(capacity.PREMIUM.minPerCohort);
  });

  it('les produits de pricing canoniques (Fondations 3e/Seconde) partagent le même group_min_open', () => {
    expect(pricingData.pre_rentree_foundations.every(
      (product) => product.group_min_open === PRE_RENTREE_MIN_COHORT_OPENING,
    )).toBe(true);
  });

  it('le catalogue d’offres publiques (offers.json) reflète la même constante pour tous les niveaux', () => {
    expect(offersData.levels.every(
      (level) => level.capacity.min === PRE_RENTREE_MIN_COHORT_OPENING,
    )).toBe(true);
  });
});
