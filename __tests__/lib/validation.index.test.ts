import { idSchema, createUserSchema } from '@/lib/validation';
import { UserRole } from '@/types/enums';

describe('validation index re-exports', () => {
  it('exposes common schemas', () => {
    expect(idSchema.safeParse('ckx1a2b3c4d5e6f7g8h9i0j1').success).toBe(true);
  });

  it('exposes user schemas', () => {
    const res = createUserSchema.safeParse({
      email: 'user@test.com',
      password: 'abc12345',
      role: UserRole.ADMIN,
      firstName: 'Admin',
      lastName: 'User',
      phone: '+33612345678',
    });
    expect(res.success).toBe(true);
  });
});
