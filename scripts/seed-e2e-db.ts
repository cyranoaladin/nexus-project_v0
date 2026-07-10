import { serializeError } from '@/lib/utils/serialize-error';
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

import { AcademicTrack, GradeLevel, PrismaClient, StmgPathway, UserRole, Subject } from '@prisma/client';
import { ensureEamProgressTable } from './migrate-eam';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import path from 'path';
import { createDefaultSurvivalSnapshot, toPrismaSurvivalData } from '../lib/survival/progress';

// Fallback only: process.env.DATABASE_URL (set by gate) takes precedence over .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ── Hard guard: refuse to seed anything other than the disposable e2e database ──
// Parsed BEFORE new PrismaClient() — no connection is made if the target is wrong.
const _seedDbUrl = process.env.DATABASE_URL ?? '';
const _seedUrlMatch = _seedDbUrl.match(/:\/\/[^@]*@([^:/]+):(\d+)\/([^?]+)/);
const _seedHost = _seedUrlMatch?.[1] ?? '';
const _seedPort = _seedUrlMatch?.[2] ?? '';
const _seedDb = _seedUrlMatch?.[3] ?? '';
const _allowedHosts = new Set(['localhost', '127.0.0.1', '::1']);

if (!_allowedHosts.has(_seedHost) || _seedPort !== '5435' || _seedDb !== 'nexus_e2e') {
  console.error(
    `✗ Refusing to run destructive seed against ${_seedHost}:${_seedPort}/${_seedDb}\n` +
    `  This script only targets the disposable e2e database 127.0.0.1:5435/nexus_e2e.\n` +
    `  Got DATABASE_URL: ${_seedDbUrl.slice(0, 80)}...`
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  console.log(`🌱 Seeding E2E database: ${_seedHost}:${_seedPort}/${_seedDb}\n`);

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
  // RAW TABLES (not in Prisma schema — DDL source unique: scripts/migrate-eam.ts)
  // =============================================================================
  console.log('🗄️  Creating raw tables (eam_progress)...');
  await ensureEamProgressTable(prisma);
  console.log('  ✓ eam_progress table ready\n');

  // =============================================================================
  // PASSWORD HASHES
  // =============================================================================
  const hashedPassword = await bcrypt.hash('password123', 10);
  const hashedAdmin123 = await bcrypt.hash('admin123', 10);

  // =============================================================================
  // PLAYWRIGHT-EXPECTED USERS (03-signin + 06-dashboards specs)
  // These users match the emails/passwords hardcoded in Playwright E2E tests.
  // =============================================================================
  console.log('🎭 Creating Playwright-expected users (admin123)...');

  const pwAdmin = await prisma.user.create({
    data: {
      email: 'admin@nexus-reussite.com',
      password: hashedAdmin123,
      role: UserRole.ADMIN,
      firstName: 'Admin',
      lastName: 'Nexus',
      activatedAt: new Date(),
    },
  });
  console.log(`  ✓ PW Admin: ${pwAdmin.email}`);

  const pwParent = await prisma.user.create({
    data: {
      email: 'parent@example.com',
      password: hashedAdmin123,
      role: UserRole.PARENT,
      firstName: 'Marie',
      lastName: 'Dupont',
      activatedAt: new Date(),
      parentProfile: { create: {} },
    },
    include: { parentProfile: true },
  });
  console.log(`  ✓ PW Parent: ${pwParent.email}`);

  const pwStudent = await prisma.user.create({
    data: {
      email: 'student@example.com',
      password: hashedAdmin123,
      role: UserRole.ELEVE,
      firstName: 'Ahmed',
      lastName: 'Dupont',
      activatedAt: new Date(),
    },
  });
  await prisma.student.create({
    data: {
      userId: pwStudent.id,
      parentId: pwParent.parentProfile!.id,
      grade: 'Première',
      gradeLevel: 'PREMIERE',
      academicTrack: 'EDS_GENERALE',
      specialties: [Subject.MATHEMATIQUES, Subject.NSI, Subject.PHYSIQUE_CHIMIE],
      credits: 5,
    },
  });
  console.log(`  ✓ PW Student (EDS): ${pwStudent.email}`);

  const pwCoach = await prisma.user.create({
    data: {
      email: 'helios@nexus-reussite.com',
      password: hashedAdmin123,
      role: UserRole.COACH,
      firstName: 'Helios',
      lastName: 'Nexus',
      activatedAt: new Date(),
      coachProfile: {
        create: {
          pseudonym: 'Coach Helios',
          title: 'Agrégé',
          description: 'Expert en mathématiques',
          subjects: ['MATHEMATIQUES', 'NSI'],
        },
      },
    },
  });
  console.log(`  ✓ PW Coach: ${pwCoach.email}\n`);

  const pwAssistante = await prisma.user.create({
    data: {
      email: 'assistante@nexus-reussite.com',
      password: hashedAdmin123,
      role: UserRole.ASSISTANTE,
      firstName: 'Ines',
      lastName: 'Assistante',
      activatedAt: new Date(),
    },
  });
  console.log(`  ✓ PW Assistante: ${pwAssistante.email}`);

  const pwStudent2 = await prisma.user.create({
    data: {
      email: 'student2@example.com',
      password: hashedAdmin123,
      role: UserRole.ELEVE,
      firstName: 'Karim',
      lastName: 'Dupont',
      activatedAt: new Date(),
    },
  });
  await prisma.student.create({
    data: {
      userId: pwStudent2.id,
      parentId: pwParent.parentProfile!.id,
      grade: 'Première',
      gradeLevel: 'PREMIERE',
      academicTrack: 'STMG',
      stmgPathway: 'INDETERMINE',
      specialties: [],
      credits: 5,
    },
  });
  console.log(`  ✓ PW Student2 (STMG): ${pwStudent2.email}\n`);

  // =============================================================================
  // CREATE USERS (original E2E test users)
  // =============================================================================
  console.log('👥 Creating test users...');

const timestamp = Date.now();

// Create users with specific emails for E2E tests that expect these exact values
const studentEmail = 'yasmine.dupont@test.com';
const coachEmail = 'helios@test.com';

// First, try to delete existing users with these emails (in case of re-run)
await prisma.user.deleteMany({ where: { email: { in: [studentEmail, coachEmail, 'parent.dashboard@test.com', 'admin@test.com'] } } }).catch(() => {});

const admin = await prisma.user.create({
  data: {
    email: `admin.${timestamp}@test.com`,
      password: hashedPassword,
      role: UserRole.ADMIN,
      firstName: 'Admin',
      lastName: 'Nexus',
    },
  });
  console.log(`  ✓ Admin: ${admin.email}`);

  const parent = await prisma.user.create({
    data: {
      email: `parent.${timestamp}@test.com`,
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
    email: studentEmail, // yasmine.dupont@test.com for E2E tests
      password: hashedPassword,
      role: UserRole.ELEVE,
      firstName: 'Yasmine',
      lastName: 'Dupont',
      activatedAt: new Date(),
    },
  });

  // Create Student Entity linked to Parent (source de vérité unique)
  await prisma.student.create({
    data: {
      userId: student.id,
      parentId: parent.parentProfile!.id,
      grade: 'Première',
      school: 'Lycée Pilote Ariana',
      credits: 8,
      totalSessions: 24,
      gradeLevel: GradeLevel.PREMIERE,
      academicTrack: AcademicTrack.EDS_GENERALE,
      specialties: [Subject.MATHEMATIQUES, Subject.NSI, Subject.PHYSIQUE_CHIMIE],
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

    await prisma.creditTransaction.create({
      data: {
        studentId: primaryStudent.id,
        type: 'CREDIT_REQUEST',
        amount: 4,
        description: 'E2E pending credit request for dialog proof'
      }
    });

    await prisma.subscription.create({
      data: {
        studentId: primaryStudent.id,
        planName: 'HYBRIDE',
        monthlyPrice: 450,
        creditsPerMonth: 4,
        status: 'ACTIVE',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2027-06-30T00:00:00.000Z'),
      }
    });

    await prisma.subscription.create({
      data: {
        studentId: primaryStudent.id,
        planName: 'IMMERSION',
        monthlyPrice: 750,
        creditsPerMonth: 8,
        status: 'INACTIVE',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2027-06-30T00:00:00.000Z'),
      }
    });

    await prisma.subscriptionRequest.create({
      data: {
        studentId: primaryStudent.id,
        requestType: 'PLAN_CHANGE',
        planName: 'IMMERSION',
        monthlyPrice: 750,
        reason: 'E2E pending subscription request for dialog proof',
        status: 'PENDING',
        requestedBy: parent.id,
        requestedByEmail: parent.email,
      }
    });
  }

  console.log(`  ✓ Student: ${student.email} (Linked to Parent)`);

  // Entitlement for parent — required by credits_use feature gate (needs platform_access)
  await prisma.entitlement.create({
    data: {
      userId: parent.id,
      productCode: 'ABONNEMENT_HYBRIDE',
      label: 'Abonnement Hybride E2E',
      status: 'ACTIVE',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`  ✓ Entitlement: platform_access for ${parent.email}`);

  const coach = await prisma.user.create({
    data: {
      email: coachEmail, // helios@test.com for E2E tests
      password: hashedPassword,
      role: UserRole.COACH,
      firstName: 'Alexandre',
      lastName: 'Martin',
      coachProfile: {
        create: {
          title: 'Agrégé',
          pseudonym: 'Hélios', // Exact pseudonym expected by E2E tests
          tag: '🎓 Agrégé',
          description: 'Expert en mathématiques et physique',
          philosophy: "L'apprentissage par la compréhension profonde",
          subjects: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI']
        }
      }
    },
    include: { coachProfile: true }
  });
  console.log(`  ✓ Coach: ${coach.email}\n`);

  const assistante = await prisma.user.create({
    data: {
      email: `assistante.${timestamp}@test.com`,
      password: hashedPassword,
      role: UserRole.ASSISTANTE,
      firstName: 'Ines',
      lastName: 'Support',
      activatedAt: new Date(),
    },
  });
  console.log(`  ✓ Assistante: ${assistante.email}\n`);

  // Additional test users for RBAC matrix
  const student2 = await prisma.user.create({
    data: {
      email: `student2.${timestamp}@test.com`,
      password: hashedPassword,
      role: UserRole.ELEVE,
      firstName: 'Karim',
      lastName: 'Dupont',
      activatedAt: new Date(),
    },
  });

  // Create Student Entity for student2 linked to same Parent
  await prisma.student.create({
    data: {
      userId: student2.id,
      grade: 'PREMIERE',
      gradeLevel: GradeLevel.PREMIERE,
      academicTrack: AcademicTrack.EDS_GENERALE,
      school: 'Lycée Pilote Ariana',
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

  const studentSurvival = await prisma.user.create({
    data: {
      email: `student-survival.${timestamp}@test.com`,
      password: hashedPassword,
      role: UserRole.ELEVE,
      firstName: 'Lina',
      lastName: 'Survie',
      activatedAt: new Date(),
    },
  });

  const survivalStudent = await prisma.student.create({
    data: {
      userId: studentSurvival.id,
      grade: 'PREMIERE',
      gradeLevel: GradeLevel.PREMIERE,
      academicTrack: AcademicTrack.STMG,
      specialties: [],
      stmgPathway: StmgPathway.INDETERMINE,
      survivalMode: true,
      survivalModeReason: 'E2E Mode Survie',
      survivalModeBy: assistante.id,
      survivalModeAt: new Date(),
      school: 'Lycée Pilote Ariana',
      parentId: parent.parentProfile!.id,
      credits: 5,
      totalSessions: 2,
    },
  });
  const survivalSnapshot = createDefaultSurvivalSnapshot();
  survivalSnapshot.reflexesState.reflex_1 = 'REVOIR';
  await prisma.survivalProgress.create({
    data: {
      studentId: survivalStudent.id,
      examDate: new Date('2026-06-08T08:00:00.000Z'),
      ...toPrismaSurvivalData(survivalSnapshot),
    },
  });

  const coach2 = await prisma.user.create({
    data: {
      email: `coach2.${timestamp}@test.com`,
      password: hashedPassword,
      role: UserRole.COACH,
      firstName: 'Sophie',
      lastName: 'Bernard',
      coachProfile: {
        create: {
          title: 'Certifiée',
          pseudonym: `Zénon_${timestamp}`,
          tag: '🎯 Stratège',
          description: 'Spécialiste français et philosophie',
          philosophy: 'La réflexion critique avant tout',
          subjects: ['FRANCAIS', 'PHILOSOPHIE', 'HISTOIRE_GEO']
        }
      }
    },
    include: { coachProfile: true }
  });

  // CRITICAL: Create Zenon coach for E2E booking flow tests
  const zenon = await prisma.user.upsert({
    where: { email: 'zenon@test.com' },
    update: {},
    create: {
      email: 'zenon@test.com',
      password: hashedPassword,
      role: UserRole.COACH,
      firstName: 'Zenon',
      lastName: 'Expert',
      coachProfile: {
        create: {
          title: 'Agrégé',
          pseudonym: 'Zénon',
          tag: '🧠 Expert NSI/Maths',
          description: 'Expert NSI et Mathématiques pour tests E2E',
          philosophy: 'Excellence par la pratique',
          subjects: ['NSI', 'MATHEMATIQUES']
        }
      }
    },
    include: { coachProfile: true }
  });
  console.log(`  ✓ Zenon Coach: ${zenon.email} (for E2E booking tests)`);
  console.log(`  ✓ Additional test users created for RBAC tests\n`);

  if (primaryStudent && coach.coachProfile) {
    const stageStart = new Date('2026-08-24T08:00:00.000Z');
    const stageEnd = new Date('2026-08-28T16:00:00.000Z');
    const stage = await prisma.stage.create({
      data: {
        slug: 'stage-e2e-modales',
        title: 'Stage E2E Modales',
        subtitle: 'Fixture de preuve modales',
        description: 'Stage déterministe pour les preuves e2e des modales admin.',
        type: 'INTENSIF',
        subject: [Subject.MATHEMATIQUES],
        level: ['Première'],
        startDate: stageStart,
        endDate: stageEnd,
        capacity: 12,
        priceAmount: 450,
        priceCurrency: 'TND',
        location: 'Mutuelleville',
        isVisible: true,
        isOpen: true,
      }
    });

    await prisma.stageCoach.create({
      data: {
        stageId: stage.id,
        coachId: coach.coachProfile.id,
        role: 'Coach référent E2E',
      }
    });

    await prisma.stageSession.create({
      data: {
        stageId: stage.id,
        title: 'Séance E2E diagnostic',
        subject: Subject.MATHEMATIQUES,
        startAt: new Date('2026-08-24T09:00:00.000Z'),
        endAt: new Date('2026-08-24T10:30:00.000Z'),
        location: 'Mutuelleville',
        coachId: coach.coachProfile.id,
        description: 'Séance seedée pour le planning de stage.',
      }
    });

    await prisma.stageBilan.create({
      data: {
        stageId: stage.id,
        studentId: primaryStudent.id,
        coachId: coach.coachProfile.id,
        contentEleve: 'Bilan élève E2E pour preuve de modale.',
        contentParent: 'Bilan parent E2E pour preuve de modale.',
        contentInterne: 'Bilan interne E2E.',
        scoreGlobal: 15,
        domainScores: { methode: 15, automatisme: 14 },
        strengths: ['Méthode structurée'],
        areasForGrowth: ['Régularité'],
        nextSteps: 'Poursuivre les entraînements ciblés.',
        isPublished: true,
        publishedAt: new Date('2026-08-28T16:00:00.000Z'),
      }
    });
  }

  // =============================================================================
  // CREATE COACH AVAILABILITIES (CRITICAL for E2E booking tests)
  // =============================================================================
  console.log('📅 Creating coach availabilities...');

  const farPast = new Date('2000-01-01T00:00:00Z');
  const allCoachUsers = [coach, coach2, zenon];

  for (const coachUser of allCoachUsers) {
    // Create recurring weekday availability (Mon-Fri, 10:00-11:00)
    const weekdaySlots = [1, 2, 3, 4, 5].map((day) => ({
      coachId: coachUser.id,
      dayOfWeek: day,
      startTime: '10:00',
      endTime: '11:00',
      specificDate: null,
      isAvailable: true,
      isRecurring: true,
      validFrom: farPast,
      validUntil: null,
    }));

    await prisma.coachAvailability.createMany({
      data: weekdaySlots,
      skipDuplicates: true,
    });

    // Create specific-date slots for the next 30 days (weekdays only)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cursor = new Date(today);

    for (let i = 0; i < 30; i++) {
      cursor.setDate(cursor.getDate() + 1);
      const day = cursor.getDay();
      if (day === 0 || day === 6) continue; // Skip weekends

      const slotDate = new Date(cursor);
      slotDate.setHours(12, 0, 0, 0);

      await prisma.coachAvailability.create({
        data: {
          coachId: coachUser.id,
          dayOfWeek: slotDate.getDay(),
          startTime: '10:00',
          endTime: '11:00',
          specificDate: slotDate,
          isAvailable: true,
          isRecurring: false,
          validFrom: slotDate,
          validUntil: null,
        },
      }).catch(() => {
        // Skip duplicates silently
      });
    }

    console.log(`  ✓ Availability created for ${coachUser.email}`);
  }
  console.log('');

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

  const todayForCoach = new Date();
  todayForCoach.setHours(15, 0, 0, 0);
  const bookingToday = await prisma.sessionBooking.create({
    data: {
      studentId: student.id,
      coachId: coach.id,
      parentId: parent.id,
      subject: Subject.MATHEMATIQUES,
      title: 'E2E Report Session',
      description: 'Today session for report dialog proof',
      scheduledDate: todayForCoach,
      startTime: '15:00',
      endTime: '16:00',
      duration: 60,
      status: 'CONFIRMED',
      creditsUsed: 1,
    },
  });
  console.log(`  ✓ Booking Today: ${student.firstName} → ${bookingToday.title} (CONFIRMED)`);

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
  console.log(`  Pending Credit Requests: ${await prisma.creditTransaction.count({ where: { type: 'CREDIT_REQUEST' } })}`);
  console.log(`  Subscriptions: ${await prisma.subscription.count()}`);
  console.log(`  Subscription Requests: ${await prisma.subscriptionRequest.count()}`);
  console.log(`  Stages: ${await prisma.stage.count()}`);
  console.log(`  Stage Bilans: ${await prisma.stageBilan.count()}`);
  console.log(`  Session Bookings: ${await prisma.sessionBooking.count()}\n`);

  console.log('🔑 Test Credentials:');
  console.log(`  Admin:   admin.${timestamp}@test.com / password123`);
  console.log(`  Student: yasmine.dupont@test.com / password123`);
  console.log(`  Student2: student2.${timestamp}@test.com / password123`);
  console.log(`  Coach:   helios@test.com / password123`);
  console.log(`  Coach2:  coach2.${timestamp}@test.com / password123\n`);
  console.log(`  Assistante: assistante.${timestamp}@test.com / password123\n`);

  // Write credentials to file for E2E tests
  const credentials = {
    admin: { email: `admin.${timestamp}@test.com`, password: 'password123' },
    parent: { email: `parent.${timestamp}@test.com`, password: 'password123' },
    student: { email: studentEmail, password: 'password123' }, // yasmine.dupont@test.com
    student2: { email: `student2.${timestamp}@test.com`, password: 'password123' },
    studentSurvival: { email: `student-survival.${timestamp}@test.com`, password: 'password123' },
    coach: { email: coachEmail, password: 'password123' }, // helios@test.com
    coach2: { email: `coach2.${timestamp}@test.com`, password: 'password123' },
    assistante: { email: `assistante.${timestamp}@test.com`, password: 'password123' },
    zenon: { email: 'zenon@test.com', password: 'password123' }, // For E2E booking flow
  };
  const fs = require('fs');
  fs.writeFileSync('e2e/.credentials.json', JSON.stringify(credentials, null, 2));
  console.log('✅ Credentials written to e2e/.credentials.json');

  console.log('🧪 Ready for E2E tests!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding E2E database:');
    console.error(serializeError(e));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
