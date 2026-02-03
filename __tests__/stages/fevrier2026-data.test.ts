import {
  academies,
  tiers,
  faq,
  stats,
  testimonials,
  deadlines,
  subjectsContent,
} from '@/data/stages/fevrier2026';

describe('Fevrier2026 Data Validation', () => {
  describe('Academies', () => {
    it('should have exactly 8 academies', () => {
      expect(academies).toHaveLength(8);
    });

    it('should have 4 terminale and 4 premiere academies', () => {
      const terminale = academies.filter(a => a.level === 'terminale');
      const premiere = academies.filter(a => a.level === 'premiere');
      expect(terminale).toHaveLength(4);
      expect(premiere).toHaveLength(4);
    });

    it('should have 4 pallier1 and 4 pallier2 academies', () => {
      const pallier1 = academies.filter(a => a.tier === 'pallier1');
      const pallier2 = academies.filter(a => a.tier === 'pallier2');
      expect(pallier1).toHaveLength(4);
      expect(pallier2).toHaveLength(4);
    });

    it('should have valid pricing (earlyBird < price)', () => {
      academies.forEach(academy => {
        expect(academy.earlyBirdPrice).toBeLessThan(academy.price);
        expect(academy.price).toBeGreaterThan(0);
      });
    });

    it('should have valid seat counts', () => {
      academies.forEach(academy => {
        expect(academy.seatsLeft).toBeGreaterThan(0);
        expect(academy.seatsLeft).toBeLessThanOrEqual(academy.groupSizeMax);
      });
    });

    it('should have required fields', () => {
      academies.forEach(academy => {
        expect(academy.id).toBeTruthy();
        expect(academy.title).toBeTruthy();
        expect(academy.badge).toBeTruthy();
        expect(academy.objective).toBeTruthy();
        expect(academy.promise).toBeTruthy();
        expect(academy.durationHours).toBeGreaterThan(0);
      });
    });
  });

  describe('Tiers', () => {
    it('should have exactly 2 tiers', () => {
      expect(tiers).toHaveLength(2);
    });

    it('should have pallier1 and pallier2', () => {
      const ids = tiers.map(t => t.id);
      expect(ids).toContain('pallier1');
      expect(ids).toContain('pallier2');
    });

    it('should have bullets and publicCible', () => {
      tiers.forEach(tier => {
        expect(tier.bullets.length).toBeGreaterThan(0);
        expect(tier.publicCible.length).toBeGreaterThan(0);
      });
    });
  });

  describe('FAQ', () => {
    it('should have at least 8 questions', () => {
      expect(faq.length).toBeGreaterThanOrEqual(8);
    });

    it('should have non-empty questions and answers', () => {
      faq.forEach(item => {
        expect(item.question).toBeTruthy();
        expect(item.answer).toBeTruthy();
        expect(item.question.length).toBeGreaterThan(10);
        expect(item.answer.length).toBeGreaterThan(20);
      });
    });

    it('should include key questions about candidats libres and epreuve pratique', () => {
      const questions = faq.map(f => f.question.toLowerCase());
      const hasCandidatsLibres = questions.some(q => q.includes('candidat'));
      const hasEpreuvePratique = questions.some(q => q.includes('épreuve pratique') || q.includes('grand oral'));
      expect(hasCandidatsLibres).toBe(true);
      expect(hasEpreuvePratique).toBe(true);
    });
  });

  describe('Stats', () => {
    it('should have 3 stats', () => {
      expect(stats).toHaveLength(3);
    });

    it('should have value and label for each stat', () => {
      stats.forEach(stat => {
        expect(stat.value).toBeTruthy();
        expect(stat.label).toBeTruthy();
      });
    });
  });

  describe('Testimonials', () => {
    it('should have at least 3 testimonials', () => {
      expect(testimonials.length).toBeGreaterThanOrEqual(3);
    });

    it('should have quote, author, and role', () => {
      testimonials.forEach(t => {
        expect(t.quote).toBeTruthy();
        expect(t.author).toBeTruthy();
        expect(t.role).toBeTruthy();
      });
    });
  });

  describe('Deadlines', () => {
    it('should have valid registration close date', () => {
      expect(deadlines.registrationCloseDate).toBe('2026-02-10');
    });

    it('should have valid early bird end date', () => {
      expect(deadlines.earlyBirdEndDate).toBeTruthy();
      const date = new Date(deadlines.earlyBirdEndDate);
      expect(date.toString()).not.toBe('Invalid Date');
    });
  });

  describe('Subjects Content', () => {
    it('should have maths and nsi', () => {
      const subjects = subjectsContent.map(s => s.subject);
      expect(subjects).toContain('maths');
      expect(subjects).toContain('nsi');
    });

    it('should have pallier1 and pallier2 content for each subject', () => {
      subjectsContent.forEach(subject => {
        expect(subject.pallier1.length).toBeGreaterThan(0);
        expect(subject.pallier2.length).toBeGreaterThan(0);
      });
    });
  });
});
