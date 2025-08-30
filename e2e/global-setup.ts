import { chromium, FullConfig } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { encode } from 'next-auth/jwt';

// Reusable function to create and save auth state for a user
async function createAuth(prisma: any, email: string, storagePath: string) {
  console.log(`Creating auth state for ${email} at ${storagePath}...`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      student: { select: { id: true } },
      parentProfile: { select: { id: true } },
    },
  });
  if (!user) {
    throw new Error(`User ${email} not found in database. Make sure seeding ran correctly.`);
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not defined. Cannot create session token.');
  }

  // Create a JWT payload that mimics what NextAuth would create
  const token = {
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    picture: null,
    sub: user.id,
    role: user.role,
    studentId: user.student?.id,
    parentId: user.parentProfile?.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
  };

  const sessionToken = await encode({ token, secret });

  // Create a dummy browser context to set the cookie
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: 'next-auth.session-token',
      value: sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  await context.storageState({ path: storagePath });
  await browser.close();
  console.log(`Auth state for ${email} created successfully.`);
}

export default async function globalSetup(_config: FullConfig) {
  if (!process.env.DATABASE_URL) {
    console.error("FATAL: DATABASE_URL not set. Make sure you run tests using 'npm run test:e2e'.");
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prisma } = require('../lib/prisma');

  // --- 1. Seed Users (Idempotent) ---
  const studentEmail = 'student-e2e@nexus.com';
  const parentEmail = 'parent-e2e@nexus.com';
  const adminEmail = 'admin-e2e@nexus.com';
  const password = 'password123';
  const hashedPass = await bcrypt.hash(password, 12);

  console.log('Seeding E2E users...');
  await prisma.user.upsert({ where: { email: adminEmail }, update: { password: hashedPass }, create: { email: adminEmail, password: hashedPass, role: 'ADMIN', firstName: 'Admin', lastName: 'E2E' } });
  const parentUser = await prisma.user.upsert({ where: { email: parentEmail }, update: { password: hashedPass }, create: { email: parentEmail, password: hashedPass, role: 'PARENT', firstName: 'Parent', lastName: 'E2E' } });
  const parentProfile = await prisma.parentProfile.upsert({ where: { userId: parentUser.id }, update: {}, create: { userId: parentUser.id } });
  const studentUser = await prisma.user.upsert({ where: { email: studentEmail }, update: { password: hashedPass }, create: { email: studentEmail, password: hashedPass, role: 'ELEVE', firstName: 'Student', lastName: 'E2E' } });
  await prisma.student.upsert({ where: { userId: studentUser.id }, update: { parentId: parentProfile.id }, create: { userId: studentUser.id, parentId: parentProfile.id, grade: 'Première', credits: 5 } });
  console.log('E2E users seeded.');

  // --- 2. Create Auth States Programmatically ---
  try {
    await createAuth(prisma, adminEmail, 'e2e/.auth/admin.json');
    await createAuth(prisma, parentEmail, 'e2e/.auth/parent.json');
    await createAuth(prisma, studentEmail, 'e2e/.auth/student.json');
  } catch (error) {
    console.error('FATAL: Failed to create auth states.', error);
    process.exit(1);
  }
}