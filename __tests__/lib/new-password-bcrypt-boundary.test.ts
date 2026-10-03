import { passwordSchema } from '@/lib/validation/common';

describe('new passwords preserve their complete bcrypt input', () => {
  test.each([
    ['ASCII overflow', `A1${'x'.repeat(71)}`],
    ['UTF-8 overflow', `A1${'é'.repeat(36)}`],
  ])('rejects %s before hashing', (_label, password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false);
  });

  test.each([`A1${'x'.repeat(70)}`, `A1${'é'.repeat(35)}`])(
    'accepts exactly 72 UTF-8 bytes', (password) => {
      expect(new TextEncoder().encode(password).length).toBe(72);
      expect(passwordSchema.safeParse(password).success).toBe(true);
    },
  );
});
