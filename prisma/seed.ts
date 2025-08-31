import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  const password = 'password123';
  const hashedPassword = await bcrypt.hash(password, 12);

  // RESET database to ensure deterministic state for tests
  try {
    const tables = [
      'session_notifications',
      'session_reminders',
      'session_bookings',
      'notifications',
      'aria_messages',
      'aria_conversations',
      'credit_transactions',
      'student_badges',
      'student_reports',
      'subscription_requests',
      'payments',
      'subscriptions',
      'sessions',
      'pedagogical_contents',
      'coach_profiles',
      'parent_profiles',
      'student_profiles',
      'students',
      'messages',
      'badges',
      'users',
      'product_pricing'
    ];
    for (const t of tables) {
      try {
        // Truncate only if the table exists in public schema
        await prisma.$executeRawUnsafe(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='${t}') THEN EXECUTE 'TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE'; END IF; END $$;`);
      } catch {}
    }
  } catch (e) {
    // Silence reset errors entirely to avoid noisy logs during E2E
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
    { email: 'helios@nexus.com', firstName: 'Hélios', lastName: 'Mathieu', pseudonym: 'Hélios', subjects: ['MATHEMATIQUES', 'NSI'] },
    { email: 'zenon@nexus.com', firstName: 'Zénon', lastName: 'Eloquence', pseudonym: 'Zénon', subjects: ['FRANCAIS', 'PHILOSOPHIE'] },
    { email: 'newton@nexus.com', firstName: 'Isaac', lastName: 'Newton', pseudonym: 'Newton', subjects: ['PHYSIQUE_CHIMIE'] },
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
  const allSubjects = (await prisma.$queryRaw`SELECT unnest(enum_range(NULL::"Subject"))::text as s`) as { s: string; }[] | undefined;
  if (allSubjects && allSubjects.length) {
    for (const { s } of allSubjects) {
      const email = `coach_${s.toLowerCase()}@nexus.com`;
      const exists = await prisma.user.findUnique({ where: { email } });
      if (!exists) {
        const coachUser = await prisma.user.create({
          data: { email, password: hashedPassword, role: 'COACH', firstName: 'Coach', lastName: s.replace('_', ' ') }
        });
        await prisma.coachProfile.create({
          data: {
            userId: coachUser.id,
            pseudonym: `Coach-${s}`,
            subjects: JSON.stringify([s]),
            title: 'Professeur Certifié', tag: '🎓 Expert', description: `Expert de ${s}`,
          }
        });
      }
    }
  }

  // 3. Création des Parents et Élèves

  // Parent 1 (Dupont) avec 2 enfants, dont 1 premium + ARIA+
  const parent1 = await prisma.user.upsert({
    where: { email: 'parent.dupont@nexus.com' },
    update: {},
    create: {
      email: 'parent.dupont@nexus.com',
      password: hashedPassword,
      firstName: 'Jean',
      lastName: 'Dupont',
      role: 'PARENT',
    },
  });
  const parent1Profile = await prisma.parentProfile.upsert({
    where: { userId: parent1.id },
    update: {},
    create: { userId: parent1.id },
  });

  // Enfant 1 : Élève Premium (Marie Dupont) Terminale, ARIA+ Math & Physique
  const marieUser = await prisma.user.upsert({
    where: { email: 'marie.dupont@nexus.com' },
    update: {},
    create: {
      email: 'marie.dupont@nexus.com',
      password: hashedPassword,
      firstName: 'Marie',
      lastName: 'Dupont',
      role: 'ELEVE',
    },
  });
  const marie = await prisma.student.upsert({
    where: { userId: marieUser.id },
    update: {
      credits: 4,
    },
    create: {
      userId: marieUser.id,
      parentId: parent1Profile.id,
      grade: 'Terminale',
      credits: 4,
      guaranteeEligible: true,
      guaranteeActivatedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      subscriptions: {
        create: {
          planName: 'HYBRIDE',
          monthlyPrice: 450,
          creditsPerMonth: 8,
          status: 'ACTIVE',
          startDate: new Date(Date.now() - 15 * 24 * 3600 * 1000),
          endDate: new Date(Date.now() + 15 * 24 * 3600 * 1000),
          ariaSubjects: JSON.stringify(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE']),
          ariaCost: 80,
        },
      },
    },
  });

  // Historique ARIA de Marie (conversations/messages en Mathématiques)
  const marieConv = await prisma.ariaConversation.create({
    data: { studentId: marie.id, subject: 'MATHEMATIQUES', title: 'Révisions proba' }
  });
  await prisma.ariaMessage.createMany({
    data: [
      { conversationId: marieConv.id, role: 'USER', content: 'Peux-tu m\'expliquer les probabilités conditionnelles ?' },
      { conversationId: marieConv.id, role: 'ASSISTANT', content: 'Bien sûr, commençons par la définition et un exemple.' },
      { conversationId: marieConv.id, role: 'USER', content: 'Et pour les lois binomiales, comment calcule-t-on une probabilité exacte ?' },
      { conversationId: marieConv.id, role: 'ASSISTANT', content: 'Utilise la formule C(n,k) p^k (1-p)^{n-k}. Donne-moi n, k, p.' },
      { conversationId: marieConv.id, role: 'USER', content: 'n=10, k=3, p=0,2' },
      { conversationId: marieConv.id, role: 'ASSISTANT', content: 'Très bien, calculons étape par étape…' },
    ]
  });

  // Enfant 2 : Élève Freemium (Lucas Dupont) Première, sans abonnement
  const lucasUser = await prisma.user.upsert({
    where: { email: 'lucas.dupont@nexus.com' },
    update: {},
    create: {
      email: 'lucas.dupont@nexus.com',
      password: hashedPassword,
      firstName: 'Lucas',
      lastName: 'Dupont',
      role: 'ELEVE',
    },
  });
  await prisma.student.upsert({
    where: { userId: lucasUser.id },
    update: {},
    create: {
      userId: lucasUser.id,
      parentId: parent1Profile.id,
      grade: 'Première',
      credits: 0,
      freemiumUsage: { requestsToday: 5, date: new Date().toISOString().split('T')[0] } as unknown as any,
    },
  });

  // Compte Élève Candidat Libre (Terminale) avec ARIA+ NSI
  const candLibreUser = await prisma.user.upsert({
    where: { email: 'candidat.libre@nexus.com' },
    update: {},
    create: {
      email: 'candidat.libre@nexus.com',
      password: hashedPassword,
      firstName: 'Candidat',
      lastName: 'Libre',
      role: 'ELEVE',
    },
  });
  // Parent fictif requis par le schéma
  const parentFictif = await prisma.user.upsert({
    where: { email: 'parent.candidat@nexus.com' },
    update: {},
    create: { email: 'parent.candidat@nexus.com', password: hashedPassword, role: 'PARENT', firstName: 'Tuteur', lastName: 'Libre' }
  });
  const parentFictifProfile = await prisma.parentProfile.upsert({ where: { userId: parentFictif.id }, update: {}, create: { userId: parentFictif.id } });
  await prisma.student.upsert({
    where: { userId: candLibreUser.id },
    update: {},
    create: {
      userId: candLibreUser.id,
      parentId: parentFictifProfile.id,
      grade: 'Terminale',
      credits: 2,
      guaranteeEligible: true,
      guaranteeActivatedAt: new Date(Date.now() - 20 * 24 * 3600 * 1000),
      subscriptions: { create: { planName: 'IMMERSION', monthlyPrice: 750, creditsPerMonth: 8, status: 'ACTIVE', startDate: new Date(Date.now() - 20 * 24 * 3600 * 1000), ariaSubjects: JSON.stringify(['NSI']), ariaCost: 50 } }
    }
  });

  // Parent 2 (Martin) avec 1 enfant (Abonnement Immersion, sans ARIA+)
  const parent2 = await prisma.user.upsert({
    where: { email: 'parent.martin@nexus.com' },
    update: {},
    create: {
      email: 'parent.martin@nexus.com',
      password: hashedPassword,
      firstName: 'Sophie',
      lastName: 'Martin',
      role: 'PARENT',
    },
  });
  const parent2Profile = await prisma.parentProfile.upsert({
    where: { userId: parent2.id },
    update: {},
    create: { userId: parent2.id },
  });
  const student2_1 = await prisma.user.upsert({
    where: { email: 'eleve.leo.martin@nexus.com' },
    update: {},
    create: {
      email: 'eleve.leo.martin@nexus.com',
      password: hashedPassword,
      firstName: 'Léo',
      lastName: 'Martin',
      role: 'ELEVE',
    },
  });
  await prisma.student.upsert({
    where: { userId: student2_1.id },
    update: {
      credits: 8,
    },
    create: {
      userId: student2_1.id,
      parentId: parent2Profile.id,
      grade: 'Première',
      credits: 8,
      subscriptions: {
        create: {
          planName: 'IMMERSION',
          monthlyPrice: 750,
          creditsPerMonth: 8,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
          ariaSubjects: JSON.stringify(['MATHEMATIQUES']),
        },
      },
    },
  });

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
      const status = i % 4 === 0 ? 'CANCELLED' : (i % 5 === 0 ? 'EXPIRED' : 'ACTIVE');
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
        }
      });
    }
  }

  // Pricing seeds (ProductPricing)
  const pricings = [
    { itemType: 'SUBSCRIPTION', itemKey: 'ACCES_PLATEFORME', amount: 120, description: 'Abonnement Accès Plateforme' },
    { itemType: 'SUBSCRIPTION', itemKey: 'HYBRIDE', amount: 450, description: 'Abonnement Hybride' },
    { itemType: 'SUBSCRIPTION', itemKey: 'IMMERSION', amount: 750, description: 'Abonnement Immersion' },
    { itemType: 'ADDON', itemKey: 'ARIA_SUBJECT', amount: 40, description: 'Add-on ARIA par matière' },
    { itemType: 'PACK', itemKey: 'CREDITS_5', amount: 100, description: 'Pack 5 crédits' },
    { itemType: 'PACK', itemKey: 'CREDITS_10', amount: 180, description: 'Pack 10 crédits' },
    { itemType: 'PACK', itemKey: 'CREDITS_20', amount: 340, description: 'Pack 20 crédits' },
  ] as const;

  for (const p of pricings) {
    try {
      await prisma.productPricing.upsert({
        where: { itemType_itemKey: { itemType: p.itemType, itemKey: p.itemKey } as any },
        update: { amount: p.amount, description: p.description, active: true },
        create: { itemType: p.itemType, itemKey: p.itemKey, amount: p.amount, description: p.description },
      } as any);
    } catch (e) {
      // ignore if constraint differs in dev
    }
  }

  // 6. Payments répartis sur 2 mois
  const now = new Date();
  const lastMonth = new Date(now); lastMonth.setMonth(now.getMonth() - 1);
  await prisma.payment.createMany({
    data: [
      { userId: admin.id, type: 'SUBSCRIPTION', amount: 300, currency: 'TND', description: 'Revenus mois en cours', status: 'COMPLETED', method: 'manual', createdAt: now },
      { userId: admin.id, type: 'CREDIT_PACK', amount: 80, currency: 'TND', description: 'Crédits', status: 'COMPLETED', method: 'manual', createdAt: now },
      { userId: admin.id, type: 'SUBSCRIPTION', amount: 200, currency: 'TND', description: 'Revenus mois dernier', status: 'COMPLETED', method: 'manual', createdAt: lastMonth },
      { userId: admin.id, type: 'SUBSCRIPTION', amount: 150, currency: 'TND', description: 'Paiement en anomalie', status: 'FAILED', method: 'manual', createdAt: now },
    ]
  });

  // 7. Sessions récentes
  const anyCoach = await prisma.coachProfile.findFirst();
  const anyStudent = await prisma.student.findFirst();
  if (anyCoach && anyStudent) {
    const scheduledAt = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
    await prisma.session.createMany({
      data: [
        { studentId: anyStudent.id, coachId: anyCoach.id, type: 'COURS_ONLINE', subject: 'MATHEMATIQUES', title: 'Révisions dérivées', scheduledAt, duration: 60, creditCost: 1, status: 'COMPLETED' },
        { studentId: anyStudent.id, coachId: anyCoach.id, type: 'COURS_ONLINE', subject: 'ANGLAIS', title: 'Grammar', scheduledAt: now, duration: 60, creditCost: 1, status: 'SCHEDULED' },
      ]
    });
  }

  // 8. Transactions de crédits pour alimenter les métriques
  await prisma.creditTransaction.createMany({
    data: [
      { studentId: marie.id, type: 'MONTHLY_ALLOCATION', amount: 8, description: 'Allocation mensuelle' },
      { studentId: marie.id, type: 'USAGE', amount: -1, description: 'Cours maths' },
    ]
  });

  // 9. Contenus pédagogiques (RAG) de démonstration
  await prisma.pedagogicalContent.createMany({
    data: [
      { title: 'Probabilités conditionnelles', content: '# Probabilités conditionnelles\nDéfinition: ...', subject: 'MATHEMATIQUES', grade: 'Terminale', embedding: '[]', tags: '["probabilites","conditionnelles"]' },
      { title: 'Programmation fonctionnelle en NSI', content: '# Map/Filter/Reduce\nExemples en Python...', subject: 'NSI', grade: 'Terminale', embedding: '[]', tags: '["nsi","python"]' },
    ]
  });

  // 10. Coach availabilities pour quelques coachs
  const someCoaches = await prisma.user.findMany({ where: { role: 'COACH' }, take: 3 });
  for (const coach of someCoaches) {
    try {
      await prisma.coachAvailability.upsert({
        where: {
          // composite via unique([...])
          coachId_dayOfWeek_startTime_endTime_specificDate: {
            coachId: coach.id,
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '17:00',
            specificDate: null,
          } as any,
        },
        update: {},
        create: {
          coachId: coach.id,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
          isAvailable: true,
          isRecurring: true,
        },
      });
    } catch {}
  }

  // 11. Session booking + notifications/reminders
  const studentUserAny = await prisma.user.findFirst({ where: { role: 'ELEVE' } });
  const parentUserAny = await prisma.user.findFirst({ where: { role: 'PARENT' } });
  const coachUserAny = await prisma.user.findFirst({ where: { role: 'COACH' } });
  if (studentUserAny && coachUserAny) {
    const booking = await prisma.sessionBooking.create({
      data: {
        studentId: studentUserAny.id,
        coachId: coachUserAny.id,
        parentId: parentUserAny?.id,
        subject: 'MATHEMATIQUES' as any,
        title: 'Séance de test',
        scheduledDate: new Date(Date.now() + 24 * 3600 * 1000),
        startTime: '14:00',
        endTime: '15:00',
        duration: 60,
        status: 'SCHEDULED' as any,
        type: 'INDIVIDUAL' as any,
        modality: 'ONLINE' as any,
        creditsUsed: 1,
      }
    });
    await prisma.sessionNotification.create({
      data: {
        sessionId: booking.id,
        userId: studentUserAny.id,
        type: 'SESSION_BOOKED' as any,
        title: 'Réservation créée',
        message: 'Votre session a été planifiée.',
        method: 'EMAIL' as any,
      }
    });
    await prisma.sessionReminder.create({
      data: {
        sessionId: booking.id,
        reminderType: 'ONE_DAY_BEFORE' as any,
        scheduledFor: new Date(Date.now() + 23 * 3600 * 1000),
      }
    });
  }

  // 12. Notifications système génériques
  const anyUser = await prisma.user.findFirst();
  if (anyUser) {
    await prisma.notification.createMany({
      data: [
        { userId: anyUser.id, userRole: 'ADMIN' as any, type: 'PAYMENT_REQUIRED', title: 'Paiement requis', message: 'Un paiement en attente.' , data: '{}' },
        { userId: anyUser.id, userRole: 'PARENT' as any, type: 'SESSION_REMINDER', title: 'Rappel de session', message: 'Votre session commence bientôt.' , data: '{}' },
      ]
    });
  }

  // 13. Demandes d’abonnement
  const anyStudentForRequest = await prisma.student.findFirst();
  if (anyStudentForRequest) {
    await prisma.subscriptionRequest.create({
      data: {
        studentId: anyStudentForRequest.id,
        requestType: 'PLAN_CHANGE',
        planName: 'HYBRIDE',
        monthlyPrice: 300,
        status: 'PENDING',
        requestedBy: 'parent',
        requestedByEmail: 'parent@example.com',
      }
    });
  }

  // 14. Badges de démonstration
  const badge = await prisma.badge.upsert({
    where: { name: 'ASSIDUITE_BRONZE' },
    update: {},
    create: { name: 'ASSIDUITE_BRONZE', description: 'Présence régulière', category: 'ASSIDUITE', condition: 'Avoir assisté à 5 sessions consécutives' }
  });
  const anyStudent2 = await prisma.student.findFirst();
  if (anyStudent2) {
    await prisma.studentBadge.upsert({
      where: { studentId_badgeId: { studentId: anyStudent2.id, badgeId: badge.id } },
      update: {},
      create: { studentId: anyStudent2.id, badgeId: badge.id },
    });
  }

  // 15. Enrichissement scénarios et profils (variété maximale)
  await seedVariety(prisma, hashedPassword);

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
    await seedPayments(); // Paiements additionnels idempotents
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

// -----------------------------------------------------------------------------
// Fonctions utilitaires et scénarios de variété
// -----------------------------------------------------------------------------
async function seedVariety(prisma: PrismaClient, hashedPassword: string) {
  // Récupération dynamique des enum Subject
  const subjects = (await prisma.$queryRaw`SELECT unnest(enum_range(NULL::"Subject"))::text as s`) as { s: string }[] | undefined;
  const subjectList = subjects?.map((x) => x.s) || [
    'MATHEMATIQUES','NSI','FRANCAIS','PHILOSOPHIE','HISTOIRE_GEO','ANGLAIS','ESPAGNOL','PHYSIQUE_CHIMIE','SVT','SES'
  ];

  // Trouver des coachs spécialisés par matière (fallback vers n'importe quel coach)
  const findCoachFor = async (subj: string) => {
    const coach = await prisma.coachProfile.findFirst({ where: { subjects: { contains: '"' + subj + '"' } } });
    return coach || (await prisma.coachProfile.findFirst());
  };

  // Créer 3 familles supplémentaires couvrant différents cas
  for (let f = 1; f <= 3; f++) {
    const parentEmail = `parent.scenario${f}@nexus.com`;
    const parent = await prisma.user.create({
      data: { email: parentEmail, password: hashedPassword, role: 'PARENT', firstName: 'Famille', lastName: `Scenario${f}` }
    });
    const parentProfile = await prisma.parentProfile.create({ data: { userId: parent.id } });

    // Définition de 5 scénarios élèves
    const studentScenarios = [
      {
        email: `eleve.sc${f}.a@nexus.com`, grade: 'Seconde', credits: 0,
        subscription: { planName: 'ACCES_PLATEFORME', status: 'ACTIVE', ariaSubjects: ['MATHEMATIQUES'] },
        guarantee: false,
      },
      {
        email: `eleve.sc${f}.b@nexus.com`, grade: 'Première', credits: 3,
        subscription: { planName: 'HYBRIDE', status: 'CANCELLED', ariaSubjects: ['NSI', 'ANGLAIS'] },
        guarantee: true,
      },
      {
        email: `eleve.sc${f}.c@nexus.com`, grade: 'Terminale', credits: 10,
        subscription: { planName: 'IMMERSION', status: 'EXPIRED', ariaSubjects: [] },
        guarantee: true,
      },
      {
        email: `eleve.sc${f}.d@nexus.com`, grade: 'Terminale', credits: 0,
        subscription: null, // Aucun abonnement
        guarantee: false,
      },
      {
        email: `eleve.sc${f}.e@nexus.com`, grade: 'Première', credits: 6,
        subscription: { planName: 'HYBRIDE', status: 'ACTIVE', ariaSubjects: ['MATHEMATIQUES','PHYSIQUE_CHIMIE'] },
        secondSubHistory: { planName: 'ACCES_PLATEFORME', status: 'CANCELLED', monthsAgo: 2, ariaSubjects: ['ANGLAIS'] },
        guarantee: true,
      },
    ] as const;

    for (const sc of studentScenarios) {
      const studentUser = await prisma.user.create({
        data: { email: sc.email, password: hashedPassword, role: 'ELEVE', firstName: 'Eleve', lastName: sc.email.split('@')[0] }
      });
      const student = await prisma.student.create({
        data: {
          userId: studentUser.id,
          parentId: parentProfile.id,
          grade: sc.grade,
          credits: sc.credits,
          guaranteeEligible: sc.guarantee,
          guaranteeActivatedAt: sc.guarantee ? new Date(Date.now() - 10 * 24 * 3600 * 1000) : null,
        }
      });

      // Abonnements variés
      if (sc.subscription) {
        await prisma.subscription.create({
          data: {
            studentId: student.id,
            planName: sc.subscription.planName as any,
            monthlyPrice: sc.subscription.planName === 'IMMERSION' ? 750 : sc.subscription.planName === 'HYBRIDE' ? 450 : 120,
            creditsPerMonth: sc.subscription.planName === 'IMMERSION' ? 12 : sc.subscription.planName === 'HYBRIDE' ? 8 : 4,
            status: sc.subscription.status as any,
            startDate: new Date(Date.now() - 14 * 24 * 3600 * 1000),
            endDate: sc.subscription.status === 'EXPIRED' ? new Date(Date.now() - 1 * 24 * 3600 * 1000) : null,
            ariaSubjects: JSON.stringify(sc.subscription.ariaSubjects),
            ariaCost: (sc.subscription.ariaSubjects?.length || 0) * 40,
          }
        });
      }
      if ((sc as any).secondSubHistory) {
        const h = (sc as any).secondSubHistory as { planName: string; status: string; monthsAgo: number; ariaSubjects: string[] };
        const start = new Date(); start.setMonth(start.getMonth() - h.monthsAgo);
        await prisma.subscription.create({
          data: {
            studentId: student.id,
            planName: h.planName as any,
            monthlyPrice: h.planName === 'IMMERSION' ? 750 : h.planName === 'HYBRIDE' ? 450 : 120,
            creditsPerMonth: h.planName === 'IMMERSION' ? 12 : h.planName === 'HYBRIDE' ? 8 : 4,
            status: h.status as any,
            startDate: start,
            endDate: new Date(start.getTime() + 20 * 24 * 3600 * 1000),
            ariaSubjects: JSON.stringify(h.ariaSubjects),
            ariaCost: (h.ariaSubjects?.length || 0) * 40,
          }
        });
      }

      // Exemple d'abonnement INACTIVE supplémentaire pour variété
      if (sc.subscription && f === 2) {
        await prisma.subscription.create({
          data: {
            studentId: student.id,
            planName: 'ACCES_PLATEFORME' as any,
            monthlyPrice: 120,
            creditsPerMonth: 4,
            status: 'INACTIVE' as any,
            startDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
            ariaSubjects: JSON.stringify(['FRANCAIS']),
            ariaCost: 40,
          }
        });
      }

      // Sessions (couverture de statuts et types)
      const coachForMath = await findCoachFor('MATHEMATIQUES');
      const coachForNSI = await findCoachFor('NSI');
      const statuses = ['SCHEDULED','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW','RESCHEDULED'] as const;
      const types = ['COURS_ONLINE','COURS_PRESENTIEL','ATELIER_GROUPE'] as const;
      const subjectsForSessions = ['MATHEMATIQUES','NSI','ANGLAIS','PHYSIQUE_CHIMIE','FRANCAIS','SVT','SES','ESPAGNOL'].filter((s) => subjectList.includes(s));
      for (let i = 0; i < statuses.length; i++) {
        const s = statuses[i];
        const subj = subjectsForSessions[i % subjectsForSessions.length] as any;
        const coach = subj === 'NSI' ? coachForNSI : coachForMath;
        if (!coach) continue;
        await prisma.session.create({
          data: {
            studentId: student.id,
            coachId: coach.id,
            type: types[i % types.length] as any,
            subject: subj,
            title: `${subj} - séance ${s.toLowerCase()}`,
            scheduledAt: new Date(Date.now() + (i - 3) * 24 * 3600 * 1000),
            duration: 60 + (i % 3) * 30,
            creditCost: 1 + (i % 2),
            status: s as any,
            location: (i % 3 === 1) ? 'Salle 12' : null,
            report: s === 'COMPLETED' ? 'Bon engagement, points à revoir.' : null,
            reportedAt: s === 'COMPLETED' ? new Date() : null,
          }
        });
      }

      // SessionBooking + notifications/reminders (variété)
      const bookingStatuses = ['SCHEDULED','CONFIRMED','COMPLETED','CANCELLED','RESCHEDULED','IN_PROGRESS','NO_SHOW'] as const;
      const modalities = ['ONLINE','IN_PERSON','HYBRID'] as const;
      for (let i = 0; i < 5; i++) {
        const coachUser = await prisma.user.findFirst({ where: { role: 'COACH' } });
        if (!coachUser) break;
        const b = await prisma.sessionBooking.create({
          data: {
            studentId: student.userId,
            coachId: coachUser.id,
            parentId: parent.id,
            subject: (subjectList[i % subjectList.length] as any),
            title: `Booking ${i+1}`,
            scheduledDate: new Date(Date.now() + (i - 2) * 24 * 3600 * 1000),
            startTime: '15:00',
            endTime: '16:00',
            duration: 60,
            status: bookingStatuses[i % bookingStatuses.length] as any,
            type: (i % 2 === 0 ? 'INDIVIDUAL' : 'GROUP') as any,
            modality: modalities[i % modalities.length] as any,
            creditsUsed: 1 + (i % 2),
            meetingUrl: i % 3 === 0 ? 'https://meet.example.com/xyz' : null,
            location: i % 3 === 1 ? 'Campus A' : null,
          }
        });
        await prisma.sessionNotification.createMany({
          data: [
            { sessionId: b.id, userId: student.userId, type: 'SESSION_BOOKED' as any, title: 'Réservation', message: 'Votre session est réservée.', status: 'SENT' as any, method: 'EMAIL' as any, sentAt: new Date() },
            { sessionId: b.id, userId: parent.id, type: 'SESSION_REMINDER' as any, title: 'Rappel', message: 'Session demain.', status: 'PENDING' as any, method: 'SMS' as any },
          ]
        });
        await prisma.sessionReminder.create({
          data: { sessionId: b.id, reminderType: 'TWO_HOURS_BEFORE' as any, scheduledFor: new Date(b.scheduledDate.getTime() - 2 * 3600 * 1000) }
        });
      }

      // ARIA conversations/messages diversifiées
      for (const subj of ['MATHEMATIQUES','NSI'].filter((s) => subjectList.includes(s))) {
        const conv = await prisma.ariaConversation.create({ data: { studentId: student.id, subject: subj as any, title: `Aide ${subj}` } });
        await prisma.ariaMessage.createMany({ data: [
          { conversationId: conv.id, role: 'USER', content: `Question sur ${subj}` },
          { conversationId: conv.id, role: 'ASSISTANT', content: `Réponse sur ${subj}`, feedback: (subj === 'NSI') ? true : null },
        ]});
      }

      // Transactions de crédits (tous types)
      await prisma.creditTransaction.createMany({ data: [
        { studentId: student.id, type: 'MONTHLY_ALLOCATION', amount: 8, description: 'Allocation mensuelle' },
        { studentId: student.id, type: 'PURCHASE', amount: 10, description: 'Achat 10 crédits', expiresAt: new Date(Date.now() + 60*24*3600*1000) },
        { studentId: student.id, type: 'USAGE', amount: -2, description: 'Cours individuel', sessionId: undefined as any },
        { studentId: student.id, type: 'REFUND', amount: 1, description: 'Remboursement' },
        { studentId: student.id, type: 'EXPIRATION', amount: -1, description: 'Expiration crédits', expiresAt: new Date(Date.now() - 1*24*3600*1000) },
      ]});

  // Bilans: couvrir NSI/MATH x Première/Terminale et divers statuts
      const bilanCombos = [
        { subject: 'NSI', niveau: 'Première', statut: 'scolarise_fr' },
        { subject: 'NSI', niveau: 'Terminale', statut: 'candidat_libre' },
        { subject: 'MATHEMATIQUES', niveau: 'Première', statut: 'scolarise_etr' },
        { subject: 'MATHEMATIQUES', niveau: 'Terminale', statut: 'scolarise_fr' },
      ];
      for (let j = 0; j < bilanCombos.length; j++) {
        const c = bilanCombos[j];
        const byDomain = {
          Algo: { points: 12 + j, max: 20, percent: Math.min(100, Math.round(((12 + j) / 20) * 100)) },
          Langage: { points: 10 + (j % 3), max: 20, percent: Math.min(100, Math.round(((10 + (j % 3)) / 20) * 100)) },
          Donnees: { points: 8 + (j % 5), max: 20, percent: Math.min(100, Math.round(((8 + (j % 5)) / 20) * 100)) },
        } as any;
        const total = Object.values(byDomain).reduce((s:any,d:any)=>s+d.points,0);
        const totalMax = Object.values(byDomain).reduce((s:any,d:any)=>s+d.max,0);
        await prisma.bilan.create({ data: {
          studentId: student.id,
          subject: c.subject,
          niveau: c.niveau,
          statut: c.statut,
          qcmRaw: { answered: 35, total: 40, version: 'v1' } as any,
          qcmScores: { total, totalMax, byDomain } as any,
          pedagoRaw: { P4: 4, P5: 3, P10: 4 } as any,
          pedagoProfile: { vak: 'Visuel', autonomie: 'moyenne', organisation: 'bonne', stress: 'moyen', flags: j % 2 ? ['Anxiete'] : [], preferences: { pairProgramming: true, git: j%2===0, tests: true } } as any,
          synthesis: { forces: ['Logique'], faiblesses: ['Rigueur'], feuilleDeRoute: ['Fiches', 'Exercices'], risques: ['Procrastination'] } as any,
          offers: { primary: 'Cortex', alternatives: ['Studio Flex','Académies'], reasoning: 'Basé sur les scores et le profil.' } as any,
          pdfUrl: null,
          pdfBlob: null,
        }});
      }

      // Bilans supplémentaires NSI avec répartition fine par domaines (Première et Terminale)
      const buildNsiPremiereFine = (shift: number) => {
        const bd: any = {
          TypesBase: { points: 12 + ((shift+1)%3), max: 20 },
          TypesConstruits: { points: 11 + ((shift+2)%4), max: 20 },
          Algo: { points: 13 + (shift%3), max: 20 },
          LangagePython: { points: 14 + ((shift+1)%3), max: 20 },
          Traces: { points: 9 + ((shift+2)%5), max: 20 },
          Donnees: { points: 10 + ((shift+3)%4), max: 20 },
        };
        for (const k of Object.keys(bd)) bd[k].percent = Math.round(100 * bd[k].points / bd[k].max);
        const total = Object.values(bd).reduce((s:any,d:any)=>s+d.points,0);
        const totalMax = Object.values(bd).reduce((s:any,d:any)=>s+d.max,0);
        return { byDomain: bd, total, totalMax };
      };
      const buildNsiTerminaleFine = (shift: number) => {
        const bd: any = {
          AlgoAvance: { points: 12 + ((shift+2)%5), max: 20 },
          POO: { points: 11 + (shift%5), max: 20 },
          Reseaux: { points: 13 + ((shift+3)%4), max: 20 },
          Systemes: { points: 10 + ((shift+4)%6), max: 20 },
          BD: { points: 12 + ((shift+1)%4), max: 20 },
          Web: { points: 9 + (shift%6), max: 20 },
        };
        for (const k of Object.keys(bd)) bd[k].percent = Math.round(100 * bd[k].points / bd[k].max);
        const total = Object.values(bd).reduce((s:any,d:any)=>s+d.points,0);
        const totalMax = Object.values(bd).reduce((s:any,d:any)=>s+d.max,0);
        return { byDomain: bd, total, totalMax };
      };

      // Créer 2 bilans fines pour NSI Première et 2 pour Terminale avec statuts métiers variés
      for (let sft = 0; sft < 2; sft++) {
        const prem = buildNsiPremiereFine(sft);
        await prisma.bilan.create({ data: {
          studentId: student.id,
          subject: 'NSI',
          niveau: 'Première',
          statut: sft === 0 ? 'reorientation' : 'scolarise_fr',
          qcmRaw: { answered: 38, total: 40, version: 'v1' } as any,
          qcmScores: prem as any,
          pedagoRaw: { P4: 5, P5: 4, P10: 4 } as any,
          pedagoProfile: { vak: 'Visuel', autonomie: 'bonne', organisation: 'moyenne', stress: 'moyen', flags: [], preferences: { pairProgramming: true, git: true, tests: true } } as any,
          synthesis: { forces: ['Modélisation'], faiblesses: ['Rigueur syntaxique'], feuilleDeRoute: ['Exos Algo', 'TP Python'], risques: [] } as any,
          offers: { primary: 'Cortex', alternatives: ['Académies'], reasoning: 'Profil autonome, orienté projets.' } as any,
        }});
        const term = buildNsiTerminaleFine(sft+1);
        await prisma.bilan.create({ data: {
          studentId: student.id,
          subject: 'NSI',
          niveau: 'Terminale',
          statut: sft === 0 ? 'annee_sabbatique' : 'candidat_libre',
          qcmRaw: { answered: 39, total: 40, version: 'v2' } as any,
          qcmScores: term as any,
          pedagoRaw: { P4: 3, P5: 4, P10: 5 } as any,
          pedagoProfile: { vak: 'Kinesthesique', autonomie: 'moyenne', organisation: 'bonne', stress: 'faible', flags: ['Anxiete'], preferences: { pairProgramming: false, git: true, tests: true } } as any,
          synthesis: { forces: ['Architecture'], faiblesses: ['Réseaux'], feuilleDeRoute: ['Labs système', 'Ateliers réseau'], risques: ['Procrastination'] } as any,
          offers: { primary: 'Studio Flex', alternatives: ['Cortex'], reasoning: 'Besoins ciblés sur systèmes/réseaux.' } as any,
        }});
      }

      // Notifications système génériques pour ces utilisateurs
      await prisma.notification.createMany({ data: [
        { userId: student.userId, userRole: 'ELEVE' as any, type: 'SESSION_REMINDER', title: 'Rappel', message: 'Pense à ta session', data: '{}' },
        { userId: parent.id, userRole: 'PARENT' as any, type: 'PAYMENT_REQUIRED', title: 'Paiement', message: 'Un paiement est requis', data: '{}' },
      ]});

      // Paiements variés rattachés au parent
      await prisma.payment.createMany({ data: [
        { userId: parent.id, type: 'SUBSCRIPTION' as any, amount: 450, currency: 'TND', description: 'Abonnement Hybride', status: 'COMPLETED' as any, method: 'konnect' },
        { userId: parent.id, type: 'CREDIT_PACK' as any, amount: 180, currency: 'TND', description: 'Pack 10 crédits', status: 'PENDING' as any, method: 'wise' },
        { userId: parent.id, type: 'SPECIAL_PACK' as any, amount: 600, currency: 'TND', description: 'Odyssée - acompte', status: 'REFUNDED' as any, method: 'manual' },
      ]});
    }
  }

  // Disponibilités coach étendues et dates spécifiques
  const anyCoachUser = await prisma.user.findFirst({ where: { role: 'COACH' } });
  if (anyCoachUser) {
    for (let dow = 0; dow < 7; dow++) {
      try {
        await prisma.coachAvailability.upsert({
          where: { coachId_dayOfWeek_startTime_endTime_specificDate: { coachId: anyCoachUser.id, dayOfWeek: dow, startTime: '10:00', endTime: '12:00', specificDate: null } as any },
          update: {},
          create: { coachId: anyCoachUser.id, dayOfWeek: dow, startTime: '10:00', endTime: '12:00', isAvailable: dow !== 0, isRecurring: true },
        });
      } catch {}
    }
    // Indisponibilité spécifique demain
    try {
      await prisma.coachAvailability.create({ data: { coachId: anyCoachUser.id, dayOfWeek: new Date().getDay(), startTime: '00:00', endTime: '23:59', specificDate: new Date(Date.now() + 24*3600*1000), isAvailable: false, isRecurring: false } });
    } catch {}
  }

  // Autres badges
  await prisma.badge.upsert({ where: { name: 'PROGRESSION_ARGENT' }, update: {}, create: { name: 'PROGRESSION_ARGENT', description: 'Progression notable', category: 'PROGRESSION', condition: 'Gagner 2 points de moyenne en 1 mois' } });
  await prisma.badge.upsert({ where: { name: 'CURIOSITE_OR' }, update: {}, create: { name: 'CURIOSITE_OR', description: 'Participation active', category: 'CURIOSITE', condition: '10 questions de qualité posées' } });

  // Contenu pédagogique additionnel multi-matières
  const extraContents = [
    { title: 'Suites arithmétiques', subject: 'MATHEMATIQUES', grade: 'Première', tags: ['suites','arithmetiques'] },
    { title: 'Structures de données', subject: 'NSI', grade: 'Terminale', tags: ['listes','dictionnaires'] },
    { title: 'Analyse de texte', subject: 'FRANCAIS', grade: 'Première', tags: ['commentaire','dissertation'] },
    { title: 'La photosynthèse', subject: 'SVT', grade: 'Seconde', tags: ['svt','photosynthese'] },
    { title: 'Les marchés et la concurrence', subject: 'SES', grade: 'Première', tags: ['ses','marches'] },
    { title: 'La Seconde Guerre mondiale', subject: 'HISTOIRE_GEO', grade: 'Terminale', tags: ['histoire','seconde_guerre'] },
    { title: 'Essay writing', subject: 'ANGLAIS', grade: 'Terminale', tags: ['anglais','essay'] },
    { title: 'Figuras retóricas', subject: 'ESPAGNOL', grade: 'Première', tags: ['espagnol','retorica'] },
    { title: 'Philosophie morale', subject: 'PHILOSOPHIE', grade: 'Terminale', tags: ['philo','morale'] },
  ];
  for (const c of extraContents) {
    await prisma.pedagogicalContent.create({ data: { title: c.title, content: `# ${c.title}\nNotes de cours...`, subject: c.subject as any, grade: c.grade, embedding: '[]', tags: JSON.stringify(c.tags) } });
  }

  // Diversifier les demandes d’abonnement
  const anyStudentForReq = await prisma.student.findFirst();
  if (anyStudentForReq) {
    await prisma.subscriptionRequest.createMany({ data: [
      { studentId: anyStudentForReq.id, requestType: 'ARIA_ADDON', planName: null as any, monthlyPrice: 40, status: 'APPROVED', requestedBy: 'parent', requestedByEmail: 'parent@example.com', processedBy: 'assistant', processedAt: new Date() } as any,
      { studentId: anyStudentForReq.id, requestType: 'PLAN_CHANGE', planName: 'IMMERSION', monthlyPrice: 750, status: 'REJECTED', requestedBy: 'parent', requestedByEmail: 'parent@example.com', rejectionReason: 'Budget', processedBy: 'assistant', processedAt: new Date() } as any,
    ]});
  }
}
