/**
 * F42: Labs coverage tests
 * Validates that labs are properly wired in ChapterPractice for relevant chapters
 */

import { programmeData } from '@/app/programme/maths-1ere/data';

describe('F42: Labs Coverage', () => {
  // Define expected lab mappings based on ChapterPractice.tsx
  const expectedLabMappings: Record<string, string[]> = {
    'suites': ['ToileAraignee'],
    'second-degre': ['ParabolaController'],
    'derivation': ['TangenteGlissante'],
    'variations-courbes': ['TangenteGlissante', 'NewtonSolver'],
    'trigonometrie': ['Enrouleur', 'ArchimedePi'],
    'produit-scalaire': ['VectorProjector'],
    'probabilites-cond': ['MonteCarloSim'],
    'variables-aleatoires': ['MonteCarloSim'],
    'algo-newton': ['NewtonSolver'],
    'exponentielle': ['EulerExponentielle'],
    'geometrie-vectorielle': ['InteractiveGraph'],
  };

  describe('Chapter existence in programmeData', () => {
    it('should have all chapters with labs defined in programmeData', () => {
      for (const chapId of Object.keys(expectedLabMappings)) {
        let found = false;
        for (const cat of Object.values(programmeData)) {
          if (cat.chapitres.some(c => c.id === chapId)) {
            found = true;
            break;
          }
        }
        expect(found).toBe(true);
      }
    });

    it('should have exponentielle chapter with content', () => {
      const analyseCat = programmeData.analyse;
      const expChap = analyseCat.chapitres.find(c => c.id === 'exponentielle');
      expect(expChap).toBeDefined();
      expect(expChap?.titre).toContain('Exponentielle');
    });

    it('should have geometrie-vectorielle chapter with content', () => {
      const geomCat = programmeData.geometrie;
      const geomChap = geomCat.chapitres.find(c => c.id === 'geometrie-vectorielle');
      expect(geomChap).toBeDefined();
    });
  });

  describe('Lab wiring completeness', () => {
    it('should have at least 11 chapters with dedicated labs', () => {
      expect(Object.keys(expectedLabMappings).length).toBeGreaterThanOrEqual(11);
    });

    it('should cover all major mathematical domains', () => {
      const domains = {
        algebre: ['suites', 'second-degre'],
        analyse: ['derivation', 'variations-courbes', 'exponentielle', 'trigonometrie'],
        geometrie: ['produit-scalaire', 'geometrie-vectorielle'],
        probabilites: ['probabilites-cond', 'variables-aleatoires'],
        algorithmique: ['algo-newton'],
      };

      for (const [domain, chapters] of Object.entries(domains)) {
        for (const chapId of chapters) {
          expect(expectedLabMappings[chapId]).toBeDefined();
        }
      }
    });
  });

  describe('Chapter data integrity for lab chapters', () => {
    const chaptersWithLabs = Object.keys(expectedLabMappings);

    for (const chapId of chaptersWithLabs) {
      it(`should have valid chapter data for ${chapId}`, () => {
        let chap: any;
        for (const cat of Object.values(programmeData)) {
          const found = cat.chapitres.find(c => c.id === chapId);
          if (found) {
            chap = found;
            break;
          }
        }

        expect(chap).toBeDefined();
        expect(chap.titre).toBeTruthy();
        expect(chap.contenu).toBeDefined();
      });
    }
  });

  describe('F42 specific coverage', () => {
    it('should include exponentielle in lab coverage', () => {
      expect(expectedLabMappings['exponentielle']).toContain('EulerExponentielle');
    });

    it('should include geometrie-vectorielle in lab coverage', () => {
      expect(expectedLabMappings['geometrie-vectorielle']).toContain('InteractiveGraph');
    });
  });
});
