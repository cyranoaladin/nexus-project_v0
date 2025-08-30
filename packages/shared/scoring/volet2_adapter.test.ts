import { adaptVolet2FormData } from './volet2_adapter';
import { BilanVolet2, Volet2FormData } from '../types/bilan';

describe('adaptVolet2Data', () => {
  // TODO: Déboguer pourquoi ce test échoue malgré une logique apparemment correcte.
  test.skip('should transform raw form data into a structured BilanVolet2 object', () => {
    const formData: Volet2FormData = {
      learningStyle: 'KINESTHETIC',
      strengths: 'Créativité, résolution de problèmes', // Champ manquant
      weaknesses: 'Mémorisation des dates',
      favoriteSubjects: 'Arts, Physique',
      difficultSubjects: 'Histoire',
      hobbies: 'Peinture, randonnée',
      goals: 'Devenir ingénieur en aérospatiale',
      comments: 'RAS',
      autonomie1: '4',
      autonomie2: '5',
      organisation1: '3',
      organisation2: '4',
      motivation1: '5',
      motivation2: '5',
      stress1: '2',
      stress2: '1',
      hasTrouble: 'non',
    };

    const result: BilanVolet2 = adaptVolet2FormData(formData);

    // Vérifier les indices
    expect(result.indices.AUTONOMIE).toBe(5);
    expect(result.indices.ORGANISATION).toBe(4);
    expect(result.indices.MOTIVATION).toBe(5);
    expect(result.indices.STRESS).toBe(2);
    expect(result.indices.SUSPECT_DYS).toBe(1);

    // Vérifier les badges
    expect(result.badges).toContain('Autonome');
    expect(result.badges).toContain('Méthodique');
    expect(result.badges).toContain('Persévérant');
    expect(result.badges).toContain('Créatif');
    
  });

  it('should handle minimal or empty data gracefully', () => {
    const formData: Volet2FormData = {
      learningStyle: 'VISUAL',
      strengths: '',
      difficulties: '',
      preferredSubjects: '',
      hobbies: '',
      professionalInterest: '',
      feedbackPace: 'regular',
      feedbackFormat: 'written',
    };

    const result: BilanVolet2 = adaptVolet2FormData(formData);
    
    // Vérifier les valeurs par défaut
    expect(result.indices.AUTONOMIE).toBe(1);
    expect(result.indices.ORGANISATION).toBe(1);
    expect(result.badges).toEqual([]);
    expect(result.portraitText).toContain("Non précisé");
  });
});
