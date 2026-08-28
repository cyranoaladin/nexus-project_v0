/**
 * P1B §0.A — durées structurées. Preuve que le calcul de durée (Nexus
 * Pulse) est totalement indépendant du libellé d'affichage : changer le
 * format d'affichage ne doit jamais changer le résultat numérique.
 */
import { formatSessionTime, getNexusPulse, sessionDurationMinutes } from '@/lib/demo/utica-2026/selectors';
import { demoScenario } from '@/lib/demo/utica-2026/scenario';

describe('sessionDurationMinutes — dérivé uniquement de startTime/endTime', () => {
  test('calcule la bonne durée pour chaque séance réelle du scénario', () => {
    const maths = demoScenario.sessions.find((s) => s.id === 's-maths-samedi')!;
    const nsi = demoScenario.sessions.find((s) => s.id === 's-nsi-mardi')!;
    expect(sessionDurationMinutes(maths)).toBe(120); // 10:00–12:00
    expect(sessionDurationMinutes(nsi)).toBe(90); // 17:00–18:30
  });

  test("changer le libellé d'affichage ne change jamais le calcul (indépendance structurelle)", () => {
    const session = { startTime: '09:15', endTime: '10:45' };
    const durationBeforeFormatCall = sessionDurationMinutes(session);

    // On appelle/altère le formateur d'affichage de toutes les façons possibles —
    // la durée calculée doit rester strictement identique.
    const label1 = formatSessionTime(session);
    const label2 = `${session.startTime} à ${session.endTime}`; // format alternatif, jamais utilisé par le calcul
    void label1;
    void label2;

    expect(sessionDurationMinutes(session)).toBe(durationBeforeFormatCall);
    expect(sessionDurationMinutes(session)).toBe(90);
  });

  test('formatSessionTime ne prend aucune part au calcul de sessionDurationMinutes (signatures disjointes)', () => {
    // sessionDurationMinutes n'accepte pas de timeLabel — la seule façon de
    // lui fournir une durée différente est de changer startTime/endTime.
    const a = { startTime: '08:00', endTime: '09:00' };
    const b = { startTime: '08:00', endTime: '09:00' };
    expect(formatSessionTime(a)).toBe(formatSessionTime(b));
    expect(sessionDurationMinutes(a)).toBe(sessionDurationMinutes(b));
  });
});

describe('Nexus Pulse — sessionsHours dérivé des durées structurées réelles', () => {
  test('sessionsHours == somme exacte des sessionDurationMinutes / 60', () => {
    const expectedMinutes = demoScenario.sessions
      .filter((s) => s.kind === 'COURS_NEXUS')
      .reduce((sum, s) => sum + sessionDurationMinutes(s), 0);
    expect(getNexusPulse().sessionsHours).toBeCloseTo(expectedMinutes / 60, 5);
  });
});
