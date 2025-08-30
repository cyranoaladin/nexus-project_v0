import { calculateQcmScores, QcmAnswer } from 'packages/shared/scoring/qcm_scoring';

describe('qcm_scoring', () => {
  describe('calculateQcmScores', () => {
    it('should return a zero summary for empty answers', () => {
      const answers: QcmAnswer[] = [];
      const result = calculateQcmScores(answers);
      expect(result).toEqual({
        total: 0,
        max: 0,
        scoreGlobalPct: 0,
        weakDomainsCount: 0,
        domains: [],
      });
    });

    it('should correctly calculate scores for a single correct answer', () => {
      const answers: QcmAnswer[] = [
        { domain: 'Maths', isCorrect: true, points: 10, maxPoints: 10 },
      ];
      const result = calculateQcmScores(answers);
      expect(result.total).toBe(10);
      expect(result.max).toBe(10);
      expect(result.scoreGlobalPct).toBe(100);
      expect(result.weakDomainsCount).toBe(0);
      expect(result.domains).toHaveLength(1);
      expect(result.domains[0]).toEqual({
        domain: 'Maths',
        points: 10,
        max: 10,
        masteryPct: 100,
        note: 'Excellent',
      });
    });

    it('should correctly calculate scores for a single incorrect answer', () => {
        const answers: QcmAnswer[] = [
          { domain: 'Maths', isCorrect: false, points: 10, maxPoints: 10 },
        ];
        const result = calculateQcmScores(answers);
        expect(result.total).toBe(0);
        expect(result.max).toBe(10);
        expect(result.scoreGlobalPct).toBe(0);
        expect(result.weakDomainsCount).toBe(1);
        expect(result.domains[0].masteryPct).toBe(0);
        expect(result.domains[0].note).toBe('Lacunes importantes');
      });

    it('should aggregate scores for multiple answers in the same domain', () => {
      const answers: QcmAnswer[] = [
        { domain: 'Maths', isCorrect: true, points: 10, maxPoints: 10 },
        { domain: 'Maths', isCorrect: false, points: 5, maxPoints: 5 },
      ];
      const result = calculateQcmScores(answers);
      expect(result.total).toBe(10);
      expect(result.max).toBe(15);
      expect(result.scoreGlobalPct).toBeCloseTo(66.67);
      expect(result.weakDomainsCount).toBe(0);
      expect(result.domains[0].domain).toBe('Maths');
      expect(result.domains[0].masteryPct).toBeCloseTo(66.67);
      expect(result.domains[0].note).toBe('Solide');
    });

    it('should handle multiple domains and sort them by maxPoints', () => {
      const answers: QcmAnswer[] = [
        { domain: 'Français', isCorrect: true, points: 20, maxPoints: 20 },
        { domain: 'Maths', isCorrect: true, points: 4, maxPoints: 10 }, // 40% -> weak
        { domain: 'Histoire', isCorrect: true, points: 15, maxPoints: 15 },
      ];
      const result = calculateQcmScores(answers);
      expect(result.total).toBe(39);
      expect(result.max).toBe(45);
      expect(result.scoreGlobalPct).toBeCloseTo(86.67);
      expect(result.weakDomainsCount).toBe(1);
      
      // Check sorting (by max points descending)
      expect(result.domains[0].domain).toBe('Français');
      expect(result.domains[1].domain).toBe('Histoire');
      expect(result.domains[2].domain).toBe('Maths');

      // Check Maths domain (the weak one)
      expect(result.domains[2].masteryPct).toBe(40);
      expect(result.domains[2].note).toBe('A revoir');
    });

    it('should handle cases where maxPoints is zero to avoid division by zero', () => {
        const answers: QcmAnswer[] = [
          { domain: 'Bonus', isCorrect: true, points: 5, maxPoints: 0 },
        ];
        const result = calculateQcmScores(answers);
        expect(result.total).toBe(5);
        expect(result.max).toBe(0);
        expect(result.scoreGlobalPct).toBe(0);
        expect(result.domains[0].masteryPct).toBe(0);
      });
  });
});
