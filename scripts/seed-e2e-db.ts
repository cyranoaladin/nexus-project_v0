/**
 * E2E Database Seeding Script
 *
 * Seeds test data for E2E tests with predictable fixtures:
 * - Test users for each role (ADMIN, PARENT, STUDENT, COACH)
 * - Test sessions for booking flows
 * - Test bookings for state verification
 *
 * All passwords: "password123"
 * Run: DATABASE_URL=... npx tsx scripts/seed-e2e-db.ts
 */

import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding E2E database...\n');

  // =============================================================================
  // CLEANUP
  // =============================================================================
  console.log('🧹 Clearing existing data...');

  await prisma.booking.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Database cleared\n');

  // =============================================================================
  // PASSWORD HASH
  // =============================================================================
  const hashedPassword = await bcrypt.hash('password123', 10);

  // =============================================================================
  // CREATE USERS
  // =============================================================================
  console.log('👥 Creating test users...');

  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      password: hashedPassword,
      role: UserRole.ADMIN,
      name: 'Test Admin',
      emailVerified: new Date(),
    },
  });
  console.log(`  ✓ Admin: ${admin.email}`);

  const parent = await prisma.user.create({
    data: {
      email: 'parent@test.com',
      password: hashedPassword,
      role: UserRole.PARENT,
      name: 'Test Parent',
      emailVerified: new Date(),
      credits: 10, // Parent with credits
    },
  });
  console.log(`  ✓ Parent: ${parent.email} (10 credits)`);

  const student = await prisma.user.create({
    data: {
      email: 'student@test.com',
      password: hashedPassword,
      role: UserRole.STUDENT,
      name: 'Test Student',
      emailVerified: new Date(),
      parentId: parent.id,
    },
  });
  console.log(`  ✓ Student: ${student.email} (linked to parent)`);

  const coach = await prisma.user.create({
    data: {
      email: 'coach@test.com',
      password: hashedPassword,
      role: UserRole.COACH,
      name: 'Test Coach',
      emailVerified: new Date(),
    },
  });
  console.log(`  ✓ Coach: ${coach.email}\n`);

  // Additional test users for RBAC matrix
  const student2 = await prisma.user.create({
    data: {
      email: 'student2@test.com',
      password: hashedPassword,
      role: UserRole.STUDENT,
      name: 'Test Student 2',
      emailVerified: new Date(),
    },
  });

  const coach2 = await prisma.user.create({
    data: {
      email: 'coach2@test.com',
      password: hashedPassword,
      role: UserRole.COACH,
      name: 'Test Coach 2',
      emailVerified: new Date(),
    },
  });
  console.log(`  ✓ Additional test users created for RBAC tests\n`);

  // =============================================================================
  // CREATE SESSIONS
  // =============================================================================
  console.log('📅 Creating test sessions...');

  const session1 = await prisma.session.create({
    data: {
      title: 'Math Session - Algebra',
      description: 'Test session for algebra concepts',
      coachId: coach.id,
      startTime: new Date('2026-03-01T10:00:00Z'),
      endTime: new Date('2026-03-01T11:00:00Z'),
      maxStudents: 5,
      price: 50,
      status: 'SCHEDULED',
    },
  });
  console.log(`  ✓ Session 1: ${session1.title} (Coach: ${coach.name})`);

  const session2 = await prisma.session.create({
    data: {
      title: 'Physics Session - Mechanics',
      description: 'Test session for physics mechanics',
      coachId: coach.id,
      startTime: new Date('2026-03-02T14:00:00Z'),
      endTime: new Date('2026-03-02T15:30:00Z'),
      maxStudents: 3,
      price: 75,
      status: 'SCHEDULED',
    },
  });
  console.log(`  ✓ Session 2: ${session2.title} (Coach: ${coach.name})`);

  const session3 = await prisma.session.create({
    data: {
      title: 'Chemistry Session - Organic',
      description: 'Test session for organic chemistry',
      coachId: coach2.id,
      startTime: new Date('2026-03-03T09:00:00Z'),
      endTime: new Date('2026-03-03T10:30:00Z'),
      maxStudents: 4,
      price: 60,
      status: 'SCHEDULED',
    },
  });
  console.log(`  ✓ Session 3: ${session3.title} (Coach: ${coach2.name})\n`);

  // =============================================================================
  // CREATE BOOKINGS
  // =============================================================================
  console.log('📝 Creating test bookings...');

  const booking1 = await prisma.booking.create({
    data: {
      sessionId: session1.id,
      studentId: student.id,
      parentId: parent.id,
      status: 'CONFIRMED',
      creditsUsed: 1,
    },
  });
  console.log(`  ✓ Booking 1: ${student.name} → ${session1.title} (CONFIRMED)`);

  const booking2 = await prisma.booking.create({
    data: {
      sessionId: session2.id,
      studentId: student2.id,
      status: 'PENDING',
      creditsUsed: 0,
    },
  });
  console.log(`  ✓ Booking 2: ${student2.name} → ${session2.title} (PENDING)\n`);

  // =============================================================================
  // SUMMARY
  // =============================================================================
  console.log('✅ E2E database seeded successfully!\n');
  console.log('📊 Summary:');
  console.log(`  Users: ${await prisma.user.count()}`);
  console.log(`  Sessions: ${await prisma.session.count()}`);
  console.log(`  Bookings: ${await prisma.booking.count()}\n`);

  console.log('🔑 Test Credentials:');
  console.log(`  Admin:   admin@test.com / password123`);
  console.log(`  Parent:  parent@test.com / password123`);
  console.log(`  Student: student@test.com / password123`);
  console.log(`  Coach:   coach@test.com / password123\n`);

  console.log('🧪 Ready for E2E tests!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding E2E database:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
