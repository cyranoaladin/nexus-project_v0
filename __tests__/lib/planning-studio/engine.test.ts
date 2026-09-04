/**
 * Moteur de contraintes Planning Studio — matrice temporelle exhaustive et
 * durcissement des invariants métier Nexus.
 *
 * Le moteur est partagé : `lib/planning-studio/engine.ts` charge par effet de
 * bord les mêmes modules que le navigateur. Ce fichier teste donc la seule
 * implémentation existante, côté serveur.
 */
import {
  PLANNING_BOOTSTRAP,
  getPlanningEngine,
  type PlanningPayload,
  type PlanningSession,
} from '@/lib/planning-studio/engine';

const engine = getPlanningEngine();

/** Copie profonde du planning livré, base de tous les scénarios. */
function bootstrap(): PlanningPayload {
  return engine.normalize(JSON.parse(JSON.stringify(PLANNING_BOOTSTRAP)));
}

function codesOf(payload: PlanningPayload): string[] {
  return engine.validate(payload).issues.map((i) => i.code);
}

function severityOf(payload: PlanningPayload, code: string): string | undefined {
  return engine.validate(payload).issues.find((i) => i.code === code)?.severity;
}

function session(payload: PlanningPayload, id: string): PlanningSession {
  const found = payload.sessions.find((s) => s.id === id);
  if (!found) throw new Error(`séance introuvable dans le planning livré : ${id}`);
  return found;
}

/** Première séance active correspondant au prédicat. */
function firstActive(payload: PlanningPayload, pred: (s: PlanningSession) => boolean): PlanningSession {
  const found = payload.sessions.find((s) => s.active && pred(s));
  if (!found) throw new Error('aucune séance active ne correspond au critère');
  return found;
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// ───────────────────────────────────────────────────────────────────────────
describe('planning livré — référence du lot', () => {
  test('le planning livré reste sans erreur bloquante après durcissement', () => {
    const result = engine.validate(bootstrap());
    const errors = result.issues.filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });

  test('golden bootstrap : 45 séances, 44 actives, 1 inactive', () => {
    const data = bootstrap();
    expect(data.sessions).toHaveLength(45);
    expect(data.sessions.filter((s) => s.active)).toHaveLength(44);
    expect(data.sessions.filter((s) => !s.active)).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('matrice temporelle exhaustive (grille 15 min, 08:00 → 22:00)', () => {
  const DAY_START = toMinutes('08:00');
  const DAY_END = toMinutes('22:00');
  const STEP = 15;

  /** Vérité de référence, indépendante du moteur. */
  const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];

  /** Deux séances du même groupe : le moteur signale GROUP_OVERLAP ssi chevauchement. */
  function detects(a: [number, number], b: [number, number]): boolean {
    const data = bootstrap();
    const model = firstActive(data, (s) => Boolean(s.groupId));
    const mk = (id: string, [start, end]: [number, number]): PlanningSession => ({
      ...model,
      id,
      day: 'MON',
      start: toTime(start),
      end: toTime(end),
    });
    data.sessions = [mk('T-A', a), mk('T-B', b)];
    return codesOf(data).includes('GROUP_OVERLAP');
  }

  test('symétrie et exactitude sur toutes les paires de la grille', () => {
    const slots: Array<[number, number]> = [];
    for (let start = DAY_START; start < DAY_END; start += STEP * 4) {
      for (const duration of [15, 30, 120, 240]) {
        if (start + duration <= DAY_END) slots.push([start, start + duration]);
      }
    }
    expect(slots.length).toBeGreaterThan(40);

    for (const a of slots) {
      for (const b of slots) {
        const expected = overlaps(a, b);
        expect({ a, b, detected: detects(a, b) }).toEqual({ a, b, detected: expected });
        // symétrie
        expect(detects(b, a)).toBe(expected);
      }
    }
  });

  test.each([
    ['identiques', [540, 660], [540, 660], true],
    ['recouvrement gauche', [540, 660], [480, 600], true],
    ['recouvrement droite', [540, 660], [600, 720], true],
    ['contenu', [540, 780], [600, 660], true],
    ['adjacent (fin = début)', [540, 660], [660, 780], false],
    ['adjacent inverse', [660, 780], [540, 660], false],
    ['séparés', [540, 600], [700, 760], false],
  ] as Array<[string, [number, number], [number, number], boolean]>)(
    'cas %s',
    (_label, a, b, expected) => {
      expect(detects(a, b)).toBe(expected);
      expect(detects(b, a)).toBe(expected);
    },
  );

  test('deux séances le même créneau mais des jours différents ne se chevauchent pas', () => {
    const data = bootstrap();
    const model = firstActive(data, (s) => Boolean(s.groupId));
    data.sessions = [
      { ...model, id: 'T-A', day: 'MON', start: '09:00', end: '11:00' },
      { ...model, id: 'T-B', day: 'TUE', start: '09:00', end: '11:00' },
    ];
    expect(codesOf(data)).not.toContain('GROUP_OVERLAP');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('H5 — intégrité structurelle, y compris sur séance inactive', () => {
  test.each([
    ['fin avant début', { start: '11:00', end: '09:00' }],
    ['heure malformée', { start: 'xx:xx', end: '11:00' }],
    ['durée nulle', { start: '09:00', end: '09:00' }],
  ])('%s sur une séance INACTIVE reste détectée', (_label, patch) => {
    const data = bootstrap();
    const target = session(data, 'WED-1645-3-ET');
    expect(target.active).toBe(false);
    Object.assign(target, patch);
    expect(codesOf(data)).toContain('INVALID_TIME');
  });

  test('un jour invalide sur une séance inactive reste détecté', () => {
    const data = bootstrap();
    Object.assign(session(data, 'WED-1645-3-ET'), { day: 'FUNDAY' });
    expect(codesOf(data)).toContain('INVALID_DAY');
  });

  test("une séance inactive n'occupe toujours ni salle ni enseignant", () => {
    const data = bootstrap();
    const active = firstActive(data, () => true);
    const ghost = session(data, 'WED-1645-3-ET');
    Object.assign(ghost, {
      day: active.day,
      start: active.start,
      end: active.end,
      teacherId: active.teacherId,
      roomId: active.roomId,
      groupId: active.groupId,
    });
    const codes = codesOf(data);
    expect(codes).not.toContain('TEACHER_OVERLAP');
    expect(codes).not.toContain('ROOM_OVERLAP');
    expect(codes).not.toContain('GROUP_OVERLAP');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('contraintes dures promues', () => {
  test('H6 — hors plage d’ouverture est une erreur bloquante', () => {
    const data = bootstrap();
    Object.assign(firstActive(data, () => true), { start: '06:00', end: '08:00' });
    expect(severityOf(data, 'OUTSIDE_HOURS')).toBe('error');
  });

  test('H8 — enseignant inactif utilisé par une séance active est une erreur', () => {
    const data = bootstrap();
    const target = firstActive(data, () => true);
    const teacher = data.teachers.find((t) => t.id === target.teacherId)!;
    teacher.active = false;
    expect(severityOf(data, 'INACTIVE_TEACHER')).toBe('error');
  });

  test('H8 — salle inactive utilisée par une séance active est une erreur', () => {
    const data = bootstrap();
    const target = firstActive(data, () => true);
    data.rooms.find((r) => r.id === target.roomId)!.active = false;
    expect(severityOf(data, 'INACTIVE_ROOM')).toBe('error');
  });

  test('H8 — une séance INACTIVE peut conserver une ressource inactive', () => {
    const data = bootstrap();
    const ghost = session(data, 'WED-1645-3-ET');
    data.teachers.find((t) => t.id === ghost.teacherId)!.active = false;
    expect(codesOf(data)).not.toContain('INACTIVE_TEACHER');
  });

  test('GROUP_MISMATCH — niveau/public incohérent avec le groupe est une erreur', () => {
    const data = bootstrap();
    const target = firstActive(data, (s) => s.level !== 'TERMINALE');
    target.level = 'TERMINALE';
    expect(severityOf(data, 'GROUP_MISMATCH')).toBe('error');
  });

  test('TEACHER_SKILL — matière hors compétences déclarées est une erreur', () => {
    const data = bootstrap();
    const target = firstActive(data, (s) => s.subjectId === 'MATHS');
    target.teacherId = data.teachers.find((t) => !(t.subjects as string[]).includes('MATHS'))!.id;
    expect(severityOf(data, 'TEACHER_SKILL')).toBe('error');
  });

  test('durée ≠ 120 min sur une séance régulière est une erreur', () => {
    const data = bootstrap();
    const target = firstActive(data, () => true);
    target.end = toTime(toMinutes(target.start) + 90);
    expect(severityOf(data, 'INVALID_SESSION_DURATION')).toBe('error');
  });

  test('les 45 séances livrées durent exactement 120 minutes', () => {
    for (const s of bootstrap().sessions) {
      expect(toMinutes(s.end) - toMinutes(s.start)).toBe(120);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('politique salles — invariant structurel, pas un drapeau isolé', () => {
  test('trois salles actives toutes « normales » est une erreur bloquante', () => {
    const data = bootstrap();
    data.rooms.forEach((r) => {
      r.exceptional = false;
    });
    expect(severityOf(data, 'NORMAL_ROOM_POLICY_VIOLATION')).toBe('error');
  });

  test('la règle survit au renommage de la salle exceptionnelle', () => {
    const data = bootstrap();
    const exceptional = data.rooms.find((r) => r.exceptional)!;
    exceptional.name = 'Annexe Carthage';
    expect(codesOf(data)).not.toContain('NORMAL_ROOM_POLICY_VIOLATION');
  });

  test('le planning livré respecte la politique salles', () => {
    expect(codesOf(bootstrap())).not.toContain('NORMAL_ROOM_POLICY_VIOLATION');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('couverture métier — la cadence fait partie de la politique', () => {
  test('supprimer une prestation HEBDOMADAIRE est une erreur bloquante', () => {
    const data = bootstrap();
    // Philosophie Terminale CL : cours récurrent de l'offre.
    data.sessions = data.sessions.filter((s) => !(s.subjectId === 'PHILO' && s.audience === 'CL'));
    expect(severityOf(data, 'REQUIRED_COVERAGE_MISSING')).toBe('error');
  });

  test('désactiver la dernière séance hebdomadaire d’une prestation est une erreur', () => {
    const data = bootstrap();
    data.sessions
      .filter((s) => s.subjectId === 'PHILO' && s.audience === 'CL')
      .forEach((s) => {
        s.active = false;
      });
    expect(severityOf(data, 'REQUIRED_COVERAGE_MISSING')).toBe('error');
  });

  test('le Grand Oral est un MODULE : son absence de la semaine type n’est pas une erreur', () => {
    // data/pricing.canonical.json → rules.grand_oral_policy : 4 séances de 2 h
    // sur l'année (8 h), offres terminale-libre-focus-bac et -integrale. Exiger
    // une séance hebdomadaire inventerait une fréquence que l'offre ne prévoit
    // pas, uniquement pour satisfaire une porte.
    const data = bootstrap();
    data.sessions = data.sessions.filter((s) => s.subjectId !== 'GRAND_ORAL');
    const codes = codesOf(data);
    expect(codes).not.toContain('REQUIRED_COVERAGE_MISSING');
    expect(severityOf(data, 'COVERAGE_MODULE')).toBe('info');
  });

  test('un emplacement de module dans la semaine type est signalé en information', () => {
    // Le planning livré réserve un créneau Grand Oral : c'est un emplacement,
    // pas un cours hebdomadaire — information, jamais erreur.
    expect(severityOf(bootstrap(), 'COVERAGE_MODULE_SLOT')).toBe('info');
  });

  test('le planning livré couvre toute l’offre Nexus', () => {
    expect(codesOf(bootstrap())).not.toContain('REQUIRED_COVERAGE_MISSING');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('H9 — unicité étendue à toute la configuration', () => {
  test.each([
    ['teachers', 'DUPLICATE_TEACHER_ID'],
    ['rooms', 'DUPLICATE_ROOM_ID'],
    ['subjects', 'DUPLICATE_SUBJECT_ID'],
    ['groups', 'DUPLICATE_GROUP_ID'],
  ])('un identifiant %s dupliqué est une erreur', (collection, code) => {
    const data = bootstrap() as unknown as Record<string, Array<{ id: string }>>;
    const list = data[collection];
    list.push({ ...list[0] });
    expect(severityOf(data as unknown as PlanningPayload, code)).toBe('error');
  });

  test('deux enseignants partageant le même code est une erreur', () => {
    const data = bootstrap();
    data.teachers[1].code = data.teachers[0].code;
    expect(severityOf(data, 'DUPLICATE_TEACHER_CODE')).toBe('error');
  });

  test('deux salles au nom normalisé identique sont signalées', () => {
    const data = bootstrap();
    data.rooms[1].name = `  ${data.rooms[0].name.toUpperCase()} `;
    expect(codesOf(data)).toContain('DUPLICATE_ROOM_NAME');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('doublons de séances', () => {
  test('doublon exact détecté', () => {
    const data = bootstrap();
    const model = firstActive(data, () => true);
    data.sessions.push({ ...model, id: `${model.id}-COPIE` });
    expect(severityOf(data, 'DUPLICATE_SESSION_EXACT')).toBe('error');
  });

  test('doublon sémantique détecté même avec enseignant et salle différents', () => {
    const data = bootstrap();
    const model = firstActive(data, () => true);
    const otherRoom = data.rooms.find((r) => r.id !== model.roomId)!;
    data.sessions.push({ ...model, id: `${model.id}-BIS`, roomId: otherRoom.id });
    const codes = codesOf(data);
    expect(codes).toContain('DUPLICATE_SESSION_SEMANTIC');
  });

  test('Maths A et Maths B ne sont jamais comptés comme doublons', () => {
    const codes = codesOf(bootstrap());
    expect(codes).not.toContain('DUPLICATE_SESSION_EXACT');
    expect(codes).not.toContain('DUPLICATE_SESSION_SEMANTIC');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('règles pédagogiques par niveau', () => {
  test('S1 — collège scolarisé hors mercredi est une erreur métier', () => {
    const data = bootstrap();
    session(data, 'WED-1430-4-M').day = 'THU';
    expect(severityOf(data, 'COLLEGE_DAY')).toBe('error');
  });

  test('S1 — le cours collège de 19h00–21h00 le mercredi reste valide', () => {
    // Faux positif à ne pas réintroduire : la fenêtre Nexus est 14:00–21:00.
    const data = bootstrap();
    const evening = session(data, 'WED-1900-3-M');
    expect(evening.day).toBe('WED');
    expect(evening.start).toBe('19:00');
    expect(codesOf(data)).not.toContain('COLLEGE_DAY');
  });

  test('S1 — collège le mercredi matin sort de la fenêtre', () => {
    const data = bootstrap();
    Object.assign(session(data, 'WED-1430-4-M'), { start: '09:00', end: '11:00' });
    expect(severityOf(data, 'COLLEGE_DAY')).toBe('error');
  });

  test('S2 — Seconde hors mercredi est un avertissement, pas une erreur', () => {
    const data = bootstrap();
    session(data, 'WED-1645-2-M').day = 'THU';
    expect(severityOf(data, 'SECONDE_DAY')).toBe('warning');
  });

  test('S3 — Première/Terminale scolarisées hors week-end sont signalées', () => {
    const data = bootstrap();
    firstActive(data, (s) => s.audience === 'SCO' && s.level === 'TERMINALE').day = 'MON';
    expect(severityOf(data, 'SENIOR_SCOLARISE_WEEKEND')).toBe('warning');
  });

  test('S3 — le planning livré place tout le lycée scolarisé le week-end', () => {
    expect(codesOf(bootstrap())).not.toContain('SENIOR_SCOLARISE_WEEKEND');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('S7 — attentes élèves, pause déjeuner déduite', () => {
  /** Place deux séances du même groupe autour d'un intervalle donné. */
  function gapCodes(firstEnd: string, secondStart: string): string[] {
    const data = bootstrap();
    const model = firstActive(data, (s) => Boolean(s.groupId));
    data.sessions = [
      { ...model, id: 'G-1', day: 'MON', start: toTime(toMinutes(firstEnd) - 120), end: firstEnd },
      { ...model, id: 'G-2', day: 'MON', start: secondStart, end: toTime(toMinutes(secondStart) + 120) },
    ];
    return codesOf(data);
  }

  test('une attente entièrement hors déjeuner reste comptée', () => {
    // 16:30 → 19:00 = 150 min pleines, sans recouvrement du déjeuner.
    expect(gapCodes('16:30', '19:00')).toContain('WAIT_LONG');
  });

  test('une attente strictement égale à la pause déjeuner ne compte pas', () => {
    // 13:15 → 14:45 : exactement settings.lunchBreak.
    const codes = gapCodes('13:15', '14:45');
    expect(codes).not.toContain('WAIT_LONG');
    expect(codes).not.toContain('WAIT_MEDIUM');
  });

  test('une attente chevauchant partiellement le déjeuner est réduite d’autant', () => {
    // 12:45 → 15:15 = 150 min brutes, dont 90 de déjeuner → 60 min nettes.
    const codes = gapCodes('12:45', '15:15');
    expect(codes).not.toContain('WAIT_LONG'); // 60 < 90
    expect(codes).toContain('WAIT_MEDIUM'); // 60 > 45
  });

  test('une attente couvrant avant + déjeuner + après déduit la seule pause', () => {
    // 11:15 → 17:00 = 345 min brutes, dont 90 de déjeuner → 255 min nettes.
    expect(gapCodes('11:15', '17:00')).toContain('WAIT_LONG');
  });

  test('le planning livré ne signale plus d’attente autour du déjeuner', () => {
    const issues = engine.validate(bootstrap()).issues.filter((i) => i.code.startsWith('WAIT_'));
    for (const issue of issues) {
      expect(issue.message).not.toContain('1 h 30');
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('politiques enseignants — exprimées en matières, jamais en noms', () => {
  test('Maths et NSI scolarisés scindés entre deux enseignants est signalé', () => {
    const data = bootstrap();
    const nsi = firstActive(data, (s) => s.subjectId === 'NSI' && s.audience === 'SCO');
    const other = data.teachers.find((t) => (t.subjects as string[]).includes('NSI') && t.id !== nsi.teacherId)!;
    nsi.teacherId = other.id;
    expect(codesOf(data)).toContain('TEACHER_POLICY_SPLIT');
  });

  test('Français et Philosophie scindés entre deux enseignants est signalé', () => {
    const data = bootstrap();
    const philo = firstActive(data, (s) => s.subjectId === 'PHILO');
    philo.teacherId = data.teachers.find((t) => t.id !== philo.teacherId)!.id;
    expect(codesOf(data)).toContain('TEACHER_POLICY_SPLIT');
  });

  test('le planning livré respecte les trois politiques enseignants', () => {
    expect(codesOf(bootstrap())).not.toContain('TEACHER_POLICY_SPLIT');
  });

  test('renommer un enseignant ne déclenche aucune violation', () => {
    const data = bootstrap();
    data.teachers[0].name = 'Nouvel Enseignant';
    expect(codesOf(data)).not.toContain('TEACHER_POLICY_SPLIT');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('configuration inutilisée', () => {
  test('une matière hebdomadaire obligatoire jamais utilisée est une erreur de couverture', () => {
    const data = bootstrap();
    data.sessions = data.sessions.filter((s) => s.subjectId !== 'ENS_SCI');
    expect(codesOf(data)).toContain('REQUIRED_COVERAGE_MISSING');
  });

  test('une salle jamais référencée est une information, pas une erreur', () => {
    const data = bootstrap();
    data.rooms.push({ ...data.rooms[0], id: 'room-libre', name: 'Salle libre', exceptional: true });
    expect(severityOf(data, 'UNUSED_ROOM')).toBe('info');
  });

  test('un groupe jamais référencé est une information', () => {
    const data = bootstrap();
    data.groups.push({ ...data.groups[0], id: 'grp-libre', label: 'Groupe libre' });
    expect(severityOf(data, 'UNUSED_GROUP')).toBe('info');
  });
});
