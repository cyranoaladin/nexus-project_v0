/**
 * Parcours élèves — vérification combinatoire du planning livré.
 *
 * Un élève ne suit pas toutes les séances de son niveau : il suit un parcours,
 * c'est-à-dire un choix de spécialités. Les attentes et les chevauchements se
 * mesurent donc sur des combinaisons, jamais sur le groupe de niveau entier.
 *
 * Pour les scolarisés, les Mathématiques existent en deux groupes (Maths A,
 * orienté NSI ; Maths B, orienté Physique-Chimie) : le parcours retient
 * automatiquement le meilleur des deux.
 */
import {
  PLANNING_BOOTSTRAP,
  getPlanningEngine,
  type PlanningPayload,
  type PlanningSession,
} from '@/lib/planning-studio/engine';

const engine = getPlanningEngine();
const data: PlanningPayload = engine.normalize(JSON.parse(JSON.stringify(PLANNING_BOOTSTRAP)));
const active = data.sessions.filter((s) => s.active);

const SPECIALTIES = ['MATHS', 'NSI', 'PC', 'SVT', 'SES', 'HGGSP'] as const;
type Specialty = (typeof SPECIALTIES)[number];

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const overlap = (a: PlanningSession, b: PlanningSession) =>
  a.day === b.day && toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);

/**
 * Attente nette entre deux séances : la pause déjeuner configurée n'est pas
 * une attente subie. Même convention que le moteur (règle S7).
 */
const lunch = (data.settings as { lunchBreak?: { start: string; end: string } }).lunchBreak;
const netWait = (from: number, to: number) => {
  if (!lunch) return to - from;
  const covered = Math.max(0, Math.min(to, toMinutes(lunch.end)) - Math.max(from, toMinutes(lunch.start)));
  return to - from - covered;
};

/** Toutes les combinaisons de `size` éléments. */
function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [head, ...rest] = items;
  return [...combinations(rest, size - 1).map((c) => [head, ...c]), ...combinations(rest, size)];
}

/** Produit cartésien des séances candidates de chaque spécialité. */
function assignments(options: PlanningSession[][]): PlanningSession[][] {
  return options.reduce<PlanningSession[][]>(
    (acc, list) => acc.flatMap((prefix) => list.map((s) => [...prefix, s])),
    [[]],
  );
}

/** Séances actives couvrant une spécialité pour un niveau et un public donnés. */
function candidates(level: string, audience: string, subject: Specialty): PlanningSession[] {
  return active.filter((s) => s.level === level && s.audience === audience && s.subjectId === subject);
}

interface PathwayResult {
  overlaps: number;
  days: number;
  maxWaitMinutes: number;
  groups: string[];
}

/** Meilleure implantation d'un parcours : d'abord zéro conflit, puis attente minimale. */
function bestPathway(level: string, audience: string, combo: readonly Specialty[]): PathwayResult | null {
  const options = combo.map((subject) => candidates(level, audience, subject));
  if (options.some((list) => list.length === 0)) return null;

  let best: PathwayResult | null = null;
  for (const choice of assignments(options)) {
    let overlaps = 0;
    for (let i = 0; i < choice.length; i++) {
      for (let j = i + 1; j < choice.length; j++) if (overlap(choice[i], choice[j])) overlaps++;
    }
    const byDay = new Map<string, PlanningSession[]>();
    for (const s of choice) {
      if (!byDay.has(s.day)) byDay.set(s.day, []);
      byDay.get(s.day)!.push(s);
    }
    let maxWait = 0;
    for (const list of byDay.values()) {
      list.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
      for (let i = 1; i < list.length; i++) {
        maxWait = Math.max(maxWait, netWait(toMinutes(list[i - 1].end), toMinutes(list[i].start)));
      }
    }
    const result: PathwayResult = {
      overlaps,
      days: byDay.size,
      maxWaitMinutes: maxWait,
      groups: choice.map((s) => s.groupId),
    };
    if (!best || result.overlaps < best.overlaps || (result.overlaps === best.overlaps && result.maxWaitMinutes < best.maxWaitMinutes)) {
      best = result;
    }
  }
  return best;
}

function auditAll(level: string, audience: string, size: number) {
  const combos = combinations(SPECIALTIES, size);
  const withOverlap = combos.filter((combo) => {
    const best = bestPathway(level, audience, combo);
    return best === null || best.overlaps > 0;
  });
  return { tested: combos.length, withOverlap };
}

// ───────────────────────────────────────────────────────────────────────────
describe('candidats individuels — aucune combinaison de spécialités en conflit', () => {
  test('Première CL : C(6,3) = 20 combinaisons, 0 chevauchement', () => {
    const { tested, withOverlap } = auditAll('PREMIERE', 'CL', 3);
    expect(tested).toBe(20);
    expect(withOverlap).toEqual([]);
  });

  test('Terminale CL : C(6,2) = 15 combinaisons, 0 chevauchement', () => {
    const { tested, withOverlap } = auditAll('TERMINALE', 'CL', 2);
    expect(tested).toBe(15);
    expect(withOverlap).toEqual([]);
  });
});

describe('scolarisés — le choix Maths A / Maths B résout chaque parcours', () => {
  test('Première SCO : C(6,3) = 20 combinaisons, 0 chevauchement', () => {
    const { tested, withOverlap } = auditAll('PREMIERE', 'SCO', 3);
    expect(tested).toBe(20);
    expect(withOverlap).toEqual([]);
  });

  test('Terminale SCO : C(6,2) = 15 combinaisons, 0 chevauchement', () => {
    const { tested, withOverlap } = auditAll('TERMINALE', 'SCO', 2);
    expect(tested).toBe(15);
    expect(withOverlap).toEqual([]);
  });

  test('un parcours Maths + NSI retient bien le groupe Maths A', () => {
    const best = bestPathway('PREMIERE', 'SCO', ['MATHS', 'NSI'])!;
    expect(best.overlaps).toBe(0);
    expect(best.groups.some((g) => g.endsWith('-A'))).toBe(true);
  });

  test('un parcours Maths + Physique-Chimie retient bien le groupe Maths B', () => {
    const best = bestPathway('PREMIERE', 'SCO', ['MATHS', 'PC'])!;
    expect(best.overlaps).toBe(0);
    expect(best.groups.some((g) => g.endsWith('-B'))).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('enchaînements Maths A → NSI et Maths B → Physique-Chimie', () => {
  /** Séance d'une matière pour un groupe donné. */
  function of(groupId: string, subject: string): PlanningSession {
    const found = active.find((s) => s.groupId === groupId && s.subjectId === subject);
    if (!found) throw new Error(`séance introuvable : ${groupId} / ${subject}`);
    return found;
  }

  test.each([
    ['Première Maths A → NSI', 'P1-SCO-A', 'NSI'],
    ['Première Maths B → PC', 'P1-SCO-B', 'PC'],
    ['Terminale Maths A → NSI', 'T-SCO-A', 'NSI'],
    ['Terminale Maths B → PC', 'T-SCO-B', 'PC'],
  ])('%s : même jour, enchaînement de 15 minutes, sans conflit', (_label, groupId, second) => {
    const maths = of(groupId, 'MATHS');
    const next = of(groupId, second);

    expect(next.day).toBe(maths.day);
    expect(overlap(maths, next)).toBe(false);
    expect(toMinutes(next.start) - toMinutes(maths.end)).toBe(15);
  });

  test('Maths et NSI d’un même groupe sont assurés par le même enseignant', () => {
    for (const groupId of ['P1-SCO-A', 'T-SCO-A']) {
      expect(of(groupId, 'NSI').teacherId).toBe(of(groupId, 'MATHS').teacherId);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('attente maximale des parcours — caractérisation explicite', () => {
  /**
   * Ces valeurs ne sont pas un objectif : elles décrivent le planning livré.
   *
   * Certaines combinaisons imposent une attente supérieure au seuil de confort
   * `waitStrongMinutes` (90 min). C'est un compromis assumé de la structure
   * actuelle à deux enseignants de spécialité et trois salles : les créneaux du
   * vendredi soir et du dimanche soir ne peuvent pas être rapprochés sans créer
   * un conflit de salle ou d'enseignant.
   *
   *   ACCEPTED_OPERATIONAL_EXCEPTION — attente longue sur les parcours suivants.
   *
   * Le test échoue si l'attente AUGMENTE : toute dégradation devient visible,
   * et toute amélioration du planning devra mettre ces bornes à jour.
   */
  test.each([
    ['Première CL', 'PREMIERE', 'CL', 3, 150],
    ['Terminale CL', 'TERMINALE', 'CL', 2, 150],
    ['Première scolarisée', 'PREMIERE', 'SCO', 3, 135],
    ['Terminale scolarisée', 'TERMINALE', 'SCO', 2, 135],
  ] as Array<[string, string, string, number, number]>)(
    '%s : attente maximale inchangee sur le meilleur parcours',
    (_label, level, audience, size, expected) => {
      let worst = 0;
      for (const combo of combinations(SPECIALTIES, size)) {
        const best = bestPathway(level, audience, combo);
        if (best) worst = Math.max(worst, best.maxWaitMinutes);
      }
      expect(worst).toBe(expected);
    },
  );

  test('aucun parcours ne franchit une demi-journée d’attente', () => {
    for (const [level, audience, size] of [
      ['PREMIERE', 'CL', 3],
      ['TERMINALE', 'CL', 2],
      ['PREMIERE', 'SCO', 3],
      ['TERMINALE', 'SCO', 2],
    ] as Array<[string, string, number]>) {
      for (const combo of combinations(SPECIALTIES, size)) {
        const best = bestPathway(level, audience, combo);
        if (best) expect(best.maxWaitMinutes).toBeLessThan(240);
      }
    }
  });
});
