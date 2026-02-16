/**
 * E2E Database Seeding Script - Parent Dashboard
 *
 * Seeds comprehensive test data for parent dashboard E2E tests:
 * - Parent with 2 children
 * - 18 badges across all categories
 * - 40+ sessions over 3 months
 * - 30+ financial transactions
 * - Credit transaction history
 *
 * All passwords: "password123"
 * Run: DATABASE_URL=... npx tsx scripts/seed-parent-dashboard-e2e.ts
 */

import { PrismaClient, UserRole, Subject, SessionStatus, SubscriptionStatus, PaymentType, PaymentStatus } from '@prisma/client';
// import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface FixtureData {
  parent: any;
  children: any[];
  coaches: any[];
  badges: any[];
  studentBadges: any[];
  sessions: any[];
  creditTransactions: any[];
  payments: any[];
}

async function main() {
  console.log('🌱 Seeding Parent Dashboard E2E database...\n');

  // =============================================================================
  // LOAD FIXTURE DATA
  // =============================================================================
  console.log('📂 Loading fixture data...');
  const fixturePath = path.join(__dirname, '../e2e/fixtures/parent.json');
  const fixtureData: FixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
  console.log('✅ Fixture data loaded\n');

  // =============================================================================
  // CLEANUP
  // =============================================================================
  console.log('🧹 Clearing existing test data...');

  // Delete in reverse order of dependencies
  await prisma.sessionBooking.deleteMany({
    where: { parentId: fixtureData.parent.id }
  });
  await prisma.studentBadge.deleteMany({
    where: { studentId: { in: ['student-001', 'student-002'] } }
  });
  await prisma.badge.deleteMany();
  await prisma.creditTransaction.deleteMany({
    where: { studentId: { in: ['student-001', 'student-002'] } }
  });
  await prisma.subscription.deleteMany({
    where: { studentId: { in: ['student-001', 'student-002'] } }
  });
  await prisma.payment.deleteMany({
    where: { userId: fixtureData.parent.id }
  });
  await prisma.student.deleteMany({
    where: { id: { in: ['student-001', 'student-002'] } }
  });
  await prisma.coachProfile.deleteMany({
    where: {
      OR: [
        { userId: { in: ['coach-test-001', 'coach-test-002'] } },
        { pseudonym: { in: ['Hélios', 'Zénon'] } }
      ]
    }
  });
  await prisma.parentProfile.deleteMany({
    where: { userId: fixtureData.parent.id }
  });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [
          fixtureData.parent.id,
          'student-test-001',
          'student-test-002',
          'coach-test-001',
          'coach-test-002'
        ]
      }
    }
  });

  console.log('✅ Database cleared\n');

  // =============================================================================
  // PASSWORD HASH
  // =============================================================================
  // Hash for 'password123' generated locally to avoid bcrypt dependency in container
  const hashedPassword = '$2b$10$TAnmu8rftT19nLPATB/V4ebYdw2X1l8KPFACHusCMv6ffcKWfiaxO';

  // =============================================================================
  // CREATE ADMIN USER
  // =============================================================================
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Test',
      role: 'ADMIN',
    },
  });
  console.log(`👨‍💼 Admin User: ${adminUser.email}`);

  // =============================================================================
  // CREATE PARENT USER
  // =============================================================================
  console.log('👤 Creating parent user...');
  const parentUser = await prisma.user.create({
    data: {
      id: fixtureData.parent.id,
      email: fixtureData.parent.email,
      password: hashedPassword,
      role: UserRole.PARENT,
      firstName: fixtureData.parent.firstName,
      lastName: fixtureData.parent.lastName,
      phone: fixtureData.parent.phone,
    },
  });
  console.log(`  ✓ Parent User: ${parentUser.email}`);

  const parentProfile = await prisma.parentProfile.create({
    data: {
      id: fixtureData.parent.parentProfile.id,
      userId: parentUser.id,
      address: fixtureData.parent.parentProfile.address,
      city: fixtureData.parent.parentProfile.city,
      country: fixtureData.parent.parentProfile.country,
    },
  });
  console.log(`  ✓ Parent Profile created\n`);

  // =============================================================================
  // CREATE COACH USERS
  // =============================================================================
  console.log('👨‍🏫 Creating coach users...');
  for (const coach of fixtureData.coaches) {
    const coachUser = await prisma.user.create({
      data: {
        id: coach.id,
        email: coach.email,
        password: hashedPassword,
        role: UserRole.COACH,
        firstName: coach.firstName,
        lastName: coach.lastName,
      },
    });

    await prisma.coachProfile.create({
      data: {
        id: coach.coachProfile.id,
        userId: coachUser.id,
        title: coach.coachProfile.title,
        pseudonym: coach.coachProfile.pseudonym,
        tag: coach.coachProfile.tag,
        description: coach.coachProfile.description,
        philosophy: coach.coachProfile.philosophy,
        subjects: coach.coachProfile.subjects,
      },
    });
    console.log(`  ✓ Coach: ${coachUser.email} (${coach.coachProfile.pseudonym})`);
  }
  console.log();

  // =============================================================================
  // CREATE STUDENT USERS AND PROFILES
  // =============================================================================
  console.log('👨‍🎓 Creating student users...');
  for (const child of fixtureData.children) {
    const studentUser = await prisma.user.create({
      data: {
        id: child.id,
        email: child.email,
        password: hashedPassword,
        role: UserRole.ELEVE,
        firstName: child.firstName,
        lastName: child.lastName,
      },
    });

    const student = await prisma.student.create({
      data: {
        id: child.student.id,
        parentId: parentProfile.id,
        userId: studentUser.id,
        grade: child.student.grade,
        school: child.student.school,
        credits: child.student.credits,
        totalSessions: child.student.totalSessions,
        completedSessions: child.student.completedSessions,
      },
    });

    // Create subscription
    await prisma.subscription.create({
      data: {
        studentId: student.id,
        planName: child.student.subscription.planName,
        monthlyPrice: child.student.subscription.monthlyPrice,
        creditsPerMonth: child.student.subscription.creditsPerMonth,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(child.student.subscription.startDate),
        endDate: new Date(child.student.subscription.endDate),
        ariaSubjects: child.student.subscription.ariaSubjects,
        ariaCost: child.student.subscription.ariaCost,
      },
    });

    console.log(`  ✓ Student: ${studentUser.email} (${child.student.grade})`);
  }
  console.log();

  // =============================================================================
  // CREATE BADGES
  // =============================================================================
  console.log('🏅 Creating badges...');
  for (const badge of fixtureData.badges) {
    await prisma.badge.create({
      data: {
        id: badge.id,
        name: badge.name,
        description: badge.description,
        category: badge.category,
        icon: badge.icon,
        condition: badge.condition,
      },
    });
  }
  console.log(`  ✓ Created ${fixtureData.badges.length} badges\n`);

  // =============================================================================
  // ASSIGN BADGES TO STUDENTS
  // =============================================================================
  console.log('🎖️ Assigning badges to students...');
  for (const studentBadge of fixtureData.studentBadges) {
    await prisma.studentBadge.create({
      data: {
        studentId: studentBadge.studentId,
        badgeId: studentBadge.badgeId,
        earnedAt: new Date(studentBadge.earnedAt),
      },
    });
  }
  console.log(`  ✓ Assigned ${fixtureData.studentBadges.length} badges\n`);

  // =============================================================================
  // CREATE SESSION BOOKINGS
  // =============================================================================
  console.log('📅 Creating session bookings...');
  for (const session of fixtureData.sessions) {
    await prisma.sessionBooking.create({
      data: {
        studentId: session.studentId,
        coachId: session.coachId,
        parentId: session.parentId,
        subject: session.subject as Subject,
        title: session.title,
        description: session.description,
        scheduledDate: new Date(session.scheduledDate),
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        status: session.status as SessionStatus,
        creditsUsed: session.creditsUsed,
        type: session.type,
        modality: session.modality,
        rating: session.rating,
        completedAt: session.completedAt ? new Date(session.completedAt) : null,
      },
    });
  }
  console.log(`  ✓ Created ${fixtureData.sessions.length} session bookings\n`);

  // =============================================================================
  // CREATE CREDIT TRANSACTIONS
  // =============================================================================
  console.log('💳 Creating credit transactions...');
  for (const transaction of fixtureData.creditTransactions) {
    await prisma.creditTransaction.create({
      data: {
        studentId: transaction.studentId,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        createdAt: new Date(transaction.createdAt),
      },
    });
  }
  console.log(`  ✓ Created ${fixtureData.creditTransactions.length} credit transactions\n`);

  // =============================================================================
  // CREATE PAYMENTS
  // =============================================================================
  console.log('💰 Creating payments...');
  for (const payment of fixtureData.payments) {
    await prisma.payment.create({
      data: {
        userId: payment.userId,
        type: payment.type as PaymentType,
        amount: payment.amount,
        currency: payment.currency,
        description: payment.description,
        status: payment.status as PaymentStatus,
        method: payment.method,
        externalId: payment.externalId,
        createdAt: new Date(payment.createdAt),
      },
    });
  }
  console.log(`  ✓ Created ${fixtureData.payments.length} payments\n`);

  // =============================================================================
  // SUMMARY
  // =============================================================================
  console.log('✅ Parent Dashboard E2E database seeded successfully!\n');
  console.log('📊 Summary:');
  console.log(`  Users: ${await prisma.user.count()}`);
  console.log(`  Parent Profiles: ${await prisma.parentProfile.count()}`);
  console.log(`  Students: ${await prisma.student.count()}`);
  console.log(`  Coaches: ${await prisma.coachProfile.count()}`);
  console.log(`  Badges: ${await prisma.badge.count()}`);
  console.log(`  Student Badges: ${await prisma.studentBadge.count()}`);
  console.log(`  Session Bookings: ${await prisma.sessionBooking.count()}`);
  console.log(`  Credit Transactions: ${await prisma.creditTransaction.count()}`);
  console.log(`  Payments: ${await prisma.payment.count()}\n`);

  console.log('🔑 Test Credentials:');
  console.log(`  Parent:  ${fixtureData.parent.email} / password123`);
  console.log(`  Student 1: ${fixtureData.children[0].email} / password123`);
  console.log(`  Student 2: ${fixtureData.children[1].email} / password123`);
  console.log(`  Coach 1: ${fixtureData.coaches[0].email} / password123`);
  console.log(`  Coach 2: ${fixtureData.coaches[1].email} / password123\n`);

  console.log('📈 Test Data Coverage:');
  console.log(`  Badge Categories: ASSIDUITE (6), PROGRESSION (6), CURIOSITE (6)`);
  console.log(`  Sessions: 40+ over 3 months (Nov 2025 - Feb 2026)`);
  console.log(`  Subjects: MATHEMATIQUES, PHYSIQUE_CHIMIE, NSI, FRANCAIS`);
  console.log(`  Financial Transactions: 15 payments + 26 credit transactions`);
  console.log(`  Session Statuses: COMPLETED (24), SCHEDULED (16)\n`);

  console.log('🧪 Ready for Parent Dashboard E2E tests!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding Parent Dashboard E2E database:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
