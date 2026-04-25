import fs from 'fs';
import path from 'path';
import { QCM_BANK } from '@/lib/survival/qcm-bank';

describe('QCM_BANK survival', () => {
  it('distributes correct answers across A/B/C/D evenly', () => {
    const distribution = QCM_BANK.reduce(
      (acc, question) => ({ ...acc, [question.correctAnswer]: (acc[question.correctAnswer] ?? 0) + 1 }),
      {} as Record<string, number>,
    );

    ['A', 'B', 'C', 'D'].forEach((letter) => {
      expect(distribution[letter]).toBeGreaterThanOrEqual(4);
      expect(distribution[letter]).toBeLessThanOrEqual(8);
    });
  });

  it('every graphic question references an existing SVG asset', () => {
    const graphicQuestions = QCM_BANK.filter((question) => question.graphicAsset);
    expect(graphicQuestions.length).toBeGreaterThanOrEqual(6);
    graphicQuestions.forEach((question) => {
      expect(fs.existsSync(path.join(process.cwd(), 'public', question.graphicAsset!))).toBe(true);
    });
  });

  it('does not contain placeholder distractors', () => {
    const allChoices = QCM_BANK.flatMap((question) => question.choices.map((choice) => choice.text)).join(' ');
    expect(allChoices).not.toMatch(/piege|valeur correcte|autre reponse|fraction/i);
  });
});
