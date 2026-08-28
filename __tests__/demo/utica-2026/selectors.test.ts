/**
 * Selectors du démonstrateur UTICA 2026 — amendement A3.
 *
 * Le test le plus important de ce fichier est la cohérence inter-vues :
 * Parent / Élève / ARIA doivent tous les trois dériver du même
 * `PedagogicalFocus`, jamais d'un chiffre recopié séparément.
 */
import {
  describeFocusForAria,
  describeFocusForParent,
  describeFocusForStudent,
  getAdministrativeSummary,
  getNexusInterventions,
  getPedagogicalFocus,
  getStudentTasks,
  getSubjectProgress,
  getTeacherTeam,
  getUpcomingEvents,
  getWeeklySnapshot,
  SUBJECT_LABELS,
} from '@/lib/demo/utica-2026/selectors';
import { demoScenario } from '@/lib/demo/utica-2026/scenario';
import type { PedagogicalFocus } from '@/lib/demo/utica-2026/types';

describe('getPedagogicalFocus — source unique', () => {
  test('renvoie exactement le focus du scénario (pas une copie recalculée)', () => {
    expect(getPedagogicalFocus()).toBe(demoScenario.focus);
  });
});

describe('Cohérence inter-vues Parent / Élève / ARIA (amendement A3)', () => {
  const focus = getPedagogicalFocus();

  test('les trois vues référencent la même matière et la même compétence fragile', () => {
    const parent = describeFocusForParent(focus);
    const student = describeFocusForStudent(focus);
    const aria = describeFocusForAria(focus);

    expect(parent.text).toContain(focus.subjectLabel);
    expect(parent.text).toContain(focus.fragileCompetency);

    expect(student.text).toContain(focus.subjectLabel);
    expect(student.text).toContain(focus.recommendedActivityLabel);

    expect(aria.justification).toBe(focus.evidenceSummary);
    expect(aria.activityLabel).toBe(focus.recommendedActivityLabel);
  });

  test('propriété structurelle : changer le focus change les 3 projections ensemble', () => {
    const mutated: PedagogicalFocus = {
      ...focus,
      subjectLabel: 'Physique-Chimie',
      fragileCompetency: 'Analyse dimensionnelle',
      recommendedActivityLabel: 'Exercice guidé — dimensions',
    };

    const parent = describeFocusForParent(mutated);
    const student = describeFocusForStudent(mutated);
    const aria = describeFocusForAria(mutated);

    expect(parent.text).toContain('Physique-Chimie');
    expect(parent.text).toContain('Analyse dimensionnelle');
    expect(student.text).toContain('Physique-Chimie');
    expect(student.text).toContain('Exercice guidé — dimensions');
    expect(aria.activityLabel).toBe('Exercice guidé — dimensions');

    // Le scénario réel n'a pas été altéré par la mutation locale.
    expect(getPedagogicalFocus().subjectLabel).not.toBe('Physique-Chimie');
  });
});

describe('getWeeklySnapshot', () => {
  test('les compteurs sont dérivés des sessions/tâches réelles, pas de constantes en dur', () => {
    const snapshot = getWeeklySnapshot();
    const expectedSessions = demoScenario.sessions.filter((s) => s.kind === 'COURS_NEXUS').length;
    const expectedDevoirs = demoScenario.tasks.filter((t) => t.type === 'DEVOIR' && t.status === 'A_FAIRE').length;
    const expectedQcm = demoScenario.tasks.filter((t) => t.type === 'QCM' && t.status === 'A_FAIRE').length;

    expect(snapshot.nexusSessionsCount).toBe(expectedSessions);
    expect(snapshot.devoirsToSubmitCount).toBe(expectedDevoirs);
    expect(snapshot.qcmToDoCount).toBe(expectedQcm);
  });

  test('la ressource recommandée correspond à la matière du focus pédagogique', () => {
    const snapshot = getWeeklySnapshot();
    const focus = getPedagogicalFocus();
    const expected = demoScenario.resources.find((r) => r.subject === focus.subject);
    expect(snapshot.recommendedResource?.title).toBe(expected?.title);
  });

  test('aucun élément administratif bloquant dans le scénario nominal', () => {
    expect(getWeeklySnapshot().administrativeBlockingCount).toBe(0);
  });
});

describe('getSubjectProgress', () => {
  test('chaque matière du scénario est représentée avec le prénom de son enseignant', () => {
    const progress = getSubjectProgress();
    expect(progress).toHaveLength(demoScenario.subjectTracks.length);
    for (const view of progress) {
      expect(typeof view.teacherFirstName).toBe('string');
      expect(view.teacherFirstName.length).toBeGreaterThan(0);
    }
  });

  test('la matière du focus pédagogique apparaît avec une compétence marquée À_CONSOLIDER', () => {
    const focus = getPedagogicalFocus();
    const track = getSubjectProgress().find((t) => t.subject === focus.subject);
    expect(track).toBeDefined();
    expect(track!.competencies.some((c) => c.level === 'À consolider')).toBe(true);
  });
});

describe('getUpcomingEvents', () => {
  test("fusionne séances et tâches, sans perdre d'élément", () => {
    const events = getUpcomingEvents();
    const activeTasks = demoScenario.tasks.filter((t) => t.status === 'A_FAIRE').length;
    expect(events.length).toBe(demoScenario.sessions.length + activeTasks);
  });

  test('régression P1B : une échéance "vendredi" (minuscule) se classe entre les séances de Mardi et Samedi, pas parmi les libellés relatifs', () => {
    const events = getUpcomingEvents();
    const mardiIndex = events.findIndex((e) => e.dayLabel === 'Mardi');
    const vendrediIndex = events.findIndex((e) => e.dayLabel === 'vendredi');
    const samediIndex = events.findIndex((e) => e.dayLabel === 'Samedi');

    expect(mardiIndex).toBeGreaterThanOrEqual(0);
    expect(vendrediIndex).toBeGreaterThanOrEqual(0);
    expect(samediIndex).toBeGreaterThanOrEqual(0);
    expect(vendrediIndex).toBeGreaterThan(mardiIndex);
    expect(vendrediIndex).toBeLessThan(samediIndex);
  });
});

describe('getAdministrativeSummary', () => {
  test('la somme des statuts égale le nombre total d\'éléments', () => {
    const summary = getAdministrativeSummary();
    const total = Object.values(summary.countByStatus).reduce((a, b) => a + b, 0);
    expect(total).toBe(summary.items.length);
  });

  test('chaque élément porte une provenance explicite (amendement A5)', () => {
    for (const item of getAdministrativeSummary().items) {
      expect(['REGLEMENTAIRE_CANONIQUE', 'ETAPE_NEXUS', 'DEMONSTRATION']).toContain(item.provenance);
    }
  });

  test("aucun élément administratif n'est présenté comme réglementaire canonique", () => {
    // Le dossier administratif n'a pas de modèle réglementaire source dans le
    // dépôt (cf. audit) — aucune ligne ne doit donc revendiquer cette provenance.
    for (const item of getAdministrativeSummary().items) {
      expect(item.provenance).not.toBe('REGLEMENTAIRE_CANONIQUE');
    }
  });
});

describe('getNexusInterventions', () => {
  test('filtre correctement par canal', () => {
    const ariaOnly = getNexusInterventions('ARIA');
    expect(ariaOnly.every((i) => i.channel === 'ARIA')).toBe(true);
    expect(ariaOnly.length).toBeGreaterThan(0);
    expect(ariaOnly.length).toBeLessThan(demoScenario.interventions.length);
  });

  test('sans filtre, renvoie toutes les interventions', () => {
    expect(getNexusInterventions()).toHaveLength(demoScenario.interventions.length);
  });
});

describe('getStudentTasks', () => {
  test('répartit les tâches actives entre "aujourd\'hui" et "cette semaine", et isole les tâches terminées', () => {
    const board = getStudentTasks();
    const total = board.today.length + board.thisWeek.length + board.completed.length;
    expect(total).toBe(demoScenario.tasks.length);
    expect(board.today.every((t) => t.dueLabel === "aujourd'hui")).toBe(true);
    expect(board.completed.every((t) => t.status === 'TERMINE')).toBe(true);
  });

  test('la tâche prioritaire du jour correspond à la compétence fragile du focus', () => {
    const focus = getPedagogicalFocus();
    const board = getStudentTasks();
    expect(board.today.some((t) => t.relatedCompetency === focus.fragileCompetency)).toBe(true);
  });
});

describe('getTeacherTeam', () => {
  test('chaque enseignant a un libellé de matière dérivé de SUBJECT_LABELS', () => {
    for (const teacher of getTeacherTeam()) {
      expect(teacher.subjectLabel).toBe(SUBJECT_LABELS[teacher.subject]);
    }
  });

  test("l'enseignant de la matière du focus a une prochaine séance", () => {
    const focus = getPedagogicalFocus();
    const team = getTeacherTeam();
    const teacher = team.find((t) => t.subject === focus.subject);
    expect(teacher?.nextSession?.title).toBeDefined();
  });
});

describe('Absence de PII', () => {
  test("le prénom de l'élève est manifestement fictif et aucun nom de famille complet n'est exposé", () => {
    expect(demoScenario.student.firstName).toBe('Lina');
    expect(demoScenario.student.lastNameInitial).toMatch(/^[A-Z]\.$/);
  });
});
