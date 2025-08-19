import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  const password = 'password123';
  const hashedPassword = await bcrypt.hash(password, 12);

  // RESET database to ensure deterministic state for tests
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE
      "session_notifications",
      "session_reminders",
      "session_bookings",
      "notifications",
      "aria_messages",
      "aria_conversations",
      "credit_transactions",
      "student_badges",
      "student_reports",
      "subscription_requests",
      "payments",
      "subscriptions",
      "sessions",
      "pedagogical_contents",
      "coach_profiles",
      "parent_profiles",
      "student_profiles",
      "students",
      "messages",
      "badges",
      "users"
      RESTART IDENTITY CASCADE`);
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
    await seedPayments(); // Call the new seed function
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
