import {
  STAFF_LEAD_SEARCH_DEFAULT_LIMIT,
  STAFF_LEAD_SEARCH_MAX_LIMIT,
  devisLeadSearchSuccessSchema,
  planningStudentSearchRequestSchema,
  planningStudentSearchSuccessSchema,
  staffLeadSearchRequestSchema,
} from '@/lib/quotes/staff-directory-search-contracts';

describe('staff directory search response contracts', () => {
  test('governs one privacy-preserving lead limit contract', () => {
    expect(STAFF_LEAD_SEARCH_DEFAULT_LIMIT).toBe(10);
    expect(STAFF_LEAD_SEARCH_MAX_LIMIT).toBe(10);
    expect(staffLeadSearchRequestSchema.parse({ query: '  Sonia  ' })).toEqual({ query: 'Sonia', limit: 10 });
    expect(staffLeadSearchRequestSchema.parse({ query: 'Sonia', limit: 1 })).toEqual({ query: 'Sonia', limit: 1 });
    expect(staffLeadSearchRequestSchema.parse({ query: 'Sonia', limit: 10 })).toEqual({ query: 'Sonia', limit: 10 });
    for (const payload of [
      { query: 'Sonia', limit: 11 },
      { query: 'Sonia', limit: 0 },
      { query: 'Sonia', limit: 1.5 },
      { query: 'Sonia', limit: '3' },
      { query: 'Sonia', limit: 3, unknown: true },
    ]) expect(staffLeadSearchRequestSchema.safeParse(payload).success).toBe(false);
  });

  test('accepts only the quote lead fields used by DevisWorkspace', () => {
    const valid = { items: [{ id: 'contact-lead-001', name: 'Sonia Ben Salah', email: 'sonia@example.test', phone: '+21699000000' }] };
    expect(devisLeadSearchSuccessSchema.parse(valid)).toEqual(valid);
    expect(devisLeadSearchSuccessSchema.safeParse({ items: [{ ...valid.items[0], notes: 'secret' }] }).success).toBe(false);
    expect(devisLeadSearchSuccessSchema.safeParse({ items: [{ ...valid.items[0], status: 'NEW' }] }).success).toBe(false);
    expect(devisLeadSearchSuccessSchema.safeParse({ items: [{ ...valid.items[0], phone: 'x'.repeat(51) }] }).success).toBe(true);
    expect(devisLeadSearchSuccessSchema.safeParse({ items: [{ ...valid.items[0], phone: 'x'.repeat(501) }] }).success).toBe(false);
    expect(devisLeadSearchSuccessSchema.safeParse({ items: Array.from({ length: 11 }, () => valid.items[0]) }).success).toBe(false);
  });

  test('accepts only the three fields needed by stage planning', () => {
    const valid = { items: [{ userId: 'student-user-1', displayName: 'Yasmine Ben Salah', email: 'yasmine@example.test' }] };
    expect(planningStudentSearchSuccessSchema.parse(valid)).toEqual(valid);
    expect(planningStudentSearchSuccessSchema.safeParse({ items: [{ ...valid.items[0], studentId: 'private-profile-id' }] }).success).toBe(false);
    expect(planningStudentSearchSuccessSchema.safeParse({ items: [{ ...valid.items[0], creditBalance: 10 }] }).success).toBe(false);
  });

  test('requires a bounded non-empty planning query and rejects unknown keys', () => {
    expect(planningStudentSearchRequestSchema.parse({ query: '  Yas  ', page: 1, limit: 10 })).toEqual({ query: 'Yas', page: 1, limit: 10 });
    expect(planningStudentSearchRequestSchema.safeParse({ query: '', page: 1, limit: 10 }).success).toBe(false);
    expect(planningStudentSearchRequestSchema.safeParse({ query: 'Yas', page: 1, limit: 10, email: 'private@example.test' }).success).toBe(false);
  });
});
