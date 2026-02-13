import {
  createUserSchema,
  updateUserSchema,
  listUsersSchema,
  userIdParamSchema,
} from '@/lib/validation/users';
import { UserRole } from '@/types/enums';

describe('validation users', () => {
  it('validates createUserSchema', () => {
    const res = createUserSchema.safeParse({
      email: 'user@test.com',
      password: 'abc12345',
      role: UserRole.PARENT,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+33612345678',
    });
    expect(res.success).toBe(true);
  });

  it('validates updateUserSchema optional fields', () => {
    const res = updateUserSchema.safeParse({
      firstName: '',
      lastName: 'Smith',
      isActive: true,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.firstName).toBe('');
    }
  });

  it('validates listUsersSchema', () => {
    const res = listUsersSchema.safeParse({
      role: UserRole.ADMIN,
      isActive: 'true',
      limit: '10',
      offset: '0',
    });
    expect(res.success).toBe(true);
  });

  it('validates userIdParamSchema', () => {
    const res = userIdParamSchema.safeParse({
      id: 'ckx1a2b3c4d5e6f7g8h9i0j1',
    });
    expect(res.success).toBe(true);
  });
});
