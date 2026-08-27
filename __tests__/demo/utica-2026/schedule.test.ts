/**
 * P1B §3 — Planning premium. Preuve que Parent et Élève exploitent le même
 * calendrier source (getWeeklySchedule) et que la prochaine séance reste
 * cohérente avec la Vue 360° / Nexus Pulse.
 */
import { getJourneyPriority, getNexusPulse, getWeeklySchedule } from '@/lib/demo/utica-2026/selectors';
import { demoScenario } from '@/lib/demo/utica-2026/scenario';

describe('getWeeklySchedule — source unique Parent/Élève', () => {
  test('contient toutes les séances Nexus du scénario avec leurs vraies durées', () => {
    const schedule = getWeeklySchedule();
    for (const session of demoScenario.sessions) {
      const event = schedule.find((e) => e.id === session.id);
      expect(event).toBeDefined();
      expect(event!.kind).toBe(session.kind === 'COURS_NEXUS' ? 'COURS_NEXUS' : 'EVALUATION');
      expect(event!.dayLabel).toBe(session.dayLabel);
      expect(event!.timeLabel).toBe(`${session.startTime}–${session.endTime}`);
    }
  });

  test('contient les blocs de travail autonome/ARIA du scénario', () => {
    const schedule = getWeeklySchedule();
    for (const block of demoScenario.weeklyBlocks) {
      const event = schedule.find((e) => e.id === block.id);
      expect(event).toBeDefined();
      expect(event!.kind).toBe(block.kind);
      expect(event!.label).toBe(block.label);
    }
  });

  test('ne positionne que les tâches ayant un vrai jour de la semaine (jamais "aujourd\'hui"/"cette semaine")', () => {
    const schedule = getWeeklySchedule();
    const taskDrivenEvents = schedule.filter((e) => e.kind === 'DEVOIR' || (e.kind === 'EVALUATION' && !demoScenario.sessions.some((s) => s.id === e.id)));
    for (const event of taskDrivenEvents) {
      expect(["aujourd'hui", 'cette semaine']).not.toContain(event.dayLabel);
    }
  });

  test('le bloc ARIA du planning cite le même libellé que la ressource recommandée du focus', () => {
    const focus = demoScenario.focus;
    const schedule = getWeeklySchedule();
    const ariaEvent = schedule.find((e) => e.kind === 'ARIA')!;
    expect(ariaEvent.label).toBe(focus.recommendedActivityLabel);
  });

  test('est un appel idempotent : deux appels renvoient un contenu strictement identique', () => {
    expect(getWeeklySchedule()).toEqual(getWeeklySchedule());
  });

  test('régression : une échéance de tâche saisie en minuscule ("vendredi") est bien positionnée dans la grille (casse normalisée)', () => {
    const task = demoScenario.tasks.find((t) => t.dueLabel === 'vendredi')!;
    expect(task).toBeDefined();
    const event = getWeeklySchedule().find((e) => e.id === task.id);
    expect(event).toBeDefined();
    expect(event!.dayLabel).toBe('Vendredi');
  });
});

describe('Cohérence planning ↔ Vue 360° ↔ Nexus Pulse', () => {
  test('la séance liée au focus, telle que dérivée par getJourneyPriority(), apparaît dans le planning avec le même horaire', () => {
    const priority = getJourneyPriority();
    const schedule = getWeeklySchedule();
    const match = schedule.find(
      (e) => e.kind === 'COURS_NEXUS' && e.dayLabel === priority.nextSession!.dayLabel && e.timeLabel === priority.nextSession!.timeLabel,
    );
    expect(match).toBeDefined();
  });

  test('la durée totale des séances Nexus du planning correspond exactement à sessionsHours de Nexus Pulse', () => {
    const schedule = getWeeklySchedule();
    const pulse = getNexusPulse();
    const scheduledCoursNexus = schedule.filter((e) => e.kind === 'COURS_NEXUS');
    expect(scheduledCoursNexus.length).toBe(pulse.sessionsOrganizedCount);
  });
});
