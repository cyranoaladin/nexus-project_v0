import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  const password = 'password123';
  const hashedPassword = await bcrypt.hash(password, 12);

  // RESET database to ensure deterministic state for tests/dev
  // Use Prisma deleteMany in FK-safe order to avoid table name mismatches
  try {
    await prisma.$transaction([
      prisma.sessionNotification.deleteMany({}),
      prisma.sessionReminder.deleteMany({}),
      prisma.sessionBooking.deleteMany({}),
      prisma.notification.deleteMany({}),
      prisma.ariaMessage.deleteMany({}),
      prisma.ariaConversation.deleteMany({}),
      prisma.creditTransaction.deleteMany({}),
      prisma.studentBadge.deleteMany({}),
      prisma.studentReport.deleteMany({}),
      prisma.subscriptionRequest.deleteMany({}),
      prisma.payment.deleteMany({}),
      prisma.subscription.deleteMany({}),
      prisma.session.deleteMany({}),
      prisma.pedagogicalContent.deleteMany({}),
      prisma.coachAvailability.deleteMany({}),
      prisma.coachProfile.deleteMany({}),
      prisma.parentProfile.deleteMany({}),
      prisma.studentProfile.deleteMany({}),
      prisma.student.deleteMany({}),
      prisma.message.deleteMany({}),
      prisma.badge.deleteMany({}),
      prisma.user.deleteMany({}),
    ]);
  } catch (e) {
    console.warn('WARN seed reset failed (continuing):', e);
  }

  // --- 1. Admin User ---
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nexus.com' },
    update: {},
    create: {
      email: 'admin@nexus.com',
      password: hashedPassword,
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'Nexus',
    },
  });

  // --- 2. Assistant User ---
  const assistant = await prisma.user.upsert({
    where: { email: 'assistante@nexus.com' },
    update: {},
    create: {
      email: 'assistante@nexus.com',
      password: hashedPassword,
      firstName: 'Assistante',
      lastName: 'Nexus',
      role: 'ASSISTANTE',
    },
  });

  // 3. Création des Coachs
  const coachesData = [
    {
      email: 'helios@nexus.com',
      firstName: 'Hélios',
      lastName: 'Mathieu',
      pseudonym: 'Hélios',
      subjects: ['MATHEMATIQUES', 'NSI'],
    },
    {
      email: 'zenon@nexus.com',
      firstName: 'Zénon',
      lastName: 'Eloquence',
      pseudonym: 'Zénon',
      subjects: ['FRANCAIS', 'PHILOSOPHIE'],
    },
    {
      email: 'newton@nexus.com',
      firstName: 'Isaac',
      lastName: 'Newton',
      pseudonym: 'Newton',
      subjects: ['PHYSIQUE_CHIMIE'],
    },
  ];

  for (const coachData of coachesData) {
    const coachUser = await prisma.user.upsert({
      where: { email: coachData.email },
      update: {},
      create: {
        email: coachData.email,
        password: hashedPassword,
        firstName: coachData.firstName,
        lastName: coachData.lastName,
        role: 'COACH',
      },
    });

    await prisma.coachProfile.upsert({
      where: { userId: coachUser.id },
      update: {
        pseudonym: coachData.pseudonym,
        subjects: JSON.stringify(coachData.subjects),
      },
      create: {
        userId: coachUser.id,
        pseudonym: coachData.pseudonym,
        subjects: JSON.stringify(coachData.subjects),
      },
    });
  }

  // Ensure a coach exists for every subject
  const allSubjects =
    (await prisma.$queryRaw`SELECT unnest(enum_range(NULL::"Subject"))::text as s`) as
      | { s: string }[]
      | undefined;
  if (allSubjects && allSubjects.length) {
    for (const { s } of allSubjects) {
      const email = `coach_${s.toLowerCase()}@nexus.com`;
      const exists = await prisma.user.findUnique({ where: { email } });
      if (!exists) {
        const coachUser = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            role: 'COACH',
            firstName: 'Coach',
            lastName: s.replace('_', ' '),
          },
        });
        await prisma.coachProfile.create({
          data: {
            userId: coachUser.id,
            pseudonym: `Coach-${s}`,
            subjects: JSON.stringify([s]),
            title: 'Professeur Certifié',
            tag: '🎓 Expert',
            description: `Expert de ${s}`,
          },
        });
      }
    }
  }

  // 4.b Parents additionnels et abonnements variés
  for (let i = 1; i <= 5; i++) {
    const parentUser = await prisma.user.upsert({
      where: { email: `parent-test-${i}@nexus.com` },
      update: {},
      create: {
        email: `parent-test-${i}@nexus.com`,
        password: hashedPassword,
        firstName: `ParentTest`,
        lastName: `${i}`,
        role: 'PARENT',
      },
    });

    const parentProfile = await prisma.parentProfile.upsert({
      where: { userId: parentUser.id },
      update: {},
      create: {
        user: {
          connect: {
            id: parentUser.id,
          },
        },
      },
    });

    const studentUser = await prisma.user.upsert({
      where: { email: `eleve-test-${i}@nexus.com` },
      update: {},
      create: {
        email: `eleve-test-${i}@nexus.com`,
        password: hashedPassword,
        firstName: `EleveTest`,
        lastName: `${i}`,
        role: 'ELEVE',
      },
    });

    const student = await prisma.student.upsert({
      where: { userId: studentUser.id },
      update: {},
      create: {
        user: { connect: { id: studentUser.id } },
        parent: { connect: { id: parentProfile.id } },
        grade: ['Seconde', 'Première', 'Terminale'][i % 3],
        credits: i % 2 === 0 ? 5 : 0,
      },
    });

    // Créer des abonnements variés (aucun, simple ARIA, multi-ARIA)
    if (i % 3 !== 0) {
      const plan = i % 2 === 0 ? 'HYBRIDE' : 'ACCES_PLATEFORME';
      const ariaSubjects = i % 2 === 0 ? ['MATHEMATIQUES', 'ANGLAIS'] : ['MATHEMATIQUES'];
      const status = i % 4 === 0 ? 'CANCELLED' : i % 5 === 0 ? 'EXPIRED' : 'ACTIVE';
      await prisma.subscription.create({
        data: {
          studentId: student.id,
          planName: plan,
          monthlyPrice: plan === 'HYBRIDE' ? 250 : 120,
          creditsPerMonth: plan === 'HYBRIDE' ? 8 : 4,
          status: status as any,
          startDate: new Date(Date.now() - 7 * 24 * 3600 * 1000),
          ariaSubjects: JSON.stringify(ariaSubjects),
          ariaCost: ariaSubjects.length * 30,
        },
      });
    }
  }

  // 6. Payments répartis sur 2 mois
  const now = new Date();
  const lastMonth = new Date(now);
  lastMonth.setMonth(now.getMonth() - 1);
  await prisma.payment.createMany({
    data: [
      {
        userId: admin.id,
        type: 'SUBSCRIPTION',
        amount: 300,
        currency: 'TND',
        description: 'Revenus mois en cours',
        status: 'COMPLETED',
        method: 'manual',
        createdAt: now,
      },
      {
        userId: admin.id,
        type: 'CREDIT_PACK',
        amount: 80,
        currency: 'TND',
        description: 'Crédits',
        status: 'COMPLETED',
        method: 'manual',
        createdAt: now,
      },
      {
        userId: admin.id,
        type: 'SUBSCRIPTION',
        amount: 200,
        currency: 'TND',
        description: 'Revenus mois dernier',
        status: 'COMPLETED',
        method: 'manual',
        createdAt: lastMonth,
      },
      {
        userId: admin.id,
        type: 'SUBSCRIPTION',
        amount: 150,
        currency: 'TND',
        description: 'Paiement en anomalie',
        status: 'FAILED',
        method: 'manual',
        createdAt: now,
      },
    ],
  });

  // 7. Sessions récentes
  const anyCoachProfile = await prisma.coachProfile.findFirst();
  const anyStudent = await prisma.student.findFirst();
  if (anyCoachProfile && anyStudent) {
    const scheduledAt = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
    await prisma.session.createMany({
      data: [
        {
          studentId: anyStudent.id,
          coachId: anyCoachProfile.id,
          type: 'COURS_ONLINE',
          subject: 'MATHEMATIQUES',
          title: 'Révisions dérivées',
          scheduledAt,
          duration: 60,
          creditCost: 1,
          status: 'COMPLETED',
        },
        {
          studentId: anyStudent.id,
          coachId: anyCoachProfile.id,
          type: 'COURS_ONLINE',
          subject: 'ANGLAIS',
          title: 'Grammar',
          scheduledAt: now,
          duration: 60,
          creditCost: 1,
          status: 'SCHEDULED',
        },
      ],
    });
  }

  // 8. Transactions de crédits pour alimenter les métriques
  if (anyStudent) {
    await prisma.creditTransaction.createMany({
      data: [
        {
          studentId: anyStudent.id,
          type: 'MONTHLY_ALLOCATION',
          amount: 8,
          description: 'Allocation mensuelle',
        },
        { studentId: anyStudent.id, type: 'USAGE', amount: -1, description: 'Cours maths' },
      ],
    });
  }

  // 9. Contenus pédagogiques (RAG) de démonstration
  await prisma.pedagogicalContent.createMany({
    data: [
      {
        title: 'Probabilités conditionnelles',
        content: '# Probabilités conditionnelles\nDéfinition: ...',
        subject: 'MATHEMATIQUES',
        grade: 'Terminale',
        embedding: '[]',
        tags: '["probabilites","conditionnelles"]',
      },
      {
        title: 'Programmation fonctionnelle en NSI',
        content: '# Map/Filter/Reduce\nExemples en Python...',
        subject: 'NSI',
        grade: 'Terminale',
        embedding: '[]',
        tags: '["nsi","python"]',
      },
    ],
  });

  console.log(`Seeding finished.`);
}

async function seedPayments() {
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@nexus.com' } });
  if (adminUser) {
    await prisma.payment.upsert({
      where: { id: 'seed-payment-1' }, // Use a predictable ID to make it idempotent
      update: {},
      create: {
        id: 'seed-payment-1',
        userId: adminUser.id,
        amount: 100,
        status: 'COMPLETED',
        method: 'TEST',
        type: 'SPECIAL_PACK',
        description: 'Paiement de test initial',
        externalId: 'seed-payment-1',
      },
    });
  }
}

main()
  .then(async () => {
    await seedPayments();
    await extendedSeeds();
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

// --- Extended Seeds for comprehensive scenarios ---
async function extendedSeeds() {
  // Create badge catalog
  const badges = await prisma.badge.createMany({
    data: [
      {
        name: 'ASSIDUITE_BRONZE',
        description: '3 sessions suivies',
        category: 'ASSIDUITE',
        icon: '🥉',
        condition: '3_sessions',
      },
      {
        name: 'ASSIDUITE_ARGENT',
        description: '6 sessions suivies',
        category: 'ASSIDUITE',
        icon: '🥈',
        condition: '6_sessions',
      },
      {
        name: 'PROGRESSION_1',
        description: 'Amélioration notable',
        category: 'PROGRESSION',
        icon: '📈',
        condition: 'progress_1',
      },
      {
        name: 'CURIOSITE',
        description: 'Participe activement',
        category: 'CURIOSITE',
        icon: '🧠',
        condition: 'curiosity',
      },
    ],
    skipDuplicates: true,
  });

  // Ensure we have at least one coach per Subject (already ensured above), add availability for first three coaches (robust)
  let someCoaches = await prisma.user.findMany({
    where: { role: 'COACH' },
    take: 3,
    include: { coachProfile: true } as any,
  });
  if (!someCoaches.length) {
    const fallbackCoach = await prisma.user.create({
      data: {
        email: 'coach.fallback@nexus.com',
        password: await bcrypt.hash('password123', 12),
        role: 'COACH',
        firstName: 'Coach',
        lastName: 'Fallback',
      },
    });
    const fallbackProfile = await prisma.coachProfile.create({
      data: {
        userId: fallbackCoach.id,
        pseudonym: 'Fallback',
        subjects: JSON.stringify(['MATHEMATIQUES']),
      },
    });
    someCoaches = [{ ...fallbackCoach, coachProfile: fallbackProfile } as any];
  }
  for (const coach of someCoaches) {
    try {
      // Use coach user id for CoachAvailability.coachId (references User)
      const coachUserId = (coach as any)?.id;
      if (!coachUserId) continue;

      // Reset existing availabilities for deterministic state
      await prisma.coachAvailability.deleteMany({ where: { coachId: coachUserId } });

      const createData: any[] = [];
      // 3 recurring slots Mon/Wed/Fri
      for (const d of [1, 3, 5]) {
        createData.push({
          coachId: coachUserId,
          dayOfWeek: d,
          startTime: '14:00',
          endTime: '18:00',
          isRecurring: true,
          isAvailable: true,
        });
      }
      // Extra recurring slots Tue/Thu morning
      for (const d of [2, 4]) {
        createData.push({
          coachId: coachUserId,
          dayOfWeek: d,
          startTime: '09:00',
          endTime: '12:00',
          isRecurring: true,
          isAvailable: true,
        });
      }
      // Saturday morning
      createData.push({
        coachId: coachUserId,
        dayOfWeek: 6,
        startTime: '09:00',
        endTime: '12:00',
        isRecurring: true,
        isAvailable: true,
      });
      // one specific date blocked
      const blocked = new Date(Date.now() + 2 * 24 * 3600 * 1000);
      createData.push({
        coachId: coachUserId,
        dayOfWeek: blocked.getDay(),
        startTime: '00:00',
        endTime: '23:59',
        specificDate: blocked,
        isAvailable: false,
        isRecurring: false,
      });
      // Specific available dates for next 3 days (two slots per day)
      for (let i = 1; i <= 3; i++) {
        const d = new Date(Date.now() + i * 24 * 3600 * 1000);
        createData.push({
          coachId: coachUserId,
          dayOfWeek: d.getDay(),
          startTime: '10:00',
          endTime: '12:00',
          specificDate: d,
          isAvailable: true,
          isRecurring: false,
        });
        createData.push({
          coachId: coachUserId,
          dayOfWeek: d.getDay(),
          startTime: '15:00',
          endTime: '17:00',
          specificDate: d,
          isAvailable: true,
          isRecurring: false,
        });
      }

      await prisma.coachAvailability.createMany({ data: createData, skipDuplicates: true });
    } catch (e) {
      console.warn('WARN availability create skipped for coach', (coach as any)?.id, e);
    }
  }

  // Build a parent with 3 children in varied subscription states
  const parentVar = await prisma.user.create({
    data: {
      email: 'parent.variations@nexus.com',
      password: await bcrypt.hash('password123', 12),
      role: 'PARENT',
      firstName: 'Parent',
      lastName: 'Variations',
    },
  });
  const parentVarProfile = await prisma.parentProfile.create({ data: { userId: parentVar.id } });

  // Child A: ACTIVE immersion + multi-ARIA + credits
  const childAUser = await prisma.user.create({
    data: {
      email: 'enfantA@nexus.com',
      password: await bcrypt.hash('password123', 12),
      role: 'ELEVE',
      firstName: 'A',
      lastName: 'Var',
    },
  });
  const childA = await prisma.student.create({
    data: {
      userId: childAUser.id,
      parentId: parentVarProfile.id,
      grade: 'Terminale',
      credits: 10,
      subscriptions: {
        create: {
          planName: 'IMMERSION',
          monthlyPrice: 750,
          creditsPerMonth: 8,
          status: 'ACTIVE',
          startDate: new Date(),
          ariaSubjects: JSON.stringify(['MATHEMATIQUES', 'NSI']),
          ariaCost: 60,
        },
      },
    },
  });

  // Child B: CANCELLED hybride + zero credits
  const childBUser = await prisma.user.create({
    data: {
      email: 'enfantB@nexus.com',
      password: await bcrypt.hash('password123', 12),
      role: 'ELEVE',
      firstName: 'B',
      lastName: 'Var',
    },
  });
  const childB = await prisma.student.create({
    data: {
      userId: childBUser.id,
      parentId: parentVarProfile.id,
      grade: 'Première',
      credits: 0,
      subscriptions: {
        create: {
          planName: 'HYBRIDE',
          monthlyPrice: 450,
          creditsPerMonth: 8,
          status: 'CANCELLED',
          startDate: new Date(Date.now() - 60 * 24 * 3600 * 1000),
          endDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
        },
      },
    },
  });

  // Child C: EXPIRED accès plateforme + ARIA one subject + subscription request pending
  const childCUser = await prisma.user.create({
    data: {
      email: 'enfantC@nexus.com',
      password: await bcrypt.hash('password123', 12),
      role: 'ELEVE',
      firstName: 'C',
      lastName: 'Var',
    },
  });
  const childC = await prisma.student.create({
    data: {
      userId: childCUser.id,
      parentId: parentVarProfile.id,
      grade: 'Seconde',
      credits: 2,
      subscriptions: {
        create: {
          planName: 'ACCES_PLATEFORME',
          monthlyPrice: 120,
          creditsPerMonth: 4,
          status: 'EXPIRED',
          startDate: new Date(Date.now() - 60 * 24 * 3600 * 1000),
          endDate: new Date(Date.now() - 1 * 24 * 3600 * 1000),
          ariaSubjects: JSON.stringify(['ANGLAIS']),
          ariaCost: 30,
        },
      },
    },
  });
  await prisma.subscriptionRequest.create({
    data: {
      studentId: childC.id,
      requestType: 'PLAN_CHANGE',
      monthlyPrice: 250,
      reason: 'Upgrade',
      status: 'PENDING',
      requestedBy: parentVar.id,
      requestedByEmail: parentVar.email,
    },
  });

  // Freemium usage edge-cases
  await prisma.student.update({
    where: { id: childA.id },
    data: {
      freemiumUsage: { requestsToday: 5, date: new Date().toISOString().split('T')[0] } as any,
    },
  });
  await prisma.student.update({
    where: { id: childB.id },
    data: {
      freemiumUsage: { requestsToday: 0, date: new Date().toISOString().split('T')[0] } as any,
    },
  });

  // Payments covering all statuses/types
  await prisma.payment.createMany({
    data: [
      {
        userId: parentVar.id,
        type: 'SUBSCRIPTION',
        amount: 250,
        description: 'Hybride mois en cours',
        status: 'PENDING',
        method: 'konnect',
      },
      {
        userId: parentVar.id,
        type: 'CREDIT_PACK',
        amount: 100,
        description: 'Pack crédits',
        status: 'REFUNDED',
        method: 'manual',
      },
      {
        userId: parentVar.id,
        type: 'SPECIAL_PACK',
        amount: 150,
        description: 'Pack spécial',
        status: 'COMPLETED',
        method: 'manual',
      },
    ],
  });

  // SessionBookings with full spectrum + reminders + notifications
  const coachProfile = await prisma.coachProfile.findFirst();
  const coachUserIdForBooking = coachProfile?.userId;
  const makeBooking = async (
    studentId: string,
    status: any,
    type: any,
    modality: any,
    offsetDays: number
  ) => {
    if (!coachUserIdForBooking) return;
    const sb = await prisma.sessionBooking.create({
      data: {
        studentId,
        coachId: coachUserIdForBooking,
        subject: 'MATHEMATIQUES',
        title: `Session ${status}`,
        description: 'Séance de test',
        scheduledDate: new Date(Date.now() + offsetDays * 24 * 3600 * 1000),
        startTime: '15:00',
        endTime: '16:00',
        duration: 60,
        status,
        type,
        modality,
        meetingUrl: modality === 'ONLINE' ? 'https://meet.jit.si/demo' : null,
        location: modality !== 'ONLINE' ? 'Campus Tunis' : null,
      },
    });
    await prisma.sessionReminder.create({
      data: {
        sessionId: sb.id,
        reminderType: 'ONE_DAY_BEFORE',
        scheduledFor: new Date(sb.scheduledDate.getTime() - 24 * 3600 * 1000),
      },
    });
    await prisma.sessionNotification.create({
      data: {
        sessionId: sb.id,
        userId: parentVar.id,
        type: 'SESSION_BOOKED',
        title: 'Session réservée',
        message: 'Votre session est réservée',
        method: 'EMAIL',
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  };
  await makeBooking(childA.userId, 'SCHEDULED', 'INDIVIDUAL', 'ONLINE', 2);
  await makeBooking(childB.userId, 'CONFIRMED', 'GROUP', 'IN_PERSON', 3);
  await makeBooking(childC.userId, 'COMPLETED', 'MASTERCLASS', 'HYBRID', -1);

  // Generic notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: parentVar.id,
        userRole: 'PARENT',
        type: 'SUBSCRIPTION_REQUEST',
        title: 'Demande en attente',
        message: 'Votre demande de changement est en attente.',
        data: '{}',
      },
      {
        userId: childAUser.id,
        userRole: 'ELEVE',
        type: 'CREDIT_REQUEST',
        title: 'Crédits bas',
        message: 'Pense à recharger tes crédits.',
        data: '{}',
      },
    ],
  });

  // Badges attribution
  const curio = await prisma.badge.findFirst({ where: { name: 'CURIOSITE' } });
  if (curio) {
    await prisma.studentBadge.createMany({ data: [{ studentId: childA.id, badgeId: curio.id }] });
  }

  // More ARIA conversations/messages with feedback variations
  const conv = await prisma.ariaConversation.create({
    data: { studentId: childA.id, subject: 'ANGLAIS', title: 'Vocabulaire' },
  });
  await prisma.ariaMessage.createMany({
    data: [
      {
        conversationId: conv.id,
        role: 'USER',
        content: "Peux-tu m'expliquer les phrasal verbs ?",
        feedback: true,
      },
      {
        conversationId: conv.id,
        role: 'ASSISTANT',
        content: 'Bien sûr, commençons par...',
        feedback: false,
      },
    ],
  });

  // Credit transactions edge cases
  await prisma.creditTransaction.createMany({
    data: [
      { studentId: childB.id, type: 'PURCHASE', amount: 5, description: 'Achat pack' },
      {
        studentId: childB.id,
        type: 'EXPIRATION',
        amount: -2,
        description: 'Expiration crédits',
        expiresAt: new Date(),
      },
      { studentId: childC.id, type: 'REFUND', amount: 1, description: 'Remboursement' },
    ],
  });

  // Additional pedagogical content across subjects
  await prisma.pedagogicalContent.createMany({
    data: [
      {
        title: 'Analyse syntaxique en Français',
        content: '# Grammaire...',
        subject: 'FRANCAIS',
        grade: 'Première',
        tags: '["grammaire"]',
        embedding: '[]',
      },
      {
        title: 'Guerres mondiales',
        content: '# Histoire...',
        subject: 'HISTOIRE_GEO',
        grade: 'Terminale',
        tags: '["20e_siecle"]',
        embedding: '[]',
      },
      {
        title: 'Photosynthèse',
        content: '# SVT...',
        subject: 'SVT',
        grade: 'Seconde',
        tags: '["biologie"]',
        embedding: '[]',
      },
    ],
  });
}

// extendedSeeds is now called after main + seedPayments in the promise chain above
