import {
  ariaFeedbackSchema,
  ariaMessageSchema,
  bilanGratuitSchema,
  sessionBookingSchema,
  signinSchema,
} from '@/lib/validations';

describe('validations extra', () => {
  it('signin schema validates email/password', () => {
    expect(() => signinSchema.parse({ email: 'test@test.com', password: 'x' })).not.toThrow();
  });

  it('bilan gratuit requires at least one subject', () => {
    const data = {
      parentFirstName: 'A',
      parentLastName: 'B',
      parentEmail: 'parent@test.com',
      parentPhone: '12345678',
      parentPassword: 'password123',
      studentFirstName: 'C',
      studentLastName: 'D',
      studentGrade: 'Premiere',
      subjects: [],
      currentLevel: 'Moyen',
      objectives: 'Objectif assez long',
      preferredModality: 'online',
      acceptTerms: true,
    };
    expect(() => bilanGratuitSchema.parse(data)).toThrow();
  });

  it('session booking requires 2h lead time', () => {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const inThreeHours = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();

    const base = {
      subject: 'MATHEMATIQUES',
      type: 'COURS_ONLINE',
      duration: 60,
      title: 'Session',
    };

    expect(() =>
      sessionBookingSchema.parse({ ...base, scheduledAt: inOneHour })
    ).toThrow();

    expect(() =>
      sessionBookingSchema.parse({ ...base, scheduledAt: inThreeHours })
    ).not.toThrow();
  });

  it('aria message and feedback schemas validate', () => {
    expect(() =>
      ariaMessageSchema.parse({ subject: 'NSI', content: 'Bonjour' })
    ).not.toThrow();

    expect(() =>
      ariaFeedbackSchema.parse({ messageId: 'msg-1', feedback: true })
    ).not.toThrow();
  });
});
