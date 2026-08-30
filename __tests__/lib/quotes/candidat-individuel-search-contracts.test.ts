import {
  CANDIDAT_INDIVIDUEL_SEARCH_ERROR_STATUS,
  candidatIndividuelLeadSearchRequestSchema,
  candidatIndividuelLeadSearchSuccessSchema,
  candidatIndividuelSearchErrorSchema,
  candidatIndividuelStudentSearchRequestSchema,
  candidatIndividuelStudentSearchSuccessSchema,
} from '@/lib/quotes/candidat-individuel-search-contracts';

const student = {
  studentId: 'student-profile-1',
  firstName: 'Yasmine',
  lastName: 'Ben Salah',
  email: 'yasmine@example.test',
  grade: 'Terminale',
  school: 'Lycee test',
  selectable: true,
  unavailableReason: null,
};

const lead = {
  contactLeadId: 'lead-1',
  name: 'Sonia Ben Salah',
  email: 'sonia@example.test',
};

describe('candidat individuel search contracts', () => {
  describe('student request', () => {
    test('accepts an empty browse query and trims a non-empty query', () => {
      expect(candidatIndividuelStudentSearchRequestSchema.parse({ query: '   ', page: 1, limit: 20 })).toEqual({
        query: '',
        page: 1,
        limit: 20,
      });
      expect(candidatIndividuelStudentSearchRequestSchema.parse({ query: '  Yasmine  ', page: 2, limit: 10 })).toEqual({
        query: 'Yasmine',
        page: 2,
        limit: 10,
      });
    });

    test.each([
      [{ query: 'a'.repeat(101), page: 1, limit: 20 }],
      [{ query: '', page: 0, limit: 20 }],
      [{ query: '', page: 10_001, limit: 20 }],
      [{ query: '', page: 1.5, limit: 20 }],
      [{ query: '', page: 1, limit: 0 }],
      [{ query: '', page: 1, limit: 51 }],
      [{ query: '', page: 1, limit: 1.5 }],
      [{ query: 42, page: 1, limit: 20 }],
      [{ query: '', page: '1', limit: 20 }],
      [{ query: '', page: 1, limit: '20' }],
      [{ query: '', page: 1, limit: 20, extra: true }],
    ])('rejects an invalid or non-strict request: %p', (payload) => {
      expect(candidatIndividuelStudentSearchRequestSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe('lead request', () => {
    test('trims queries between two and one hundred characters', () => {
      expect(candidatIndividuelLeadSearchRequestSchema.parse({ query: '  Sonia  ', limit: 10 })).toEqual({
        query: 'Sonia',
        limit: 10,
      });
    });

    test.each([
      [{ query: '' , limit: 10 }],
      [{ query: ' a ', limit: 10 }],
      [{ query: 'a'.repeat(101), limit: 10 }],
      [{ query: 'Sonia', limit: 0 }],
      [{ query: 'Sonia', limit: 51 }],
      [{ query: 'Sonia', limit: 1.5 }],
      [{ query: null, limit: 10 }],
      [{ query: 'Sonia', limit: '10' }],
      [{ query: 'Sonia', limit: 10, page: 1 }],
    ])('rejects an invalid or non-strict request: %p', (payload) => {
      expect(candidatIndividuelLeadSearchRequestSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe('minimal success DTOs', () => {
    test('accepts the exact student search response', () => {
      const response = {
        success: true,
        students: [student],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(candidatIndividuelStudentSearchSuccessSchema.parse(response)).toEqual(response);
    });

    test.each([
      ['coach data', { coachAssignments: [] }],
      ['credits', { credits: 10 }],
      ['credit balance', { creditBalance: 10 }],
      ['subscriptions', { subscriptions: [] }],
      ['counts', { _count: { sessions: 2 } }],
      ['activation flags', { activatedAt: '2026-08-30T00:00:00.000Z' }],
      ['student user id', { userId: 'student-user-1' }],
      ['responsible email', { responsibleEmail: 'parent@example.test' }],
      ['responsible user id', { responsibleUserId: 'parent-user-1' }],
      ['raw responsible data', { responsible: { name: 'Sonia' } }],
    ])('rejects forbidden student %s', (_label, forbidden) => {
      expect(candidatIndividuelStudentSearchSuccessSchema.safeParse({
        success: true,
        students: [{ ...student, ...forbidden }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }).success).toBe(false);
    });

    test('rejects unknown student response and pagination keys', () => {
      expect(candidatIndividuelStudentSearchSuccessSchema.safeParse({
        success: true,
        students: [student],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1, nextCursor: 'secret' },
      }).success).toBe(false);
      expect(candidatIndividuelStudentSearchSuccessSchema.safeParse({
        success: true,
        students: [student],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        debug: true,
      }).success).toBe(false);
    });

    test('accepts the exact lead response and rejects CRM-only fields', () => {
      const response = { success: true, leads: [lead] };
      expect(candidatIndividuelLeadSearchSuccessSchema.parse(response)).toEqual(response);

      for (const forbidden of [
        { phone: '+21600000000' },
        { status: 'NEW' },
        { notes: 'internal' },
        { userId: 'parent-user-1' },
        { activatedAt: '2026-08-30T00:00:00.000Z' },
        { creditBalance: 10 },
      ]) {
        expect(candidatIndividuelLeadSearchSuccessSchema.safeParse({
          success: true,
          leads: [{ ...lead, ...forbidden }],
        }).success).toBe(false);
      }
    });

    test('rejects malformed field types instead of coercing them', () => {
      expect(candidatIndividuelStudentSearchSuccessSchema.safeParse({
        success: true,
        students: [{ ...student, selectable: 'true' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }).success).toBe(false);
      expect(candidatIndividuelLeadSearchSuccessSchema.safeParse({
        success: true,
        leads: [{ ...lead, email: null }],
      }).success).toBe(false);
    });
  });

  describe('stable error envelope', () => {
    test.each([
      ['INVALID_REQUEST', 400],
      ['PIPELINE_INACTIVE', 409],
      ['RATE_LIMIT_EXCEEDED', 429],
      ['SEARCH_UNAVAILABLE', 500],
    ] as const)('accepts %s and binds it to HTTP %i', (code, status) => {
      expect(candidatIndividuelSearchErrorSchema.parse({ success: false, error: { code } })).toEqual({
        success: false,
        error: { code },
      });
      expect(CANDIDAT_INDIVIDUEL_SEARCH_ERROR_STATUS[code]).toBe(status);
    });

    test('rejects unstable codes, messages and debug metadata', () => {
      expect(candidatIndividuelSearchErrorSchema.safeParse({ success: false, error: { code: 'UNKNOWN' } }).success).toBe(false);
      expect(candidatIndividuelSearchErrorSchema.safeParse({
        success: false,
        error: { code: 'SEARCH_UNAVAILABLE', message: 'Prisma connection failed' },
      }).success).toBe(false);
      expect(candidatIndividuelSearchErrorSchema.safeParse({
        success: false,
        error: { code: 'INVALID_REQUEST' },
        stack: 'secret',
      }).success).toBe(false);
    });
  });
});
