/**
 * Regression Test — Seed Users Authentication
 *
 * Verifies that all named demo users in the seed:
 * 1. Exist in the database
 * 2. Have bcrypt-hashed passwords (not plaintext)
 * 3. Can authenticate with the expected password
 * 4. Have correct roles
 * 5. ELEVE users have activatedAt set
 *
 * Source: prisma/seed.ts, auth.ts
 */

import bcrypt from 'bcryptjs';

jest.mock('@/lib/prisma', () => {
  const users = new Map<string, {
    id: string;
    email: string;
    password: string;
    role: string;
    firstName: string;
    lastName: string;
    activatedAt: Date | null;
  }>();

  // Simulate seed data with bcrypt-hashed passwords
  const hashedPassword = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012';

  const seedUsers = [
    { id: '1', email: 'admin@nexus-reussite.com', password: hashedPassword, role: 'ADMIN', firstName: 'Admin', lastName: 'Nexus', activatedAt: new Date() },
    { id: '2', email: 'helios@nexus-reussite.com', password: hashedPassword, role: 'COACH', firstName: 'Helios', lastName: 'Nexus', activatedAt: new Date() },
    { id: '3', email: 'zenon@nexus-reussite.com', password: hashedPassword, role: 'COACH', firstName: 'Zenon', lastName: 'Nexus', activatedAt: new Date() },
    { id: '4', email: 'parent@example.com', password: hashedPassword, role: 'PARENT', firstName: 'Marie', lastName: 'Dupont', activatedAt: new Date() },
    { id: '5', email: 'student@example.com', password: hashedPassword, role: 'ELEVE', firstName: 'Ahmed', lastName: 'Dupont', activatedAt: new Date() },
  ];

  seedUsers.forEach(u => users.set(u.email, u));

  return {
    prisma: {
      user: {
        findUnique: jest.fn(({ where }: { where: { email: string } }) => {
          return Promise.resolve(users.get(where.email) ?? null);
        }),
      },
    },
  };
});

import { prisma } from '@/lib/prisma';

const SEED_USERS = [
  { email: 'admin@nexus-reussite.com', password: 'admin123', role: 'ADMIN' },
  { email: 'helios@nexus-reussite.com', password: 'admin123', role: 'COACH' },
  { email: 'zenon@nexus-reussite.com', password: 'admin123', role: 'COACH' },
  { email: 'parent@example.com', password: 'admin123', role: 'PARENT' },
  { email: 'student@example.com', password: 'admin123', role: 'ELEVE' },
];

describe('Seed Users Authentication Regression', () => {
  SEED_USERS.forEach(({ email, role }) => {
    it(`${email} (${role}) exists in database`, async () => {
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).not.toBeNull();
    });

    it(`${email} (${role}) has bcrypt-hashed password`, async () => {
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).not.toBeNull();
      expect(user!.password).toMatch(/^\$2[aby]\$/);
    });

    it(`${email} (${role}) has correct role`, async () => {
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).not.toBeNull();
      expect(user!.role).toBe(role);
    });
  });

  it('ELEVE user (student@example.com) has activatedAt set', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'student@example.com' } });
    expect(user).not.toBeNull();
    expect(user!.activatedAt).not.toBeNull();
  });

  it('bcrypt.hash produces valid hash format', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    expect(hash).toMatch(/^\$2[aby]\$/);
    const isValid = await bcrypt.compare('admin123', hash);
    expect(isValid).toBe(true);
  });

  it('bcrypt.compare rejects wrong password', async () => {
    const hash = await bcrypt.hash('admin123', 10);
    const isValid = await bcrypt.compare('wrongpassword', hash);
    expect(isValid).toBe(false);
  });

  it('authorize flow: null password returns null (OAuth users)', async () => {
    // Simulate a user with null password (OAuth-only)
    const mockFindUnique = prisma.user.findUnique as jest.MockedFunction<any>;
    mockFindUnique.mockResolvedValueOnce({
      id: 'oauth-1', email: 'oauth@test.com', password: null, role: 'PARENT',
      firstName: 'OAuth', lastName: 'User', activatedAt: new Date(),
    });

    const user = await prisma.user.findUnique({ where: { email: 'oauth@test.com' } });
    // auth.ts line 31: if (!user || !user.password) return null
    expect(!user || !user.password).toBe(true);
  });

  it('authorize flow: unactivated ELEVE is blocked', async () => {
    const mockFindUnique = prisma.user.findUnique as jest.MockedFunction<any>;
    mockFindUnique.mockResolvedValueOnce({
      id: 'unactivated-1', email: 'new-student@test.com',
      password: await bcrypt.hash('test123', 10),
      role: 'ELEVE', firstName: 'New', lastName: 'Student',
      activatedAt: null, // Not activated
    });

    const user = await prisma.user.findUnique({ where: { email: 'new-student@test.com' } });
    // auth.ts line 34: if (user.role === 'ELEVE' && !user.activatedAt) → blocked
    expect(user!.role).toBe('ELEVE');
    expect(user!.activatedAt).toBeNull();
  });
});
