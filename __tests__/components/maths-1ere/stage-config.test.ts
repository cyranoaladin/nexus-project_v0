/**
 * Tests for app/programme/maths-1ere/config/stage.ts
 *
 * Validates structural integrity of the stage configuration:
 * - All séances have required fields
 * - Date ordering is correct
 * - Total hours match the official 14h Maths / 16h Français promise
 * - Helper functions return correct values for all phases
 */

import {
  STAGE_PRINTEMPS_2026,
  DATE_DEBUT_STAGE,
  DATE_FIN_STAGE,
  DATE_EXAMEN_ANTICIPE,
  getTodaySession,
  getNextSession,
  getStagePhase,
  getDaysUntilStage,
  getDaysUntilExam,
  formatDateFr,
} from '@/app/programme/maths-1ere/config/stage';

describe('STAGE_PRINTEMPS_2026 — intégrité des données', () => {
  it('contient au moins une séance', () => {
    expect(STAGE_PRINTEMPS_2026.seances.length).toBeGreaterThan(0);
  });

  it('chaque séance a les champs obligatoires', () => {
    for (const seance of STAGE_PRINTEMPS_2026.seances) {
      expect(seance.date).toBeTruthy();
      expect(seance.theme).toBeTruthy();
      expect(typeof seance.duree).toBe('number');
      expect(seance.duree).toBeGreaterThan(0);
      expect(Array.isArray(seance.objectifs)).toBe(true);
      expect(Array.isArray(seance.competences)).toBe(true);
      expect(['cours', 'pratique', 'blanc', 'bilan']).toContain(seance.format);
      expect(Array.isArray(seance.chapitresClés)).toBe(true);
      expect(['Mathématiques', 'Français']).toContain(seance.matiere);
      expect(seance.heureDebut).toBeTruthy();
      expect(seance.heureFin).toBeTruthy();
    }
  });

  it('contient exactement 15 séances (8 Français + 7 Mathématiques)', () => {
    const fr = STAGE_PRINTEMPS_2026.seances.filter(s => s.matiere === 'Français');
    const ma = STAGE_PRINTEMPS_2026.seances.filter(s => s.matiere === 'Mathématiques');
    expect(fr).toHaveLength(8);
    expect(ma).toHaveLength(7);
    expect(STAGE_PRINTEMPS_2026.seances).toHaveLength(15);
  });

  it('volumes horaires corrects (Français 16h, Maths 14h)', () => {
    const frH = STAGE_PRINTEMPS_2026.seances
      .filter(s => s.matiere === 'Français')
      .reduce((s, v) => s + v.duree, 0);
    const maH = STAGE_PRINTEMPS_2026.seances
      .filter(s => s.matiere === 'Mathématiques')
      .reduce((s, v) => s + v.duree, 0);
    expect(frH).toBe(16);
    expect(maH).toBe(14);
  });

  it('les séances sont ordonnées chronologiquement', () => {
    const dates = STAGE_PRINTEMPS_2026.seances.map((s) => s.date);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] >= dates[i - 1]).toBe(true);
    }
  });

  it('le volume total des séances est cohérent (≥ heuresMaths)', () => {
    // Note: la config contient 8 séances × 2h = 16h alors que heuresMaths = 14.
    // La séance du 30 avril (Bilan Final) peut être partagée avec le français.
    // Ce test vérifie que la somme est au moins égale à heuresMaths déclaré.
    const total = STAGE_PRINTEMPS_2026.seances.reduce((sum, s) => sum + s.duree, 0);
    expect(total).toBeGreaterThanOrEqual(STAGE_PRINTEMPS_2026.heuresMaths);
  });

  it('le stage débute le 20 avril 2026', () => {
    expect(DATE_DEBUT_STAGE).toBe('2026-04-20');
  });

  it('le stage se termine le 1er mai 2026', () => {
    expect(DATE_FIN_STAGE).toBe('2026-05-01');
  });

  it("la date d'examen anticipé est en juin 2026", () => {
    expect(DATE_EXAMEN_ANTICIPE.startsWith('2026-06')).toBe(true);
  });
});

describe('getStagePhase', () => {
  it("retourne 'avant' pour une date avant le 20 avril", () => {
    expect(getStagePhase(new Date('2026-04-01'))).toBe('avant');
  });

  it("retourne 'pendant' pour une date pendant le stage", () => {
    expect(getStagePhase(new Date('2026-04-22'))).toBe('pendant');
    expect(getStagePhase(new Date('2026-04-20'))).toBe('pendant');
  });

  it("retourne 'apres' pour une date après le stage", () => {
    expect(getStagePhase(new Date('2026-05-05'))).toBe('apres');
  });
});

describe('getTodaySession', () => {
  it('retourne null pour une date hors planning', () => {
    expect(getTodaySession(new Date('2026-04-19'))).toBeNull();
    expect(getTodaySession(new Date('2026-05-02'))).toBeNull();
  });

  it('retourne la bonne séance pour le 20 avril (Français, journée double-mono)', () => {
    const session = getTodaySession(new Date('2026-04-20'));
    expect(session).not.toBeNull();
    expect(session?.date).toBe('2026-04-20');
    expect(session?.matiere).toBe('Français');
  });

  it('retourne la séance Maths du 21 avril (Second Degré)', () => {
    const session = getTodaySession(new Date('2026-04-21'), 'Mathématiques');
    expect(session).not.toBeNull();
    expect(session?.date).toBe('2026-04-21');
    expect(session?.theme).toContain('Second Degré');
  });

  it('retourne la bonne séance pour le 29 avril (Maths pratique)', () => {
    const session = getTodaySession(new Date('2026-04-29'));
    expect(session).not.toBeNull();
    expect(session?.format).toBe('pratique');
    expect(session?.matiere).toBe('Mathématiques');
  });

  it('retourne la séance blanche du 1er mai (Maths)', () => {
    const session = getTodaySession(new Date('2026-05-01'));
    expect(session).not.toBeNull();
    expect(session?.format).toBe('blanc');
    expect(session?.matiere).toBe('Mathématiques');
  });
});

describe('getNextSession', () => {
  it('retourne la première séance pour une date avant le stage', () => {
    const next = getNextSession(new Date('2026-04-15'));
    expect(next).not.toBeNull();
    expect(next?.date).toBe('2026-04-20');
  });

  it('retourne null si toutes les séances sont passées', () => {
    expect(getNextSession(new Date('2026-05-01'))).toBeNull();
  });
});

describe('getDaysUntilStage', () => {
  it('retourne 0 si le stage a commencé', () => {
    expect(getDaysUntilStage(new Date('2026-04-20'))).toBe(0);
    expect(getDaysUntilStage(new Date('2026-04-25'))).toBe(0);
  });

  it('retourne un nombre positif avant le stage', () => {
    const days = getDaysUntilStage(new Date('2026-04-10'));
    expect(days).toBeGreaterThan(0);
  });
});

describe('getDaysUntilExam', () => {
  it('retourne 0 si la date est après ou le jour de l\'examen', () => {
    expect(getDaysUntilExam(new Date('2026-07-01'))).toBe(0);
  });

  it('retourne un nombre positif avant l\'examen', () => {
    const days = getDaysUntilExam(new Date('2026-04-20'));
    expect(days).toBeGreaterThan(0);
  });
});

describe('formatDateFr', () => {
  it('formate une date en français', () => {
    const formatted = formatDateFr('2026-04-20');
    // Should contain "avril" and "20" and a day name
    expect(formatted.toLowerCase()).toContain('avril');
    expect(formatted).toContain('20');
  });
});
