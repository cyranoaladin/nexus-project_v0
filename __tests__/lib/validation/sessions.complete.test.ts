/**
 * Session Validation Schemas — Complete Test Suite
 *
 * Tests: bookSessionSchema, createSessionSchema, updateSessionSchema,
 *        listSessionsSchema, cancelSessionSchema, bookFullSessionSchema
 *
 * Source: lib/validation/sessions.ts
 */

import {
  bookSessionSchema,
  createSessionSchema,
  updateSessionSchema,
  listSessionsSchema,
  cancelSessionSchema,
  bookFullSessionSchema,
} from '@/lib/validation/sessions';

// ─── bookSessionSchema ───────────────────────────────────────────────────────

describe('bookSessionSchema', () => {
  const validInput = {
    sessionId: 'clh1234567890abcdefghij',
    studentId: 'clh1234567890abcdefghij',
  };

  it('should accept valid input', () => {
    expect(bookSessionSchema.safeParse(validInput).success).toBe(true);
  });

  it('should accept with optional notes', () => {
    const result = bookSessionSchema.safeParse({ ...validInput, notes: 'Some notes' });
    expect(result.success).toBe(true);
  });

  it('should reject missing sessionId', () => {
    expect(bookSessionSchema.safeParse({ studentId: validInput.studentId }).success).toBe(false);
  });

  it('should reject missing studentId', () => {
    expect(bookSessionSchema.safeParse({ sessionId: validInput.sessionId }).success).toBe(false);
  });

  it('should reject invalid sessionId format', () => {
    expect(bookSessionSchema.safeParse({ ...validInput, sessionId: 'invalid' }).success).toBe(false);
  });

  it('should reject notes > 500 chars', () => {
    expect(bookSessionSchema.safeParse({ ...validInput, notes: 'a'.repeat(501) }).success).toBe(false);
  });

  it('should trim notes whitespace', () => {
    const result = bookSessionSchema.safeParse({ ...validInput, notes: '  trimmed  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notes).toBe('trimmed');
  });
});

// ─── createSessionSchema ─────────────────────────────────────────────────────

describe('createSessionSchema', () => {
  const validInput = {
    coachId: 'clh1234567890abcdefghij',
    subject: 'Mathématiques',
    scheduledAt: '2026-06-15T14:00:00Z',
    duration: 60,
  };

  it('should accept valid input', () => {
    expect(createSessionSchema.safeParse(validInput).success).toBe(true);
  });

  it('should accept with all optional fields', () => {
    const result = createSessionSchema.safeParse({
      ...validInput,
      description: 'Session description',
      maxStudents: 5,
      location: 'Room A',
      onlineLink: 'https://meet.example.com/abc',
    });
    expect(result.success).toBe(true);
  });

  it('should default maxStudents to 1', () => {
    const result = createSessionSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.maxStudents).toBe(1);
  });

  it('should reject missing coachId', () => {
    const { coachId, ...rest } = validInput;
    expect(createSessionSchema.safeParse(rest).success).toBe(false);
  });

  it('should reject missing subject', () => {
    const { subject, ...rest } = validInput;
    expect(createSessionSchema.safeParse(rest).success).toBe(false);
  });

  it('should reject empty subject', () => {
    expect(createSessionSchema.safeParse({ ...validInput, subject: '' }).success).toBe(false);
  });

  it('should reject duration < 30', () => {
    expect(createSessionSchema.safeParse({ ...validInput, duration: 15 }).success).toBe(false);
  });

  it('should reject duration > 480', () => {
    expect(createSessionSchema.safeParse({ ...validInput, duration: 500 }).success).toBe(false);
  });

  it('should reject non-integer duration', () => {
    expect(createSessionSchema.safeParse({ ...validInput, duration: 60.5 }).success).toBe(false);
  });

  it('should reject maxStudents > 20', () => {
    expect(createSessionSchema.safeParse({ ...validInput, maxStudents: 25 }).success).toBe(false);
  });

  it('should reject maxStudents < 1', () => {
    expect(createSessionSchema.safeParse({ ...validInput, maxStudents: 0 }).success).toBe(false);
  });

  it('should reject invalid onlineLink URL', () => {
    expect(createSessionSchema.safeParse({ ...validInput, onlineLink: 'not-a-url' }).success).toBe(false);
  });

  it('should coerce scheduledAt string to Date', () => {
    const result = createSessionSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.scheduledAt).toBeInstanceOf(Date);
  });
});

// ─── updateSessionSchema ─────────────────────────────────────────────────────

describe('updateSessionSchema', () => {
  it('should accept partial updates', () => {
    expect(updateSessionSchema.safeParse({ duration: 90 }).success).toBe(true);
    expect(updateSessionSchema.safeParse({ subject: 'NSI' }).success).toBe(true);
  });

  it('should accept empty object', () => {
    expect(updateSessionSchema.safeParse({}).success).toBe(true);
  });

  it('should still validate field constraints', () => {
    expect(updateSessionSchema.safeParse({ duration: 10 }).success).toBe(false);
    expect(updateSessionSchema.safeParse({ maxStudents: 50 }).success).toBe(false);
  });
});

// ─── listSessionsSchema ──────────────────────────────────────────────────────

describe('listSessionsSchema', () => {
  it('should accept empty filters', () => {
    expect(listSessionsSchema.safeParse({}).success).toBe(true);
  });

  it('should accept valid status filter', () => {
    expect(listSessionsSchema.safeParse({ status: 'SCHEDULED' }).success).toBe(true);
    expect(listSessionsSchema.safeParse({ status: 'COMPLETED' }).success).toBe(true);
    expect(listSessionsSchema.safeParse({ status: 'CANCELLED' }).success).toBe(true);
  });

  it('should reject invalid status', () => {
    expect(listSessionsSchema.safeParse({ status: 'PENDING' }).success).toBe(false);
  });

  it('should accept date range filters', () => {
    const result = listSessionsSchema.safeParse({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(result.success).toBe(true);
  });

  it('should accept coachId filter', () => {
    expect(listSessionsSchema.safeParse({ coachId: 'clh1234567890abcdefghij' }).success).toBe(true);
  });

  it('should reject invalid coachId', () => {
    expect(listSessionsSchema.safeParse({ coachId: 'invalid' }).success).toBe(false);
  });
});

// ─── cancelSessionSchema ─────────────────────────────────────────────────────

describe('cancelSessionSchema', () => {
  const validInput = {
    sessionId: 'clh1234567890abcdefghij',
    reason: 'Schedule conflict',
  };

  it('should accept valid input', () => {
    expect(cancelSessionSchema.safeParse(validInput).success).toBe(true);
  });

  it('should reject missing reason', () => {
    expect(cancelSessionSchema.safeParse({ sessionId: validInput.sessionId }).success).toBe(false);
  });

  it('should reject empty reason', () => {
    expect(cancelSessionSchema.safeParse({ ...validInput, reason: '' }).success).toBe(false);
  });

  it('should reject reason > 500 chars', () => {
    expect(cancelSessionSchema.safeParse({ ...validInput, reason: 'a'.repeat(501) }).success).toBe(false);
  });

  it('should reject invalid sessionId', () => {
    expect(cancelSessionSchema.safeParse({ ...validInput, sessionId: 'bad-id' }).success).toBe(false);
  });

  it('should trim reason whitespace', () => {
    const result = cancelSessionSchema.safeParse({ ...validInput, reason: '  trimmed reason  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reason).toBe('trimmed reason');
  });
});

// ─── bookFullSessionSchema ───────────────────────────────────────────────────

describe('bookFullSessionSchema', () => {
  // Use a future date to avoid "past date" rejection
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const validInput = {
    coachId: 'clh1234567890abcdefghij',
    studentId: 'clh1234567890abcdefghij',
    subject: 'MATHEMATIQUES' as const,
    scheduledDate: futureDate,
    startTime: '14:00',
    endTime: '15:00',
    duration: 60,
    title: 'Cours de maths',
    creditsToUse: 1,
  };

  it('should accept valid input', () => {
    expect(bookFullSessionSchema.safeParse(validInput).success).toBe(true);
  });

  it('should default type to INDIVIDUAL', () => {
    const result = bookFullSessionSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('INDIVIDUAL');
  });

  it('should default modality to ONLINE', () => {
    const result = bookFullSessionSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.modality).toBe('ONLINE');
  });

  it('should accept all valid subjects', () => {
    const subjects = ['MATHEMATIQUES', 'NSI', 'FRANCAIS', 'PHILOSOPHIE', 'HISTOIRE_GEO', 'ANGLAIS', 'ESPAGNOL', 'PHYSIQUE_CHIMIE', 'SVT', 'SES'];
    subjects.forEach((subject) => {
      const result = bookFullSessionSchema.safeParse({ ...validInput, subject });
      expect(result.success).toBe(true);
    });
  });

  it('should reject invalid subject', () => {
    expect(bookFullSessionSchema.safeParse({ ...validInput, subject: 'INVALID' }).success).toBe(false);
  });

  it('should reject past date', () => {
    expect(bookFullSessionSchema.safeParse({ ...validInput, scheduledDate: '2020-01-01' }).success).toBe(false);
  });

  it('should reject invalid time format', () => {
    expect(bookFullSessionSchema.safeParse({ ...validInput, startTime: '25:00' }).success).toBe(false);
    expect(bookFullSessionSchema.safeParse({ ...validInput, startTime: 'abc' }).success).toBe(false);
  });

  it('should reject endTime before startTime', () => {
    expect(bookFullSessionSchema.safeParse({ ...validInput, startTime: '15:00', endTime: '14:00', duration: 60 }).success).toBe(false);
  });

  it('should reject duration mismatch with time range', () => {
    expect(bookFullSessionSchema.safeParse({ ...validInput, duration: 90 }).success).toBe(false);
  });

  it('should reject duration < 30', () => {
    expect(bookFullSessionSchema.safeParse({ ...validInput, startTime: '14:00', endTime: '14:15', duration: 15 }).success).toBe(false);
  });

  it('should reject duration > 180', () => {
    expect(bookFullSessionSchema.safeParse({ ...validInput, startTime: '10:00', endTime: '14:00', duration: 240 }).success).toBe(false);
  });

  it('should reject creditsToUse > 10', () => {
    expect(bookFullSessionSchema.safeParse({ ...validInput, creditsToUse: 11 }).success).toBe(false);
  });

  it('should reject creditsToUse < 1', () => {
    expect(bookFullSessionSchema.safeParse({ ...validInput, creditsToUse: 0 }).success).toBe(false);
  });

  it('should reject title > 100 chars', () => {
    expect(bookFullSessionSchema.safeParse({ ...validInput, title: 'a'.repeat(101) }).success).toBe(false);
  });

  it('should reject empty title', () => {
    expect(bookFullSessionSchema.safeParse({ ...validInput, title: '' }).success).toBe(false);
  });

  it('should reject description > 500 chars', () => {
    expect(bookFullSessionSchema.safeParse({ ...validInput, description: 'a'.repeat(501) }).success).toBe(false);
  });

  it('should accept all session types', () => {
    ['INDIVIDUAL', 'GROUP', 'MASTERCLASS'].forEach((type) => {
      const result = bookFullSessionSchema.safeParse({ ...validInput, type });
      expect(result.success).toBe(true);
    });
  });

  it('should accept all modalities', () => {
    ['ONLINE', 'IN_PERSON', 'HYBRID'].forEach((modality) => {
      const result = bookFullSessionSchema.safeParse({ ...validInput, modality });
      expect(result.success).toBe(true);
    });
  });
});
