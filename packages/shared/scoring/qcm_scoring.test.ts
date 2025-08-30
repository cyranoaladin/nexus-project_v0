import { calculateQcmScores, QcmAnswer } from './qcm_scoring';
import { QcmSummary } from '../types/bilan';

describe('calculateQcmScores', () => {
  it('should correctly aggregate and calculate scores from individual answers', () => {
    const mockAnswers: QcmAnswer[] = [
      // Algèbre: 8/10
      { domain: 'Algèbre', isCorrect: true, points: 5, maxPoints: 5 },
      { domain: 'Algèbre', isCorrect: true, points: 3, maxPoints: 5 },
      // Géométrie: 5/10
      { domain: 'Géométrie', isCorrect: true, points: 5, maxPoints: 5 },
      { domain: 'Géométrie', isCorrect: false, points: 5, maxPoints: 5 },
      // Analyse: 15/20
      { domain: 'Analyse', isCorrect: true, points: 10, maxPoints: 10 },
      { domain: 'Analyse', isCorrect: true, points: 5, maxPoints: 10 },
    ];

    const result: QcmSummary = calculateQcmScores(mockAnswers);

    // Test totaux
    expect(result.total).toBe(28);
    expect(result.max).toBe(40);
    expect(result.scoreGlobalPct).toBe(70);

    // Test domaines
    expect(result.domains).toHaveLength(3);
    const algebra = result.domains.find(d => d.domain === 'Algèbre');
    expect(algebra?.points).toBe(8);
    expect(algebra?.max).toBe(10);
    expect(algebra?.masteryPct).toBe(80);
    expect(algebra?.note).toBe('Bonne maîtrise');

    const geometry = result.domains.find(d => d.domain === 'Géométrie');
    expect(geometry?.points).toBe(5);
    expect(geometry?.max).toBe(10);
    expect(geometry?.masteryPct).toBe(50);
    expect(geometry?.note).toBe('Satisfaisant');

    // Test domaines faibles
    expect(result.weakDomainsCount).toBe(0); // 50% n'est pas considéré comme faible
  });

  it('should handle an empty array of answers', () => {
    const result = calculateQcmScores([]);
    expect(result.total).toBe(0);
    expect(result.max).toBe(0);
    expect(result.scoreGlobalPct).toBe(0);
    expect(result.domains).toHaveLength(0);
    expect(result.weakDomainsCount).toBe(0);
  });

  it('should correctly identify weak domains (mastery < 50%)', () => {
    const mockAnswers: QcmAnswer[] = [
      { domain: 'Logique', isCorrect: false, points: 10, maxPoints: 10 },
    ];
    const result = calculateQcmScores(mockAnswers);
    expect(result.weakDomainsCount).toBe(1);
    const logic = result.domains.find(d => d.domain === 'Logique');
    expect(logic?.masteryPct).toBe(0);
    expect(logic?.note).toBe('Lacunes importantes');
  });
});
