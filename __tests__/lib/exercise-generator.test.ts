/**
 * F37: Exercise generator tests
 * Validates procedural exercise generation for maths-1ere chapters
 */

import { GENERATORS, genSecondDegre, genDerivee, genSuiteArith, genProbaCond, genProduitScalaire, genTrigonometrie, genVariablesAleatoires, genExponentielle } from '@/app/programme/maths-1ere/lib/exercise-generator';

describe('F37: Exercise Generators', () => {
  describe('GENERATORS registry', () => {
    it('should have generators for all priority chapters', () => {
      // Core chapters from F37 fix
      expect(GENERATORS['second-degre']).toBeDefined();
      expect(GENERATORS['derivation']).toBeDefined();
      expect(GENERATORS['variations-courbes']).toBeDefined();
      expect(GENERATORS['suites']).toBeDefined();
      expect(GENERATORS['probabilites-cond']).toBeDefined();
      expect(GENERATORS['produit-scalaire']).toBeDefined();
      
      // New chapters added in F37
      expect(GENERATORS['trigonometrie']).toBeDefined();
      expect(GENERATORS['variables-aleatoires']).toBeDefined();
      expect(GENERATORS['exponentielle']).toBeDefined();
    });

    it('should generate exercises with required fields', () => {
      for (const [chapId, generator] of Object.entries(GENERATORS)) {
        const exercise = generator();
        expect(exercise).toHaveProperty('question');
        expect(exercise).toHaveProperty('reponse');
        expect(exercise).toHaveProperty('explication');
        expect(typeof exercise.question).toBe('string');
        expect(typeof exercise.explication).toBe('string');
      }
    });
  });

  describe('genTrigonometrie', () => {
    it('should generate valid trigonometry exercises', () => {
      const exercise = genTrigonometrie();
      expect(exercise.question).toMatch(/\$cos|sin\(/);
      expect(exercise.reponse).toBeDefined();
      expect(exercise.explication).toContain('Valeur remarquable');
    });

    it('should generate consistent angles', () => {
      const exercises = Array.from({ length: 20 }, () => genTrigonometrie());
      const validAngles = [0, 30, 45, 60, 90, 120, 135, 150, 180];
      for (const ex of exercises) {
        const match = ex.question.match(/(\d+)°/);
        if (match) {
          const angle = parseInt(match[1], 10);
          expect(validAngles).toContain(angle);
        }
      }
    });
  });

  describe('genVariablesAleatoires', () => {
    it('should generate valid expected value exercises', () => {
      const exercise = genVariablesAleatoires();
      expect(exercise.question).toContain('E(X)');
      expect(exercise.reponse).toBe(2.7); // 1*0.2 + 2*0.3 + 3*0.1 + 4*0.4 = 2.7
      expect(exercise.tolerance).toBe(0.01);
    });
  });

  describe('genExponentielle', () => {
    it('should generate valid exponentiation exercises', () => {
      const exercise = genExponentielle();
      expect(exercise.question).toMatch(/\$\d+\^\{?[\d-]+\}?/);
      expect(typeof exercise.reponse).toBe('number');
      expect(exercise.tolerance).toBe(0.001);
    });

    it('should generate reasonable exponents', () => {
      const exercises = Array.from({ length: 10 }, () => genExponentielle());
      for (const ex of exercises) {
        expect(ex.reponse).not.toBeNaN();
        expect(ex.reponse).not.toBe(Infinity);
        expect(ex.reponse).not.toBe(-Infinity);
      }
    });
  });

  describe('Generator determinism', () => {
    it('should produce consistent output structure with same seed sequence', () => {
      // Use a counter-based RNG to ensure variety and avoid infinite recursion
      let counter = 0;
      const seedRng = () => {
        counter++;
        return (counter * 0.13) % 1; // Deterministic sequence
      };
      const ex1 = genDerivee(seedRng);
      counter = 0; // Reset counter
      const ex2 = genDerivee(seedRng);
      expect(ex1.question).toBe(ex2.question);
      expect(ex1.reponse).toEqual(ex2.reponse);
    });
  });

  describe('Coverage improvement', () => {
    it('should have 9 generators total (6 original + 3 new)', () => {
      expect(Object.keys(GENERATORS).length).toBeGreaterThanOrEqual(9);
    });

    it('should cover all major domains', () => {
      const domains = {
        algebre: ['second-degre', 'suites'],
        analyse: ['derivation', 'variations-courbes', 'exponentielle'],
        probabilites: ['probabilites-cond', 'variables-aleatoires'],
        geometrie: ['produit-scalaire'],
        trigonometrie: ['trigonometrie'],
      };

      for (const [domain, chapters] of Object.entries(domains)) {
        for (const chap of chapters) {
          expect(GENERATORS[chap]).toBeDefined();
        }
      }
    });
  });
});
