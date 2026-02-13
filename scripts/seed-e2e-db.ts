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
  const tables = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;

  const tableNames = tables
    .map((t) => t.tablename)
    .filter((name) => name !== '_prisma_migrations');

  if (tableNames.length > 0) {
    const quoted = tableNames.map((name) => `"${name}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
  }

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
      firstName: 'Admin',
      lastName: 'Nexus',
    },
  });
  console.log(`  ✓ Admin: ${admin.email}`);

  const parent = await prisma.user.create({
    data: {
      email: 'parent.dashboard@test.com',
      password: hashedPassword,
      role: UserRole.PARENT,
      firstName: 'Marie',
      lastName: 'Dupont',
      parentProfile: {
        create: {
          address: '12 Rue de la République',
          city: 'Tunis',
          country: 'Tunisie'
        }
      }
    },
    include: { parentProfile: true }
  });
  console.log(`  ✓ Parent: ${parent.email}`);

  const student = await prisma.user.create({
    data: {
      email: 'yasmine.dupont@test.com',
      password: hashedPassword,
      role: UserRole.ELEVE,
      firstName: 'Yasmine',
      lastName: 'Dupont',
      studentProfile: {
        create: {
          grade: 'Terminale',
          school: 'Lycée Pilote Ariana'
        }
      }
    },
    include: { studentProfile: true }
  });

  // Create Student Entity linked to Parent
  await prisma.student.create({
    data: {
      userId: student.id,
      parentId: parent.parentProfile!.id,
      credits: 8,
      totalSessions: 24
    }
  });

  const primaryStudent = await prisma.student.findUnique({
    where: { userId: student.id }
  });

  if (primaryStudent) {
    await prisma.creditTransaction.create({
      data: {
        studentId: primaryStudent.id,
        type: 'MANUAL_ADJUST',
        amount: 8,
        description: 'E2E seed credits'
      }
    });
  }

  console.log(`  ✓ Student: ${student.email} (Linked to Parent)`);

  const coach = await prisma.user.create({
    data: {
      email: 'helios@test.com',
      password: hashedPassword,
      role: UserRole.COACH,
      firstName: 'Alexandre',
      lastName: 'Martin',
      coachProfile: {
        create: {
          title: 'Agrégé',
          pseudonym: 'Hélios',
          tag: '🎓 Agrégé',
          description: 'Expert en mathématiques et physique',
          philosophy: "L'apprentissage par la compréhension profonde",
          subjects: '["MATHEMATIQUES", "PHYSIQUE_CHIMIE", "NSI"]'
        }
      }
    },
    include: { coachProfile: true }
  });
  console.log(`  ✓ Coach: ${coach.email}\n`);

  // Additional test users for RBAC matrix
  const student2 = await prisma.user.create({
    data: {
      email: 'karim.dupont@test.com',
      password: hashedPassword,
      role: UserRole.ELEVE,
      firstName: 'Karim',
      lastName: 'Dupont',
      studentProfile: {
        create: {
          grade: 'Première',
          school: 'Lycée Pilote Ariana'
        }
      }
    },
  });

  // Create Student Entity for student2 linked to same Parent
  await prisma.student.create({
    data: {
      userId: student2.id,
      parentId: parent.parentProfile!.id,
      credits: 5,
      totalSessions: 16
    }
  });

  const secondaryStudent = await prisma.student.findUnique({
    where: { userId: student2.id }
  });

  if (secondaryStudent) {
    await prisma.creditTransaction.create({
      data: {
        studentId: secondaryStudent.id,
        type: 'MANUAL_ADJUST',
        amount: 5,
        description: 'E2E seed credits'
      }
    });
  }

  const coach2 = await prisma.user.create({
    data: {
      email: 'zenon@test.com',
      password: hashedPassword,
      role: UserRole.COACH,
      firstName: 'Sophie',
      lastName: 'Bernard',
      coachProfile: {
        create: {
          title: 'Certifiée',
          pseudonym: 'Zénon',
          tag: '🎯 Stratège',
          description: 'Spécialiste français et philosophie',
          philosophy: 'La réflexion critique avant tout',
          subjects: '["FRANCAIS", "PHILOSOPHIE", "HISTOIRE_GEO"]'
        }
      }
    },
    include: { coachProfile: true }
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
  console.log(`  Parent:  parent.dashboard@test.com / password123`);
  console.log(`  Student: yasmine.dupont@test.com / password123`);
  console.log(`  Student2: karim.dupont@test.com / password123`);
  console.log(`  Coach:   helios@test.com / password123`);
  console.log(`  Coach2:  zenon@test.com / password123\n`);

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
