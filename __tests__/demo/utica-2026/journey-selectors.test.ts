/**
 * P1A — Vue 360° / Nexus Pulse : preuves de cohérence inter-vues
 * (gate P1A §20). Chaque test compare une vue à une autre plutôt que de
 * vérifier une valeur en dur, pour verrouiller l'invariant "une seule
 * source de vérité" (amendement A3), pas seulement le contenu du jour.
 */
import fs from 'fs';
import path from 'path';
import {
  describeFocusForAria,
  describeFocusForParent,
  describeFocusForStudent,
  formatSessionTime,
  getAdministrativeSummary,
  getJourneyMilestones,
  getJourneyOverview,
  getJourneyPriority,
  getNexusInterventions,
  getNexusPulse,
  getPedagogicalFocus,
  getPedagogicalFocuses,
  getTeacherTeam,
  getUpcomingEvents,
  getWeeklySnapshot,
} from '@/lib/demo/utica-2026/selectors';
import { demoScenario } from '@/lib/demo/utica-2026/scenario';

describe('Focus pédagogique — Parent = Élève = ARIA = Vue 360°', () => {
  test('les 4 vues portent la même matière et la même compétence fragile', () => {
    const focus = getPedagogicalFocus();
    const parent = describeFocusForParent(focus);
    const student = describeFocusForStudent(focus);
    const aria = describeFocusForAria(focus);
    const journey = getJourneyPriority();

    expect(parent.text).toContain(focus.fragileCompetency);
    expect(student.text).toContain(focus.subjectLabel);
    expect(aria.justification).toBe(focus.evidenceSummary);
    expect(journey.subjectLabel).toBe(focus.subjectLabel);
    expect(journey.fragileCompetency).toBe(focus.fragileCompetency);
    expect(journey.masteredCompetency).toBe(focus.masteredCompetency);
    expect(journey.nextActionLabel).toBe(focus.recommendedActivityLabel);
  });

  test('la dimension "Pédagogie" de la Vue 360° référence le même focus', () => {
    const focus = getPedagogicalFocus();
    const pedagogie = getJourneyOverview().find((d) => d.key === 'PEDAGOGIE')!;
    expect(pedagogie.bullets.some((b) => b.includes(focus.fragileCompetency))).toBe(true);
    expect(pedagogie.bullets.some((b) => b.includes(focus.masteredCompetency))).toBe(true);
  });
});

describe('Administratif — Vue 360° = Parent', () => {
  test('le nombre de blocages de la dimension Administratif == administrativeBlockingCount de Parent', () => {
    const { administrativeBlockingCount } = getAdministrativeSummary();
    const dim = getJourneyOverview().find((d) => d.key === 'ADMINISTRATIF')!;
    expect(dim.state).toBe(administrativeBlockingCount === 0 ? 'SOUS_CONTROLE' : 'ACTION_REQUISE');
    expect(dim.bullets[0]).toContain(String(administrativeBlockingCount === 0 ? 0 : administrativeBlockingCount));
  });
});

describe('Planning — la prochaine séance est identique partout', () => {
  test('getJourneyPriority().nextSession correspond à la vraie séance liée au focus', () => {
    const focus = getPedagogicalFocus();
    const expectedSession = demoScenario.sessions.find((s) => s.id === focus.nextTeacherSessionId)!;
    const journey = getJourneyPriority();

    expect(journey.nextSession).not.toBeNull();
    expect(journey.nextSession!.dayLabel).toBe(expectedSession.dayLabel);
    expect(journey.nextSession!.timeLabel).toBe(formatSessionTime(expectedSession));
  });

  test('la même séance apparaît dans getTeacherTeam() pour l\'enseignant de la matière du focus', () => {
    const focus = getPedagogicalFocus();
    const journey = getJourneyPriority();
    const teacher = getTeacherTeam().find((t) => t.subject === focus.subject)!;

    expect(teacher.nextSession).not.toBeNull();
    expect(teacher.nextSession!.dayLabel).toBe(journey.nextSession!.dayLabel);
    expect(teacher.nextSession!.timeLabel).toBe(journey.nextSession!.timeLabel);
    expect(teacher.firstName).toBe(journey.nextSession!.teacherFirstName);
  });

  test('la même échéance apparaît dans getUpcomingEvents()', () => {
    const focus = getPedagogicalFocus();
    const journey = getJourneyPriority();
    const events = getUpcomingEvents();
    const matching = events.find(
      (e) => e.kind === 'SEANCE' && e.subject === focus.subject && e.dayLabel === journey.nextSession!.dayLabel,
    );
    expect(matching).toBeDefined();
  });
});

describe('Nexus Pulse — dérivé du scénario, jamais un chiffre en dur', () => {
  test('sessionsOrganizedCount == nombre de séances COURS_NEXUS du scénario', () => {
    const pulse = getNexusPulse();
    const expected = demoScenario.sessions.filter((s) => s.kind === 'COURS_NEXUS').length;
    expect(pulse.sessionsOrganizedCount).toBe(expected);
  });

  test('sessionsHours == somme exacte des durées des séances (10:00–12:00 + 17:00–18:30 = 3.5h)', () => {
    const pulse = getNexusPulse();
    expect(pulse.sessionsHours).toBeCloseTo(3.5, 5);
  });

  test('resultsAnalyzedCount == nombre d\'interventions équipe Nexus catégorie ANALYSIS', () => {
    const pulse = getNexusPulse();
    const expected = getNexusInterventions('EQUIPE_NEXUS').filter((i) => i.category === 'ANALYSIS').length;
    expect(pulse.resultsAnalyzedCount).toBe(expected);
    expect(pulse.resultsAnalyzedCount).toBeGreaterThan(0);
  });

  test('planUpdated == présence réelle d\'une intervention PLANNING_UPDATE', () => {
    const pulse = getNexusPulse();
    const hasPlanningUpdate = demoScenario.interventions.some(
      (i) => i.channel === 'EQUIPE_NEXUS' && i.category === 'PLANNING_UPDATE',
    );
    expect(pulse.planUpdated).toBe(hasPlanningUpdate);
    expect(pulse.planUpdated).toBe(true);
  });

  test('resourcesRecommendedCount == getWeeklySnapshot().recommendedResource != null', () => {
    const pulse = getNexusPulse();
    const snapshot = getWeeklySnapshot();
    expect(pulse.resourcesRecommendedCount).toBe(snapshot.recommendedResource ? 1 : 0);
  });

  test('prioritiesIdentifiedCount == getPedagogicalFocuses().length (jamais un littéral en dur — dette P1A §0.B)', () => {
    expect(getNexusPulse().prioritiesIdentifiedCount).toBe(getPedagogicalFocuses().length);
    expect(getPedagogicalFocuses().length).toBe(1);
  });

  test('nextNexusAction cite la même compétence fragile et la même séance que getJourneyPriority()', () => {
    const pulse = getNexusPulse();
    const journey = getJourneyPriority();
    expect(pulse.nextNexusAction.toLowerCase()).toContain(journey.fragileCompetency.toLowerCase());
    expect(pulse.nextNexusAction).toContain(journey.nextSession!.dayLabel);
  });

  test('aucune formulation marketing invérifiable (gate P1A §15)', () => {
    const pulse = getNexusPulse();
    const forbidden = ['24/7', 'ia analyse', 'prédiction', 'parcours adaptatif automatique', 'optimisation automatique'];
    const haystack = JSON.stringify(pulse).toLowerCase();
    for (const term of forbidden) {
      expect(haystack).not.toContain(term);
    }
  });
});

describe('Jalons Nexus (§10)', () => {
  test('tous les jalons ont une provenance implicite ETAPE_NEXUS (jamais un statut réglementaire)', () => {
    const milestones = getJourneyMilestones();
    expect(milestones.length).toBeGreaterThan(0);
    for (const m of milestones) {
      expect(['DONE', 'CURRENT', 'UPCOMING']).toContain(m.status);
    }
  });

  test('exactement un jalon est CURRENT (pas d\'ambiguïté sur "où on en est")', () => {
    const current = getJourneyMilestones().filter((m) => m.status === 'CURRENT');
    expect(current).toHaveLength(1);
  });
});

describe('Kill switch — /360 sous le même layout que les autres routes démo', () => {
  test('app/demo/utica-2026/360/page.tsx existe et ne redéfinit pas sa propre vérification de flag', () => {
    const filePath = path.join(process.cwd(), 'app/demo/utica-2026/360/page.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/isUticaDemoEnabled|UTICA_DEMO_ENABLED/);
  });
});

describe('Aucun score artificiel (gate P1A §4)', () => {
  test('aucune dimension Vue 360° ni Nexus Pulse ne contient de pourcentage ou de probabilité inventés', () => {
    const dimensions = getJourneyOverview();
    const pulse = getNexusPulse();
    const haystack = [...dimensions.flatMap((d) => d.bullets), ...dimensions.map((d) => d.stateLabel), pulse.nextNexusAction]
      .join(' ')
      .toLowerCase();
    expect(haystack).not.toMatch(/%|chances? de réussi|probabilité/);
  });
});
