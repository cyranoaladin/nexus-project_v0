/**
 * Validations — Complete Test Suite
 *
 * Tests: bilanGratuitSchema, stageReservationSchema, signinSchema,
 *        sessionBookingSchema, ariaMessageSchema, ariaFeedbackSchema,
 *        bilanPallier2MathsSchema, bilanDiagnosticMathsSchema
 *
 * Source: lib/validations.ts
 */

import {
  bilanGratuitSchema,
  stageReservationSchema,
  signinSchema,
  sessionBookingSchema,
  ariaMessageSchema,
  ariaFeedbackSchema,
  bilanDiagnosticMathsSchema,
} from '@/lib/validations';

// ─── bilanGratuitSchema ──────────────────────────────────────────────────────

describe('bilanGratuitSchema', () => {
  const validData = {
    parentFirstName: 'Ahmed',
    parentLastName: 'Ben Ali',
    parentEmail: 'ahmed@test.com',
    parentPhone: '99192829',
    parentPassword: 'securepass123',
    studentFirstName: 'Sara',
    studentLastName: 'Ben Ali',
    studentGrade: 'terminale',
    subjects: ['MATHEMATIQUES'],
    currentLevel: 'moyen',
    acceptTerms: true,
  };

  it('should accept valid data', () => {
    expect(bilanGratuitSchema.safeParse(validData).success).toBe(true);
  });

  it('should reject missing parentEmail', () => {
    const { parentEmail, ...data } = validData;
    expect(bilanGratuitSchema.safeParse(data).success).toBe(false);
  });

  it('should reject invalid email', () => {
    expect(bilanGratuitSchema.safeParse({ ...validData, parentEmail: 'not-email' }).success).toBe(false);
  });

  it('should reject short password', () => {
    expect(bilanGratuitSchema.safeParse({ ...validData, parentPassword: '123' }).success).toBe(false);
  });

  it('should reject empty subjects array', () => {
    expect(bilanGratuitSchema.safeParse({ ...validData, subjects: [] }).success).toBe(false);
  });

  it('should reject acceptTerms = false', () => {
    expect(bilanGratuitSchema.safeParse({ ...validData, acceptTerms: false }).success).toBe(false);
  });

  it('should accept optional fields missing', () => {
    expect(bilanGratuitSchema.safeParse(validData).success).toBe(true);
  });

  it('should reject short first name', () => {
    expect(bilanGratuitSchema.safeParse({ ...validData, parentFirstName: 'A' }).success).toBe(false);
  });
});

// ─── stageReservationSchema ──────────────────────────────────────────────────

describe('stageReservationSchema', () => {
  const validData = {
    parent: 'Ahmed Ben Ali',
    email: 'ahmed@test.com',
    phone: '+216 99 19 28 29',
    classe: 'Terminale S',
    academyId: 'acad-1',
    academyTitle: 'Académie Intensive Maths',
    price: 750,
  };

  it('should accept valid data', () => {
    expect(stageReservationSchema.safeParse(validData).success).toBe(true);
  });

  it('should reject short parent name', () => {
    expect(stageReservationSchema.safeParse({ ...validData, parent: 'AB' }).success).toBe(false);
  });

  it('should reject invalid phone format', () => {
    expect(stageReservationSchema.safeParse({ ...validData, phone: 'abc' }).success).toBe(false);
  });

  it('should reject negative price', () => {
    expect(stageReservationSchema.safeParse({ ...validData, price: -10 }).success).toBe(false);
  });

  it('should reject price over 5000', () => {
    expect(stageReservationSchema.safeParse({ ...validData, price: 6000 }).success).toBe(false);
  });

  it('should accept valid phone formats', () => {
    expect(stageReservationSchema.safeParse({ ...validData, phone: '99192829' }).success).toBe(true);
    expect(stageReservationSchema.safeParse({ ...validData, phone: '+216-99-19-28-29' }).success).toBe(true);
  });
});

// ─── signinSchema ────────────────────────────────────────────────────────────

describe('signinSchema', () => {
  it('should accept valid credentials', () => {
    expect(signinSchema.safeParse({ email: 'test@test.com', password: 'pass' }).success).toBe(true);
  });

  it('should reject invalid email', () => {
    expect(signinSchema.safeParse({ email: 'not-email', password: 'pass' }).success).toBe(false);
  });

  it('should reject empty password', () => {
    expect(signinSchema.safeParse({ email: 'test@test.com', password: '' }).success).toBe(false);
  });
});

// ─── sessionBookingSchema ────────────────────────────────────────────────────

describe('sessionBookingSchema', () => {
  const futureDate = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4h from now

  const validData = {
    subject: 'MATHEMATIQUES',
    type: 'COURS_ONLINE',
    scheduledAt: futureDate,
    duration: 60,
    title: 'Session Maths',
  };

  it('should accept valid booking', () => {
    expect(sessionBookingSchema.safeParse(validData).success).toBe(true);
  });

  it('should reject duration < 30', () => {
    expect(sessionBookingSchema.safeParse({ ...validData, duration: 15 }).success).toBe(false);
  });

  it('should reject duration > 180', () => {
    expect(sessionBookingSchema.safeParse({ ...validData, duration: 200 }).success).toBe(false);
  });

  it('should reject empty title', () => {
    expect(sessionBookingSchema.safeParse({ ...validData, title: '' }).success).toBe(false);
  });

  it('should reject session scheduled less than 2 hours from now', () => {
    const tooSoon = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30min from now
    expect(sessionBookingSchema.safeParse({ ...validData, scheduledAt: tooSoon }).success).toBe(false);
  });

  it('should reject invalid subject', () => {
    expect(sessionBookingSchema.safeParse({ ...validData, subject: 'INVALID' }).success).toBe(false);
  });

  it('should reject invalid type', () => {
    expect(sessionBookingSchema.safeParse({ ...validData, type: 'INVALID' }).success).toBe(false);
  });
});

// ─── ariaMessageSchema ───────────────────────────────────────────────────────

describe('ariaMessageSchema', () => {
  it('should accept valid message', () => {
    expect(ariaMessageSchema.safeParse({
      subject: 'MATHEMATIQUES',
      content: 'Explain derivatives',
    }).success).toBe(true);
  });

  it('should accept with optional conversationId', () => {
    expect(ariaMessageSchema.safeParse({
      conversationId: 'conv-1',
      subject: 'NSI',
      content: 'What is recursion?',
    }).success).toBe(true);
  });

  it('should reject empty content', () => {
    expect(ariaMessageSchema.safeParse({
      subject: 'MATHEMATIQUES',
      content: '',
    }).success).toBe(false);
  });

  it('should reject content over 1000 chars', () => {
    expect(ariaMessageSchema.safeParse({
      subject: 'MATHEMATIQUES',
      content: 'x'.repeat(1001),
    }).success).toBe(false);
  });

  it('should reject invalid subject', () => {
    expect(ariaMessageSchema.safeParse({
      subject: 'INVALID',
      content: 'test',
    }).success).toBe(false);
  });
});

// ─── ariaFeedbackSchema ──────────────────────────────────────────────────────

describe('ariaFeedbackSchema', () => {
  it('should accept valid feedback', () => {
    expect(ariaFeedbackSchema.safeParse({ messageId: 'msg-1', feedback: true }).success).toBe(true);
  });

  it('should accept negative feedback', () => {
    expect(ariaFeedbackSchema.safeParse({ messageId: 'msg-1', feedback: false }).success).toBe(true);
  });

  it('should reject missing messageId', () => {
    expect(ariaFeedbackSchema.safeParse({ feedback: true }).success).toBe(false);
  });

  it('should reject missing feedback', () => {
    expect(ariaFeedbackSchema.safeParse({ messageId: 'msg-1' }).success).toBe(false);
  });
});

// ─── bilanDiagnosticMathsSchema ──────────────────────────────────────────────

describe('bilanDiagnosticMathsSchema', () => {
  const validData = {
    identity: {
      firstName: 'Ahmed',
      lastName: 'Ben Ali',
      email: 'ahmed@test.com',
      phone: '99192829',
    },
    schoolContext: {},
    performance: {},
    chapters: {},
    competencies: {},
    openQuestions: {},
    examPrep: {
      miniTest: { score: 4, timeUsedMinutes: 10, completedInTime: true },
      selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 2, justifications: 2, stress: 1 },
      signals: { hardestItems: [1, 3], verifiedAnswers: null },
    },
    methodology: {},
    ambition: {},
    freeText: {},
  };

  it('should accept valid diagnostic data', () => {
    expect(bilanDiagnosticMathsSchema.safeParse(validData).success).toBe(true);
  });

  it('should reject missing identity', () => {
    const { identity, ...data } = validData;
    expect(bilanDiagnosticMathsSchema.safeParse(data).success).toBe(false);
  });

  it('should reject invalid email in identity', () => {
    const data = { ...validData, identity: { ...validData.identity, email: 'not-email' } };
    expect(bilanDiagnosticMathsSchema.safeParse(data).success).toBe(false);
  });

  it('should reject miniTest score > 6', () => {
    const data = {
      ...validData,
      examPrep: {
        ...validData.examPrep,
        miniTest: { ...validData.examPrep.miniTest, score: 7 },
      },
    };
    expect(bilanDiagnosticMathsSchema.safeParse(data).success).toBe(false);
  });

  it('should reject selfRatings > 4', () => {
    const data = {
      ...validData,
      examPrep: {
        ...validData.examPrep,
        selfRatings: { ...validData.examPrep.selfRatings, stress: 5 },
      },
    };
    expect(bilanDiagnosticMathsSchema.safeParse(data).success).toBe(false);
  });

  it('should accept optional discipline and level', () => {
    const data = { ...validData, discipline: 'maths', level: 'terminale' };
    expect(bilanDiagnosticMathsSchema.safeParse(data).success).toBe(true);
  });

  it('should reject invalid discipline', () => {
    const data = { ...validData, discipline: 'invalid' };
    expect(bilanDiagnosticMathsSchema.safeParse(data).success).toBe(false);
  });

  it('should accept competencies with items', () => {
    const data = {
      ...validData,
      competencies: {
        algebra: [{
          skillId: 'sk-1',
          skillLabel: 'Equations',
          status: 'studied',
          mastery: 3,
          confidence: 2,
          friction: 1,
          errorTypes: ['calcul'],
          evidence: '',
        }],
      },
    };
    expect(bilanDiagnosticMathsSchema.safeParse(data).success).toBe(true);
  });

  it('should reject competency mastery > 4', () => {
    const data = {
      ...validData,
      competencies: {
        algebra: [{
          skillId: 'sk-1',
          skillLabel: 'Equations',
          status: 'studied',
          mastery: 5,
          confidence: 2,
          friction: 1,
          errorTypes: [],
          evidence: '',
        }],
      },
    };
    expect(bilanDiagnosticMathsSchema.safeParse(data).success).toBe(false);
  });
});
