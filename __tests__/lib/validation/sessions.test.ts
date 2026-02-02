/**
 * Unit Tests - Session Validation Schemas
 *
 * Tests Zod validation logic for session-related schemas.
 */

import {
  bookFullSessionSchema,
  cancelSessionSchema,
  createSessionSchema
} from '@/lib/validation/sessions';
import { ZodError } from 'zod';

describe('Session Validation Schemas', () => {
  describe('bookFullSessionSchema', () => {
    const validInput = {
      coachId: 'cm4abc123def456ghi789jkl',
      studentId: 'cm4xyz789abc456def123ghi',
      subject: 'MATHEMATIQUES',
      scheduledDate: '2026-03-15',
      startTime: '14:00',
      endTime: '15:00',
      duration: 60,
      type: 'INDIVIDUAL',
      modality: 'ONLINE',
      title: 'Math tutoring session',
      description: 'Algebra review',
      creditsToUse: 1
    };

    it('should validate correct input', () => {
      expect(() => bookFullSessionSchema.parse(validInput)).not.toThrow();
      const result = bookFullSessionSchema.parse(validInput);
      expect(result.coachId).toBe('cm4abc123def456ghi789jkl');
      expect(result.subject).toBe('MATHEMATIQUES');
    });

    it('should use default values for optional fields', () => {
      const minimalInput = {
        coachId: 'cm4abc123def456ghi789jkl',
        studentId: 'cm4xyz789abc456def123ghi',
        subject: 'MATHEMATIQUES',
        scheduledDate: '2026-03-15',
        startTime: '14:00',
        endTime: '15:00',
        duration: 60,
        title: 'Test session',
        creditsToUse: 1
      };

      const result = bookFullSessionSchema.parse(minimalInput);
      expect(result.type).toBe('INDIVIDUAL'); // default
      expect(result.modality).toBe('ONLINE'); // default
    });

    it('should reject past dates', () => {
      const pastDate = { ...validInput, scheduledDate: '2020-01-01' };
      expect(() => bookFullSessionSchema.parse(pastDate)).toThrow(ZodError);
    });

    it('should reject missing required fields', () => {
      const missingCoach = { ...validInput };
      delete (missingCoach as any).coachId;
      expect(() => bookFullSessionSchema.parse(missingCoach)).toThrow(ZodError);
    });

    it('should reject invalid subject', () => {
      const invalidSubject = { ...validInput, subject: 'INVALID_SUBJECT' };
      expect(() => bookFullSessionSchema.parse(invalidSubject)).toThrow(ZodError);
    });

    it('should reject invalid time format', () => {
      const invalidTime = { ...validInput, startTime: '25:00' };
      expect(() => bookFullSessionSchema.parse(invalidTime)).toThrow(ZodError);

      const invalidFormat = { ...validInput, startTime: '2pm' };
      expect(() => bookFullSessionSchema.parse(invalidFormat)).toThrow(ZodError);
    });

    it('should reject endTime before startTime', () => {
      const invalidTimes = {
        ...validInput,
        startTime: '15:00',
        endTime: '14:00'
      };
      expect(() => bookFullSessionSchema.parse(invalidTimes)).toThrow(ZodError);
    });

    it('should reject duration mismatch', () => {
      const mismatch = {
        ...validInput,
        startTime: '14:00',
        endTime: '15:00',
        duration: 90 // Should be 60
      };
      expect(() => bookFullSessionSchema.parse(mismatch)).toThrow(ZodError);
    });

    it('should reject duration < 30 minutes', () => {
      const tooShort = {
        ...validInput,
        startTime: '14:00',
        endTime: '14:15',
        duration: 15
      };
      expect(() => bookFullSessionSchema.parse(tooShort)).toThrow(ZodError);
    });

    it('should reject duration > 180 minutes', () => {
      const tooLong = {
        ...validInput,
        duration: 200
      };
      expect(() => bookFullSessionSchema.parse(tooLong)).toThrow(ZodError);
    });

    it('should reject title too long', () => {
      const longTitle = {
        ...validInput,
        title: 'A'.repeat(101)
      };
      expect(() => bookFullSessionSchema.parse(longTitle)).toThrow(ZodError);
    });

    it('should reject description too long', () => {
      const longDescription = {
        ...validInput,
        description: 'A'.repeat(501)
      };
      expect(() => bookFullSessionSchema.parse(longDescription)).toThrow(ZodError);
    });

    it('should reject creditsToUse < 1', () => {
      const zeroCredits = { ...validInput, creditsToUse: 0 };
      expect(() => bookFullSessionSchema.parse(zeroCredits)).toThrow(ZodError);
    });

    it('should reject creditsToUse > 10', () => {
      const tooManyCredits = { ...validInput, creditsToUse: 11 };
      expect(() => bookFullSessionSchema.parse(tooManyCredits)).toThrow(ZodError);
    });

    it('should accept valid edge case: 30 min duration', () => {
      const minDuration = {
        ...validInput,
        startTime: '14:00',
        endTime: '14:30',
        duration: 30
      };
      expect(() => bookFullSessionSchema.parse(minDuration)).not.toThrow();
    });

    it('should accept valid edge case: 180 min duration', () => {
      const maxDuration = {
        ...validInput,
        startTime: '14:00',
        endTime: '17:00',
        duration: 180
      };
      expect(() => bookFullSessionSchema.parse(maxDuration)).not.toThrow();
    });

    it('should accept all valid subjects', () => {
      const subjects = [
        'MATHEMATIQUES',
        'NSI',
        'FRANCAIS',
        'PHILOSOPHIE',
        'HISTOIRE_GEO',
        'ANGLAIS',
        'ESPAGNOL',
        'PHYSIQUE_CHIMIE',
        'SVT',
        'SES'
      ];

      subjects.forEach(subject => {
        const input = { ...validInput, subject };
        expect(() => bookFullSessionSchema.parse(input)).not.toThrow();
      });
    });

    it('should accept all valid types', () => {
      const types = ['INDIVIDUAL', 'GROUP', 'MASTERCLASS'];
      types.forEach(type => {
        const input = { ...validInput, type };
        expect(() => bookFullSessionSchema.parse(input)).not.toThrow();
      });
    });

    it('should accept all valid modalities', () => {
      const modalities = ['ONLINE', 'IN_PERSON', 'HYBRID'];
      modalities.forEach(modality => {
        const input = { ...validInput, modality };
        expect(() => bookFullSessionSchema.parse(input)).not.toThrow();
      });
    });
  });

  describe('cancelSessionSchema', () => {
    const validSessionId = 'cm4abc123def456ghi789jkl';

    it('should validate correct cancellation reason', () => {
      const validInput = {
        sessionId: validSessionId,
        reason: 'Student is sick'
      };
      expect(() => cancelSessionSchema.parse(validInput)).not.toThrow();
    });

    it('should reject empty reason', () => {
      const emptyReason = { sessionId: validSessionId, reason: '' };
      expect(() => cancelSessionSchema.parse(emptyReason)).toThrow(ZodError);
    });

    it('should reject missing reason', () => {
      expect(() => cancelSessionSchema.parse({ sessionId: validSessionId })).toThrow(ZodError);
    });

    it('should reject reason too long', () => {
      const longReason = { sessionId: validSessionId, reason: 'A'.repeat(501) };
      expect(() => cancelSessionSchema.parse(longReason)).toThrow(ZodError);
    });

    it('should trim whitespace from reason', () => {
      const input = { sessionId: validSessionId, reason: '  Valid reason  ' };
      const result = cancelSessionSchema.parse(input);
      expect(result.reason).toBe('Valid reason');
    });

    it('should accept reason at max length', () => {
      const maxLength = { sessionId: validSessionId, reason: 'A'.repeat(500) };
      expect(() => cancelSessionSchema.parse(maxLength)).not.toThrow();
    });
  });

  describe('createSessionSchema', () => {
    const validInput = {
      coachId: 'cm4abc123def456ghi789jkl',
      subject: 'Mathematics',
      scheduledAt: new Date('2026-03-15T14:00:00'),
      duration: 60
    };

    it('should validate correct input with defaults', () => {
      expect(() => createSessionSchema.parse(validInput)).not.toThrow();
      const result = createSessionSchema.parse(validInput);
      expect(result.maxStudents).toBe(1); // default value
    });

    it('should accept optional fields', () => {
      const fullInput = {
        ...validInput,
        description: 'Advanced calculus',
        maxStudents: 5,
        location: 'Room 101',
        onlineLink: 'https://meet.google.com/abc-defg-hij'
      };
      expect(() => createSessionSchema.parse(fullInput)).not.toThrow();
    });

    it('should reject invalid duration', () => {
      const invalidDuration = { ...validInput, duration: 20 }; // < 30
      expect(() => createSessionSchema.parse(invalidDuration)).toThrow(ZodError);
    });

    it('should reject duration > 480 minutes', () => {
      const tooLong = { ...validInput, duration: 500 };
      expect(() => createSessionSchema.parse(tooLong)).toThrow(ZodError);
    });

    it('should reject maxStudents < 1', () => {
      const invalid = { ...validInput, maxStudents: 0 };
      expect(() => createSessionSchema.parse(invalid)).toThrow(ZodError);
    });

    it('should reject maxStudents > 20', () => {
      const invalid = { ...validInput, maxStudents: 21 };
      expect(() => createSessionSchema.parse(invalid)).toThrow(ZodError);
    });

    it('should reject invalid URL for onlineLink', () => {
      const invalid = { ...validInput, onlineLink: 'not-a-url' };
      expect(() => createSessionSchema.parse(invalid)).toThrow(ZodError);
    });

    it('should coerce string date to Date object', () => {
      const stringDate = {
        ...validInput,
        scheduledAt: '2026-03-15T14:00:00'
      };
      const result = createSessionSchema.parse(stringDate);
      expect(result.scheduledAt).toBeInstanceOf(Date);
    });
  });
});
