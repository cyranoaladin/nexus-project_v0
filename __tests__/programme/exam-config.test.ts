/**
 * F40: Exam configuration tests
 * Validates multiple white subjects availability
 */

import { SUJET_BLANC_1, SUJET_BLANC_2, SUJET_BLANC_3, EPREUVE_MATHS_1ERE } from '@/app/programme/maths-1ere/config/exam';

describe('F40: Exam Configuration', () => {
  describe('Multiple subjects availability', () => {
    it('should have 3 subjects available', () => {
      expect(SUJET_BLANC_1).toBeDefined();
      expect(SUJET_BLANC_2).toBeDefined();
      expect(SUJET_BLANC_3).toBeDefined();
    });

    it('should have unique IDs for each subject', () => {
      expect(SUJET_BLANC_1.id).not.toBe(SUJET_BLANC_2.id);
      expect(SUJET_BLANC_1.id).not.toBe(SUJET_BLANC_3.id);
      expect(SUJET_BLANC_2.id).not.toBe(SUJET_BLANC_3.id);
    });

    it('should have distinct titles', () => {
      expect(SUJET_BLANC_1.titre).not.toBe(SUJET_BLANC_2.titre);
      expect(SUJET_BLANC_1.titre).not.toBe(SUJET_BLANC_3.titre);
    });
  });

  describe('Subject structure validation', () => {
    const subjects = [
      { id: 'sb1', subject: SUJET_BLANC_1 },
      { id: 'sb2', subject: SUJET_BLANC_2 },
      { id: 'sb3', subject: SUJET_BLANC_3 },
    ];

    for (const { id, subject } of subjects) {
      describe(`Subject ${id}`, () => {
        it('should have 6 automatismes', () => {
          expect(subject.automatismes).toHaveLength(6);
        });

        it('should have 3 exercices', () => {
          expect(subject.exercices).toHaveLength(3);
        });

        it('should have valid automatismes structure', () => {
          for (const auto of subject.automatismes) {
            expect(auto).toHaveProperty('id');
            expect(auto).toHaveProperty('theme');
            expect(auto).toHaveProperty('enonce');
            expect(auto).toHaveProperty('reponse');
            expect(auto).toHaveProperty('points');
          }
        });

        it('should have valid exercices structure', () => {
          for (const ex of subject.exercices) {
            expect(ex).toHaveProperty('id');
            expect(ex).toHaveProperty('titre');
            expect(ex).toHaveProperty('totalPoints');
            expect(ex).toHaveProperty('questions');
            expect(ex.questions.length).toBeGreaterThan(0);
          }
        });
      });
    }
  });

  describe('Subject content diversity', () => {
    it('should cover different mathematical domains across subjects', () => {
      const sb1Themes = new Set(SUJET_BLANC_1.automatismes.map((a: {theme: string}) => a.theme));
      const sb2Themes = new Set(SUJET_BLANC_2.automatismes.map((a: {theme: string}) => a.theme));
      const sb3Themes = new Set(SUJET_BLANC_3.automatismes.map((a: {theme: string}) => a.theme));

      // SB2 should have trigonométrie and géométrie
      expect(sb2Themes).toContain('Trigonométrie');
      expect(sb2Themes).toContain('Géométrie vectorielle');

      // SB3 should have loi binomiale and suites géométriques
      expect(sb3Themes).toContain('Loi binomiale');
    });
  });

  describe('EPREUVE_MATHS_1ERE structure', () => {
    it('should have valid exam structure', () => {
      expect(EPREUVE_MATHS_1ERE.dureeMinutes).toBe(120);
      expect(EPREUVE_MATHS_1ERE.totalPoints).toBe(20);
      expect(EPREUVE_MATHS_1ERE.parties).toHaveLength(2);
    });
  });
});
