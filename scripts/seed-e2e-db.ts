/**
 * E2E Database Seeding Script
 *
 * Seeds test data for E2E tests with predictable fixtures:
 * - Test users for each role (ADMIN, PARENT, ELEVE, COACH)
 * - Test session bookings for booking flows
 *
 * All passwords: "password123"
 * Run: DATABASE_URL=... npx tsx scripts/seed-e2e-db.ts
 */

import { PrismaClient, UserRole, Subject } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding E2E database...\n');

  // =============================================================================
  // CLEANUP
  // =============================================================================
  console.log('🧹 Clearing existing data...');

  await prisma.sessionBooking.deleteMany();
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
      firstName: 'Test',
      lastName: 'Admin',
    },
  });
  console.log(`  ✓ Admin: ${admin.email}`);

  const parent = await prisma.user.create({
    data: {
      email: 'parent@test.com',
      password: hashedPassword,
      role: UserRole.PARENT,
      firstName: 'Test',
      lastName: 'Parent',
    },
  });
  console.log(`  ✓ Parent: ${parent.email}`);

  const student = await prisma.user.create({
    data: {
      email: 'student@test.com',
      password: hashedPassword,
      role: UserRole.ELEVE,
      firstName: 'Test',
      lastName: 'Student',
    },
  });
  console.log(`  ✓ Student: ${student.email}`);

  const coach = await prisma.user.create({
    data: {
      email: 'coach@test.com',
      password: hashedPassword,
      role: UserRole.COACH,
      firstName: 'Test',
      lastName: 'Coach',
    },
  });
  console.log(`  ✓ Coach: ${coach.email}\n`);

  // Additional test users for RBAC matrix
  const student2 = await prisma.user.create({
    data: {
      email: 'student2@test.com',
      password: hashedPassword,
      role: UserRole.ELEVE,
      firstName: 'Test',
      lastName: 'Student 2',
    },
  });

  const coach2 = await prisma.user.create({
    data: {
      email: 'coach2@test.com',
      password: hashedPassword,
      role: UserRole.COACH,
      firstName: 'Test',
      lastName: 'Coach 2',
    },
  });
  console.log(`  ✓ Additional test users created for RBAC tests\n`);

  // =============================================================================
  // CREATE SESSION BOOKINGS
  // =============================================================================
  console.log('📅 Creating test session bookings...');

  const booking1 = await prisma.sessionBooking.create({
    data: {
      studentId: student.id,
      coachId: coach.id,
      parentId: parent.id,
      subject: Subject.MATHEMATIQUES,
      title: 'Math Session - Algebra',
      description: 'Test session for algebra concepts',
      scheduledDate: new Date('2026-03-01T10:00:00Z'),
      startTime: '10:00',
      endTime: '11:00',
      duration: 60,
      status: 'SCHEDULED',
      creditsUsed: 1,
    },
  });
  console.log(`  ✓ Booking 1: ${student.firstName} → ${booking1.title} (SCHEDULED)`);

  const booking2 = await prisma.sessionBooking.create({
    data: {
      studentId: student.id,
      coachId: coach.id,
      parentId: parent.id,
      subject: Subject.PHYSIQUE_CHIMIE,
      title: 'Physics Session - Mechanics',
      description: 'Test session for physics mechanics',
      scheduledDate: new Date('2026-03-02T14:00:00Z'),
      startTime: '14:00',
      endTime: '15:30',
      duration: 90,
      status: 'SCHEDULED',
      creditsUsed: 1,
    },
  });
  console.log(`  ✓ Booking 2: ${student.firstName} → ${booking2.title} (SCHEDULED)`);

  const booking3 = await prisma.sessionBooking.create({
    data: {
      studentId: student2.id,
      coachId: coach2.id,
      subject: Subject.NSI,
      title: 'Computer Science - Algorithms',
      description: 'Test session for algorithms',
      scheduledDate: new Date('2026-03-03T09:00:00Z'),
      startTime: '09:00',
      endTime: '10:30',
      duration: 90,
      status: 'SCHEDULED',
      creditsUsed: 1,
    },
  });
  console.log(`  ✓ Booking 3: ${student2.firstName} → ${booking3.title} (SCHEDULED)\n`);

  // =============================================================================
  // SUMMARY
  // =============================================================================
  console.log('✅ E2E database seeded successfully!\n');
  console.log('📊 Summary:');
  console.log(`  Users: ${await prisma.user.count()}`);
  console.log(`  Session Bookings: ${await prisma.sessionBooking.count()}\n`);

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
