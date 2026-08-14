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

type Slot = { level: string; subject: string; block: string; room: string; teacherRole: string; cohortId?: string };
type Window = { windowId: string; windowLabel: string; days: string[]; slots: Slot[] };

type Session = {
  date: string;
  windowId: string;
  level: string;
  subject: string;
  block: string;
  room: string;
  teacherRole: string;
  cohortId?: string;
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
          cohortId: slot.cohortId,
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
      // E n'assure plus que la SVT de Première depuis la fermeture de la SVT
      // Terminale (14/08/2026) : ses séances sortent de la fenêtre 2, donc aucune
      // ne tombe ces trois jours-là. On le vérifie plutôt que de le supposer, sinon
      // un retour de la SVT en fenêtre 2 passerait inaperçu.
      expect(eTeacherSessions).toEqual([]);
      expect(sessions.filter((s) => s.teacherRole === 'TEACHER_E_SVT').every((s) => s.level === 'PREMIERE')).toBe(true);
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

  it('GATE noLevelConflict : une même matière d’un niveau n’a jamais 2 séances au même bloc le même jour (les cohortes alternatives sont à des blocs distincts)', () => {
    // Depuis SCHEDULE-S5 (cohortes alternatives), un (niveau, matière) peut
    // légitimement avoir 2 séances le même jour — une par cohorte — mais jamais
    // au MÊME bloc (sinon un élève de cette cohorte serait dédoublé). Distinct
    // des "incompatibilités" (V1.5) : un niveau peut légitimement avoir 2
    // matières différentes au même bloc dans 2 salles différentes.
    const byLevelSubjectDayBlock = new Map<string, Session[]>();
    for (const session of sessions) {
      const key = `${session.level}__${session.subject}__${session.date}__${session.block}`;
      const list = byLevelSubjectDayBlock.get(key) ?? [];
      list.push(session);
      byLevelSubjectDayBlock.set(key, list);
    }
    const violations = [...byLevelSubjectDayBlock.entries()].filter(([, list]) => list.length > 1);
    expect(violations).toEqual([]);
  });

  it('GATE noLevelConflict : Terminale — SCHEDULE-S5 layout, seule l’incompatibilité NSI/SVT au bloc C subsiste', () => {
    // Layout S5 (salle-3 exceptionnelle, bloc C, + cohortes NSI/SVT alternatives) :
    // A = Maths expertes seule ; B = Mathématiques seule ; C = NSI(cohorte C) +
    // Physique-Chimie + SVT(cohorte C, salle-3) ; D = NSI(cohorte D) + SVT(cohorte D).
    // Un élève NSI+SVT ne peut choisir que des cohortes qui partagent un bloc
    // (C+C ou D+D) ou des blocs différents (C+D ou D+C) — au moins une paire de
    // cohortes reste simultanée par construction (5 matières/cohortes sur 4
    // blocs, argument des tiroirs prouvé par solveur, voir SCHEDULE-S5-DECISION.md).
    // Scopé à Fenêtre 2 : la Philosophie (mission 4e/Philosophie) est en
    // Fenêtre 1, bloc D — un niveau différent de contrainte (tronc commun,
    // jamais une spécialité), sans rapport avec le layout S5 vérifié ici.
    const terminaleByBlockDay = new Map<string, Set<string>>();
    for (const session of sessions.filter((s) => s.level === 'TERMINALE' && s.windowId === 'fenetre-2')) {
      const key = `${session.block}__${session.date}`;
      const set = terminaleByBlockDay.get(key) ?? new Set<string>();
      set.add(session.subject);
      terminaleByBlockDay.set(key, set);
    }
    const subjectsAtBlock = (blockId: string) => [...terminaleByBlockDay.entries()]
      .filter(([key]) => key.startsWith(`${blockId}__`))
      .map(([, subjects]) => subjects);

    // Disposition arrêtée le 14/08/2026 : un seul cours par bloc, les deux
    // groupes de mathématiques occupant B (matin) et C (après-midi). Plus aucun
    // bloc ne porte deux matières, donc plus aucune incompatibilité de niveau.
    expect(subjectsAtBlock('A').every((subjects) => subjects.size === 1 && subjects.has('NSI'))).toBe(true);
    expect(subjectsAtBlock('B').every((subjects) => subjects.size === 1 && subjects.has('MATHEMATIQUES'))).toBe(true);
    expect(subjectsAtBlock('C').every((subjects) => subjects.size === 1 && subjects.has('MATHEMATIQUES'))).toBe(true);
    expect(subjectsAtBlock('D').every((subjects) => subjects.size === 1 && subjects.has('PHYSIQUE_CHIMIE'))).toBe(true);
  });

  it('GATE dailyLoadValid : R3 est INFORMATIVE — aucun rôle ne double-réserve un bloc (R1), la charge/jour est seulement rapportée, jamais plafonnée', () => {
    // Mission consolidée §0.2 (2026-07-27) : les plafonds horaires par
    // enseignant sortent des règles bloquantes du validateur — un fichier de
    // configuration ne décide plus des heures d'une personne réelle. TEACHER_C
    // atteint désormais 4 blocs/jour en Fenêtre 1 (4e Français A + 3e Français B
    // + 2de Français C + Tle Philosophie D), au-delà de son ancien plafond
    // heuristique de 3 — c'est la conséquence directe et voulue de §0.2, pas
    // une régression. Ce test vérifie ce qui reste réellement bloquant (R1 :
    // jamais 2 séances du même rôle sur le même bloc) et rapporte la charge
    // maximale observée à titre purement informatif.
    const byTeacherDay = new Map<string, Set<string>>();
    for (const session of sessions) {
      const key = `${session.teacherRole}__${session.date}`;
      const set = byTeacherDay.get(key) ?? new Set<string>();
      expect(set.has(session.block)).toBe(false);
      set.add(session.block);
      byTeacherDay.set(key, set);
    }
    const maxBlocksPerDay = Math.max(...[...byTeacherDay.values()].map((set) => set.size));
    expect(maxBlocksPerDay).toBeLessThanOrEqual(4);
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
  it('chaque cohorte (niveau/matière/cohortId) a exactement 5 séances', () => {
    // Depuis SCHEDULE-S5, une même matière peut avoir 2 cohortes (cohortId
    // distinct) — chacune doit compter exactement 5 séances, jamais 10 mélangées.
    const byCohort = new Map<string, Session[]>();
    for (const session of sessions) {
      const key = `${session.level}/${session.subject}/${session.cohortId ?? 'primary'}`;
      const list = byCohort.get(key) ?? [];
      list.push(session);
      byCohort.set(key, list);
    }
    const wrongCount = [...byCohort.entries()].filter(([, list]) => list.length !== 5);
    expect(wrongCount).toEqual([]);
    // 17 modules (14 à cohorte unique + 3 à 2 cohortes : Première SVT,
    // Terminale NSI, Terminale SVT — les 3 nouveaux groupes 4e/Philosophie
    // n'ont pas de cohorte alternative) = 14 + 6 = 20 cohortes opérationnelles.
    expect(byCohort.size).toBe(16);
  });

  it('les 5 séances de chaque cohorte tombent sur 5 jours consécutifs (calendrier)', () => {
    const byCohort = new Map<string, Session[]>();
    for (const session of sessions) {
      const key = `${session.level}/${session.subject}/${session.cohortId ?? 'primary'}`;
      const list = byCohort.get(key) ?? [];
      list.push(session);
      byCohort.set(key, list);
    }
    const nonConsecutive: string[] = [];
    for (const [key, list] of byCohort) {
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

  it('total des séances calendrier = 80 (16 cohortes × 5 jours)', () => {
    expect(sessions.length).toBe(80);
  });
});

describe('Pré-rentrée 2026 — disponibilité des élèves de Terminale', () => {
  it('aucune séance Terminale (hors Philosophie) avant le 24 août', () => {
    // Philosophie est volontairement en Fenêtre 1 (voir tests dédiés
    // ci-dessous) — l'exclure ici est intentionnel, pas un relâchement du gate.
    const terminaleSessions = sessions.filter((s) => s.level === 'TERMINALE' && s.subject !== 'PHILOSOPHIE');
    expect(terminaleSessions.length).toBeGreaterThan(0);
    const earliestDate = terminaleSessions.map((s) => s.date).sort()[0];
    expect(earliestDate >= '2026-08-24').toBe(true);
  });

  it('toutes les spécialités Terminale ouvertes (Maths, NSI, PC) démarrent bien le 24 août ou après', () => {
    // Philosophie (mission 4e/Philosophie, 2026-07-27) est délibérément placée
    // en Fenêtre 1 (17-21 août), pas en Fenêtre 2 : c'est l'exigence explicite
    // "deux semaines distinctes, aucune collision possible" entre Philosophie
    // et les spécialités (PRF-PRE2026-TERMINALE-TWO-WINDOWS). L'inclure dans ce
    // gate romprait donc volontairement l'invariant qu'il vérifie.
    const bySubject = new Map<string, string[]>();
    for (const session of sessions.filter((s) => s.level === 'TERMINALE' && s.subject !== 'PHILOSOPHIE')) {
      const list = bySubject.get(session.subject) ?? [];
      list.push(session.date);
      bySubject.set(session.subject, list);
    }
    expect(bySubject.size).toBe(3);
    for (const [subject, dates] of bySubject) {
      const earliest = dates.sort()[0];
      expect(earliest >= '2026-08-24').toBe(true);
      // sanity: subject name is part of the failure message context if this ever fails
      void subject;
    }
  });

  it('la Philosophie Terminale ne figure plus au planning (fermée le 14/08/2026, effectif insuffisant)', () => {
    // Elle occupait la Fenêtre 1, volontairement séparée des spécialités. La
    // fermeture doit être totale : une séance résiduelle rouvrirait une semaine
    // entière de campagne sans qu'aucun élève y soit inscrit.
    expect(sessions.filter((s) => s.subject === 'PHILOSOPHIE')).toEqual([]);
  });
});

describe('Pré-rentrée 2026 — seuil d’ouverture : constante unique par défaut (arbitrage direction du 2026-07-24), avec une seule exception documentée (4e, 2026-07-27)', () => {
  // La mission 4e/Philosophie fixe explicitement l'entrée en 4e à "ouverture à
  // partir de 4, maximum 6" (§5.1) — une exception consciente au seuil
  // universel de 3, pas une dérive. Toute AUTRE offre/niveau/matière doit
  // toujours partager PRE_RENTREE_MIN_COHORT_OPENING.
  const DOCUMENTED_MIN_COHORT_EXCEPTIONS: Record<string, number> = { QUATRIEME: 4 };

  it('3 inscrits minimum, pour Fondations ET Premium (enveloppe de plage) — aucune valeur dupliquée par offre/niveau/matière', () => {
    const capacity = manifest.capacityByOffer as {
      FONDATIONS: { minPerCohort: number; maxPerCohort: number };
      PREMIUM: { minPerCohort: number; maxPerCohort: number };
    };
    // Arbitrage direction (2026-07-24) : "3 partout" prime sur l'ancien plancher
    // Fondations à 4 (commercial_exception PRE2026-3E-350 mis à jour en conséquence
    // dans data/pricing.canonical.json — scope "groupe de 3 à 6 élèves"). Ceci
    // reste l'enveloppe de PLAGE (Fondations/Premium) : un niveau individuel
    // (la 4e) peut ouvrir au-dessus de ce plancher, jamais en dessous.
    expect(capacity.FONDATIONS.minPerCohort).toBe(PRE_RENTREE_MIN_COHORT_OPENING);
    expect(capacity.PREMIUM.minPerCohort).toBe(PRE_RENTREE_MIN_COHORT_OPENING);
    expect(capacity.FONDATIONS.minPerCohort).toBe(capacity.PREMIUM.minPerCohort);
  });

  it('les produits de pricing canoniques partagent le seuil universel, sauf l’exception documentée (4e = 4)', () => {
    for (const product of pricingData.pre_rentree_foundations) {
      const expected = DOCUMENTED_MIN_COHORT_EXCEPTIONS[product.level] ?? PRE_RENTREE_MIN_COHORT_OPENING;
      expect(product.group_min_open).toBe(expected);
    }
  });

  it('le catalogue d’offres publiques (offers.json) reflète le seuil universel, sauf l’exception documentée (4e = 4)', () => {
    for (const level of offersData.levels) {
      const expected = DOCUMENTED_MIN_COHORT_EXCEPTIONS[level.level] ?? PRE_RENTREE_MIN_COHORT_OPENING;
      expect(level.capacity.min).toBe(expected);
    }
  });
});
