/**
 * User Validation Schemas — Complete Test Suite
 *
 * Tests: createUserSchema, updateUserSchema, listUsersSchema, userIdParamSchema
 *
 * Source: lib/validation/users.ts + lib/validation/common.ts
 */

import { createUserSchema, updateUserSchema, listUsersSchema, userIdParamSchema } from '@/lib/validation/users';

// ─── createUserSchema ────────────────────────────────────────────────────────

describe('createUserSchema', () => {
  const validUser = {
    email: 'test@example.com',
    password: 'Password1',
    role: 'ADMIN',
    firstName: 'John',
    lastName: 'Doe',
  };

  it('should accept a valid user creation payload', () => {
    const result = createUserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });

  it('should reject missing email', () => {
    const { email, ...noEmail } = validUser;
    const result = createUserSchema.safeParse(noEmail);
    expect(result.success).toBe(false);
  });

  it('should reject invalid email format', () => {
    const result = createUserSchema.safeParse({ ...validUser, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('should lowercase the email', () => {
    const result = createUserSchema.safeParse({ ...validUser, email: 'Test@EXAMPLE.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
    }
  });

  it('should reject password shorter than 8 characters', () => {
    const result = createUserSchema.safeParse({ ...validUser, password: 'Pass1' });
    expect(result.success).toBe(false);
  });

  it('should reject password without letters', () => {
    const result = createUserSchema.safeParse({ ...validUser, password: '12345678' });
    expect(result.success).toBe(false);
  });

  it('should reject password without numbers', () => {
    const result = createUserSchema.safeParse({ ...validUser, password: 'PasswordOnly' });
    expect(result.success).toBe(false);
  });

  it('should accept valid password with letters and numbers', () => {
    const result = createUserSchema.safeParse({ ...validUser, password: 'MyPass123' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid role', () => {
    const result = createUserSchema.safeParse({ ...validUser, role: 'SUPERADMIN' });
    expect(result.success).toBe(false);
  });

  it('should accept all valid roles', () => {
    const roles = ['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'];
    roles.forEach((role) => {
      const result = createUserSchema.safeParse({ ...validUser, role });
      expect(result.success).toBe(true);
    });
  });

  it('should reject empty firstName', () => {
    const result = createUserSchema.safeParse({ ...validUser, firstName: '' });
    expect(result.success).toBe(false);
  });

  it('should reject empty lastName', () => {
    const result = createUserSchema.safeParse({ ...validUser, lastName: '' });
    expect(result.success).toBe(false);
  });

  it('should trim whitespace from firstName', () => {
    const result = createUserSchema.safeParse({ ...validUser, firstName: '  John  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe('John');
    }
  });

  it('should accept optional phone in international format', () => {
    const result = createUserSchema.safeParse({ ...validUser, phone: '+21612345678' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid phone format', () => {
    const result = createUserSchema.safeParse({ ...validUser, phone: 'not-a-phone' });
    expect(result.success).toBe(false);
  });

  it('should accept payload without phone (optional)', () => {
    const result = createUserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });
});

// ─── updateUserSchema ────────────────────────────────────────────────────────

describe('updateUserSchema', () => {
  it('should accept empty object (all fields optional)', () => {
    const result = updateUserSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept partial update with only email', () => {
    const result = updateUserSchema.safeParse({ email: 'new@example.com' });
    expect(result.success).toBe(true);
  });

  it('should accept partial update with only role', () => {
    const result = updateUserSchema.safeParse({ role: 'COACH' });
    expect(result.success).toBe(true);
  });

  it('should accept isActive boolean', () => {
    const result = updateUserSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email in update', () => {
    const result = updateUserSchema.safeParse({ email: 'bad-email' });
    expect(result.success).toBe(false);
  });

  it('should reject short password in update', () => {
    const result = updateUserSchema.safeParse({ password: 'short' });
    expect(result.success).toBe(false);
  });

  it('should accept valid password in update', () => {
    const result = updateUserSchema.safeParse({ password: 'NewPass123' });
    expect(result.success).toBe(true);
  });
});

// ─── listUsersSchema ─────────────────────────────────────────────────────────

describe('listUsersSchema', () => {
  it('should accept empty query (all defaults)', () => {
    const result = listUsersSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept role filter', () => {
    const result = listUsersSchema.safeParse({ role: 'ELEVE' });
    expect(result.success).toBe(true);
  });

  it('should accept search string', () => {
    const result = listUsersSchema.safeParse({ search: 'john' });
    expect(result.success).toBe(true);
  });

  it('should reject search string > 200 chars', () => {
    const result = listUsersSchema.safeParse({ search: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('should coerce page to number', () => {
    const result = listUsersSchema.safeParse({ page: '3' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
    }
  });

  it('should reject page < 1', () => {
    const result = listUsersSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });
});

// ─── userIdParamSchema ───────────────────────────────────────────────────────

describe('userIdParamSchema', () => {
  it('should accept valid CUID', () => {
    const result = userIdParamSchema.safeParse({ id: 'clh1234567890abcdefghij' });
    expect(result.success).toBe(true);
  });

  it('should reject empty string', () => {
    const result = userIdParamSchema.safeParse({ id: '' });
    expect(result.success).toBe(false);
  });

  it('should reject non-CUID format', () => {
    const result = userIdParamSchema.safeParse({ id: 'not-a-cuid' });
    expect(result.success).toBe(false);
  });

  it('should reject missing id', () => {
    const result = userIdParamSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
