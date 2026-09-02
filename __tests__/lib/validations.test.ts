import {
  bilanGratuitSchema,
  sessionBookingSchema,
  signinSchema
} from '@/lib/validations';
import { Subject } from '@prisma/client';

describe('Validation Schemas', () => {
  describe('bilanGratuitSchema', () => {
    const validData = {
      // Informations Parent
      parentFirstName: 'Jean',
      parentLastName: 'Dupont',
      parentEmail: 'jean.dupont@email.com',
      parentPhone: '0123456789',
      parentPassword: 'motdepasse123',

      // Informations Élève
      studentFirstName: 'Marie',
      studentLastName: 'Dupont',
      studentGrade: 'Terminale',
      studentSchool: 'Lycée Victor Hugo',
      studentBirthDate: '2005-06-15',

      // Besoins et objectifs
      subjects: ['MATHEMATIQUES'],
      currentLevel: 'Moyen',
      objectives: 'Améliorer les notes en mathématiques pour le baccalauréat',
      difficulties: 'Difficultés avec les équations du second degré',

      // Préférences
      preferredModality: 'hybride',
      availability: 'Mercredi après-midi et weekend',

      // Consentements
      acceptTerms: true,
      acceptNewsletter: false
    };

    it('should pass validation with valid data', () => {
      const result = bilanGratuitSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should pass validation without a parent password', () => {
      const { parentPassword, ...data } = validData;
      const result = bilanGratuitSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should fail validation with invalid parent email', () => {
      const invalidData = { ...validData, parentEmail: 'invalid-email' };
      const result = bilanGratuitSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Email invalide');
      }
    });

    it('should fail validation if password is less than 8 characters', () => {
      const invalidData = { ...validData, parentPassword: '1234567' };
      const result = bilanGratuitSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Le mot de passe doit contenir au moins 8 caractères');
      }
    });

    it('should fail validation with short parent firstName', () => {
      const invalidData = { ...validData, parentFirstName: 'J' };
      const result = bilanGratuitSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Le prénom doit contenir au moins 2 caractères');
      }
    });

    it('should fail validation with invalid phone number', () => {
      const invalidData = { ...validData, parentPhone: '123' };
      const result = bilanGratuitSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Numéro de téléphone invalide');
      }
    });

    // Décision responsable : les matières ne sont plus demandées à l'inscription.
    // Elles se choisissent après activation, dans le picker filtré par niveau —
    // les exiger ici faisait doublon et bloquait la conversion.
    it('accepte une liste de matières vide, et son absence totale', () => {
      expect(bilanGratuitSchema.safeParse({ ...validData, subjects: [] }).success).toBe(true);
      const { subjects: _omis, ...sansMatieres } = validData;
      expect(bilanGratuitSchema.safeParse(sansMatieres).success).toBe(true);
    });

    it('should fail validation with short objectives', () => {
      const invalidData = { ...validData, objectives: 'court' };
      const result = bilanGratuitSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Décrivez vos objectifs (minimum 10 caractères)');
      }
    });

    it('should fail validation if terms are not accepted', () => {
      const invalidData = { ...validData, acceptTerms: false };
      const result = bilanGratuitSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Vous devez accepter les conditions');
      }
    });
  });

  describe('signinSchema', () => {
    it('should pass validation with a valid email and password', () => {
      const validData = {
        email: 'test@example.com',
        password: 'SyntheticFixture!42'
      };
      const result = signinSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should fail validation with invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'SyntheticFixture!42'
      };
      const result = signinSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Email invalide');
      }
    });

    it('should fail validation with empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: ''
      };
      const result = signinSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Mot de passe requis');
      }
    });
  });

  describe('sessionBookingSchema', () => {
    const validSessionData = {
      coachId: 'coach-123',
      subject: 'MATHEMATIQUES' as Subject,
      type: 'COURS_ONLINE',
      scheduledAt: '2024-12-15T14:00:00.000Z',
      duration: 60,
      title: 'Cours de mathématiques',
      description: 'Révision des équations du second degré'
    };

    it('should pass validation with valid session data', () => {
      // Pour éviter l'échec lié à la règle des 2h, décale la date de test dans le futur
      const future = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const data = { ...validSessionData, scheduledAt: future };
      const result = sessionBookingSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should fail validation with invalid duration (too short)', () => {
      const invalidData = { ...validSessionData, duration: 15 };
      const result = sessionBookingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail validation with invalid duration (too long)', () => {
      const invalidData = { ...validSessionData, duration: 200 };
      const result = sessionBookingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail validation with empty title', () => {
      const invalidData = { ...validSessionData, title: '' };
      const result = sessionBookingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Titre requis');
      }
    });
  });

});
