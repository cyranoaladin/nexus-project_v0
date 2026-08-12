import {
  CALIBRATION_THRESHOLD,
  buildCalibrationSentence,
} from '@/lib/bilans/render/calibration-prose';
import type { ReportAudience } from '@/lib/bilans/render/profile-copy';

/**
 * Phrase de calibration : déterministe, adaptée à l'audience, et — côté
 * familles — sans note ni vocabulaire de notation.
 */

const AUDIENCES: readonly ReportAudience[] = ['ELEVE', 'PARENTS', 'NEXUS'];

describe('prose de calibration', () => {
  it('est déterministe : même entrée, même phrase', () => {
    for (const audience of AUDIENCES) {
      for (const index of [null, 0, 59, 60, 100]) {
        expect(buildCalibrationSentence(index, audience)).toBe(buildCalibrationSentence(index, audience));
      }
    }
  });

  it('distingue les trois cas : non mesurable, sous le seuil, au-dessus du seuil', () => {
    for (const audience of AUDIENCES) {
      const absent = buildCalibrationSentence(null, audience);
      const sous = buildCalibrationSentence(CALIBRATION_THRESHOLD - 1, audience);
      const dessus = buildCalibrationSentence(CALIBRATION_THRESHOLD, audience);
      expect(new Set([absent, sous, dessus]).size).toBe(3);
      for (const phrase of [absent, sous, dessus]) expect(phrase.trim().length).toBeGreaterThan(0);
    }
  });

  it('adresse l’élève au tutoiement et les parents à la troisième personne', () => {
    expect(buildCalibrationSentence(80, 'ELEVE')).toMatch(/\bton\b|\btu\b/i);
    expect(buildCalibrationSentence(80, 'PARENTS')).not.toMatch(/\btu\b/i);
  });

  it('GARDE : côté familles, aucune note ni vocabulaire de notation', () => {
    for (const audience of ['ELEVE', 'PARENTS'] as const) {
      for (const index of [null, 30, 90]) {
        const phrase = buildCalibrationSentence(index, audience);
        expect(phrase).not.toMatch(/\bscore\b|\bmoyenne\b|note globale|noté/i);
        expect(phrase).not.toMatch(/\b\d{1,3}\s*\/\s*(20|100)\b/);
        // Le vocabulaire technique (calibrationIndex) reste au document interne.
        expect(phrase).not.toContain('calibrationIndex');
      }
    }
  });

  it('le document interne conserve, lui, la valeur mesurée et le seuil', () => {
    expect(buildCalibrationSentence(42, 'NEXUS')).toContain('calibrationIndex 42');
    expect(buildCalibrationSentence(42, 'NEXUS')).toContain(String(CALIBRATION_THRESHOLD));
  });
});
