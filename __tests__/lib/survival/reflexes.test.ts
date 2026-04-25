import { PHRASES_MAGIQUES } from '@/lib/survival/phrases';
import { QCM_BANK } from '@/lib/survival/qcm-bank';
import { REFLEXES } from '@/lib/survival/reflexes';

describe('survival pedagogical payload', () => {
  it('exposes exactly 7 reflexes with three mini quiz items each', () => {
    expect(REFLEXES).toHaveLength(7);

    for (const reflex of REFLEXES) {
      expect(reflex.id).toMatch(/^reflex_[1-7]$/);
      expect(reflex.title).toBeTruthy();
      expect(reflex.hook).toBeTruthy();
      expect(reflex.magicPhraseId).toMatch(/^phrase_[1-8]$/);
      expect(reflex.miniQuiz).toHaveLength(3);
      expect(reflex.qcmPointsCovered).toBeGreaterThan(0);
    }
  });

  it('exposes exactly 8 phrases magiques with copy-ready blanks', () => {
    expect(PHRASES_MAGIQUES).toHaveLength(8);
    expect(PHRASES_MAGIQUES.every((phrase) => phrase.template.includes('___'))).toBe(true);
    expect(new Set(PHRASES_MAGIQUES.map((phrase) => phrase.id)).size).toBe(8);
  });

  it('contains the 24 sujet 0 QCM questions and links known accessible questions to reflexes', () => {
    expect(QCM_BANK).toHaveLength(24);
    expect(QCM_BANK.filter((question) => question.source === 'sujet_0_v1')).toHaveLength(12);
    expect(QCM_BANK.filter((question) => question.source === 'sujet_0_v2')).toHaveLength(12);

    const linkedGreenQuestions = QCM_BANK.filter(
      (question) => question.category === 'VERT' && question.reflexId,
    );
    expect(linkedGreenQuestions.length).toBeGreaterThanOrEqual(7);
  });
});
