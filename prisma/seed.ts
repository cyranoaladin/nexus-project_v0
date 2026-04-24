import { PrismaClient, UserRole, Subject } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

// Helper to generate random vector
function generateVector(dim: number = 1536): number[] {
  return Array.from({ length: dim }, () => Math.random() * 2 - 1); // Random float between -1 and 1
}

// Helper to pick random item
function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

async function main() {
  console.log('🌱 Starting Massive Seeding...');

  // 1. Admin & Staff
  const hashedPassword = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@nexus-reussite.com' },
    update: { activatedAt: new Date() },
    create: {
      email: 'admin@nexus-reussite.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Nexus',
      role: 'ADMIN',
      activatedAt: new Date(),
    },
  });

  // 1b. Named Demo Users (for testing & demo)
  const namedCoaches = [
    { email: 'helios@nexus-reussite.com', firstName: 'Helios', lastName: 'Nexus', pseudonym: 'Coach Helios', subjects: [Subject.MATHEMATIQUES, Subject.NSI] },
    { email: 'zenon@nexus-reussite.com', firstName: 'Zenon', lastName: 'Nexus', pseudonym: 'Coach Zenon', subjects: [Subject.MATHEMATIQUES, Subject.PHYSIQUE_CHIMIE] },
  ];

  for (const coach of namedCoaches) {
    const user = await prisma.user.upsert({
      where: { email: coach.email },
      update: { activatedAt: new Date() },
      create: {
        email: coach.email,
        password: hashedPassword,
        firstName: coach.firstName,
        lastName: coach.lastName,
        role: 'COACH',
        activatedAt: new Date(),
      },
    });
    await prisma.coachProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        pseudonym: coach.pseudonym,
        subjects: coach.subjects,
        title: 'Professeur Certifié',
        description: 'Expert en pédagogie différenciée.',
      },
    });
  }

  // Named parent + student demo pair
  const demoParentUser = await prisma.user.upsert({
    where: { email: 'parent@example.com' },
    update: { activatedAt: new Date() },
    create: {
      email: 'parent@example.com',
      password: hashedPassword,
      firstName: 'Marie',
      lastName: 'Dupont',
      role: 'PARENT',
      activatedAt: new Date(),
    },
  });
  const demoParentProfile = await prisma.parentProfile.upsert({
    where: { userId: demoParentUser.id },
    update: {},
    create: { userId: demoParentUser.id },
  });

  const demoStudentUser = await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: { activatedAt: new Date() },
    create: {
      email: 'student@example.com',
      password: hashedPassword,
      firstName: 'Ahmed',
      lastName: 'Dupont',
      role: 'ELEVE',
      activatedAt: new Date(),
    },
  });
  await prisma.student.upsert({
    where: { userId: demoStudentUser.id },
    update: {},
    create: {
      userId: demoStudentUser.id,
      parentId: demoParentProfile.id,
      grade: 'TERMINALE',
      credits: 5,
    },
  });

  // Dedicated STMG Student for testing the new tool
  const stmgStudentUser = await prisma.user.upsert({
    where: { email: 'stmg@example.com' },
    update: { activatedAt: new Date() },
    create: {
      email: 'stmg@example.com',
      password: hashedPassword,
      firstName: 'Sophie',
      lastName: 'STMG',
      role: 'ELEVE',
      activatedAt: new Date(),
    },
  });
  await prisma.student.upsert({
    where: { userId: stmgStudentUser.id },
    update: {},
    create: {
      userId: stmgStudentUser.id,
      parentId: demoParentProfile.id,
      grade: 'PREMIERE', // Will match the dashboard check
      credits: 5,
    },
  });

  console.log('✅ Named demo users seeded (helios, zenon, parent@example.com, student@example.com, stmg@example.com)');

  // 2. Coaches (10)
  const subjectsList = Object.values(Subject);
  
  for (let i = 1; i <= 10; i++) {
    const email = `coach${i}@nexus.local`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: hashedPassword,
        firstName: `Coach`,
        lastName: `${i}`,
        role: 'COACH',
        activatedAt: new Date(),
      },
    });

    await prisma.coachProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        pseudonym: `CoachMaster${i}`,
        subjects: [pickRandom(subjectsList), pickRandom(subjectsList)],
        title: 'Professeur Certifié',
        description: 'Expert en pédagogie différenciée.',
      }
    });
  }
  console.log('✅ 10 Coaches seeded');

  // 3. Parents (50) & Students (100)
  // Each parent has 2 students on average
  for (let i = 1; i <= 50; i++) {
    const parentEmail = `parent${i}@nexus.local`;
    
    // Create Parent
    const parentUser = await prisma.user.upsert({
      where: { email: parentEmail },
      update: {},
      create: {
        email: parentEmail,
        password: hashedPassword,
        firstName: `Parent`,
        lastName: `${i}`,
        role: 'PARENT',
        activatedAt: new Date(),
      },
    });

    const parentProfile = await prisma.parentProfile.upsert({
      where: { userId: parentUser.id },
      update: {},
      create: { userId: parentUser.id }
    });

    // Create 2 students per parent
    for (let j = 1; j <= 2; j++) {
        const studentEmail = `student${i}-${j}@nexus.local`;
        const studentUser = await prisma.user.upsert({
            where: { email: studentEmail },
            update: {},
            create: {
                email: studentEmail,
                password: hashedPassword,
                firstName: `Eleve`,
                lastName: `${i}-${j}`,
                role: 'ELEVE',
                activatedAt: new Date(),
            }
        });

        await prisma.student.upsert({
            where: { userId: studentUser.id },
            update: {},
            create: {
                userId: studentUser.id,
                parentId: parentProfile.id,
                grade: j === 1 ? 'PREMIERE' : 'TERMINALE',
                credits: 5,
            }
        });
    }
  }
  console.log('✅ 50 Parents & 100 Students seeded');

  // 4. Pedagogical Content with Vectors (20)
  console.log('🧠 Seeding Vector Knowledge Base...');
  
  // Clean existing to avoid duplicates logic complexity
  // await prisma.pedagogicalContent.deleteMany(); // Dangerous in prod, safe in seed if we assume fresh start or idempotent

  const contents = [
      { title: "Dérivée d'une fonction", subject: "MATHEMATIQUES", content: "La dérivée f'(x) représente le taux d'accroissement instantané..." },
      { title: "Loi binomiale", subject: "MATHEMATIQUES", content: "La loi binomiale modélise le nombre de succès dans une répétition d'épreuves de Bernoulli..." },
      { title: "Programmation Orientée Objet", subject: "NSI", content: "La POO repose sur des classes et des objets, l'encapsulation et l'héritage..." },
      { title: "La conscience", subject: "PHILOSOPHIE", content: "La conscience est la connaissance immédiate de sa propre activité psychique..." },
      // ... generate more generically
  ];

  for (let i = 0; i < 20; i++) {
      const baseContent = contents[i % contents.length];
      const title = `${baseContent.title} ${i + 1}`;
      const vector = generateVector(1536);
      const id = createId();
      
      // Use raw query for vector insertion
      // Note: We cast the array to vector type string representation properly if needed, but Prisma Raw usually handles params.
      // However, pgvector expects '[1,2,3]' string format or array.
      
      const vectorString = `[${vector.join(',')}]`;

      await prisma.$executeRaw`
        INSERT INTO "pedagogical_contents" (id, title, content, subject, "embedding_vector", "updatedAt", "embedding", "tags")
        VALUES (
            ${id}, 
            ${title}, 
            ${baseContent.content}, 
            ${baseContent.subject}::"Subject", 
            ${vectorString}::vector, 
            NOW(), 
            '[]'::jsonb, 
            '[]'::jsonb
        );
      `;
  }
  console.log('✅ 20 Vectorized Contents seeded');

  // ── Stage Printemps 2026 ────────────────────────────────────────────────────
  const stagePrintemps = await prisma.stage.upsert({
    where: { slug: 'printemps-2026' },
    update: {},
    create: {
      slug: 'printemps-2026',
      title: 'Stage Intensif Printemps 2026',
      subtitle: 'Maths & NSI — Remise à niveau & Excellence',
      description:
        'Stage intensif de 5 jours couvrant les chapitres clés du programme ' +
        'de Terminale. Groupes de 6 à 12 élèves maximum. Bilan personnalisé inclus.',
      type: 'INTENSIF',
      subject: ['MATHEMATIQUES', 'NSI'],
      level: ['Terminale', 'Première'],
      startDate: new Date('2026-04-21T08:30:00.000Z'),
      endDate: new Date('2026-04-25T17:00:00.000Z'),
      capacity: 12,
      priceAmount: 350,
      priceCurrency: 'TND',
      location: 'Nexus Réussite — Tunis',
      isVisible: true,
      isOpen: true,
    },
  });

  await prisma.stageSession.createMany({
    skipDuplicates: true,
    data: [
      {
        stageId: stagePrintemps.id,
        title: 'Analyse & Limites',
        subject: 'MATHEMATIQUES',
        startAt: new Date('2026-04-21T08:30:00.000Z'),
        endAt: new Date('2026-04-21T11:30:00.000Z'),
        location: 'Salle A',
      },
      {
        stageId: stagePrintemps.id,
        title: 'Structures de données',
        subject: 'NSI',
        startAt: new Date('2026-04-21T13:00:00.000Z'),
        endAt: new Date('2026-04-21T16:00:00.000Z'),
        location: 'Salle Informatique',
      },
      {
        stageId: stagePrintemps.id,
        title: 'Suites & Récurrences',
        subject: 'MATHEMATIQUES',
        startAt: new Date('2026-04-22T08:30:00.000Z'),
        endAt: new Date('2026-04-22T11:30:00.000Z'),
        location: 'Salle A',
      },
      {
        stageId: stagePrintemps.id,
        title: 'Algorithmique & Complexité',
        subject: 'NSI',
        startAt: new Date('2026-04-22T13:00:00.000Z'),
        endAt: new Date('2026-04-22T16:00:00.000Z'),
        location: 'Salle Informatique',
      },
      {
        stageId: stagePrintemps.id,
        title: 'Probabilités & Variables aléatoires',
        subject: 'MATHEMATIQUES',
        startAt: new Date('2026-04-23T08:30:00.000Z'),
        endAt: new Date('2026-04-23T11:30:00.000Z'),
        location: 'Salle A',
      },
      {
        stageId: stagePrintemps.id,
        title: 'Bases de données & SQL',
        subject: 'NSI',
        startAt: new Date('2026-04-23T13:00:00.000Z'),
        endAt: new Date('2026-04-23T16:00:00.000Z'),
        location: 'Salle Informatique',
      },
      {
        stageId: stagePrintemps.id,
        title: 'Géométrie & Produit scalaire',
        subject: 'MATHEMATIQUES',
        startAt: new Date('2026-04-24T08:30:00.000Z'),
        endAt: new Date('2026-04-24T11:30:00.000Z'),
        location: 'Salle A',
      },
      {
        stageId: stagePrintemps.id,
        title: 'Réseaux & Architecture',
        subject: 'NSI',
        startAt: new Date('2026-04-24T13:00:00.000Z'),
        endAt: new Date('2026-04-24T16:00:00.000Z'),
        location: 'Salle Informatique',
      },
      {
        stageId: stagePrintemps.id,
        title: 'Révision & Épreuve blanche Maths',
        subject: 'MATHEMATIQUES',
        startAt: new Date('2026-04-25T08:30:00.000Z'),
        endAt: new Date('2026-04-25T11:30:00.000Z'),
        location: 'Salle A',
      },
      {
        stageId: stagePrintemps.id,
        title: 'Révision & Épreuve blanche NSI',
        subject: 'NSI',
        startAt: new Date('2026-04-25T13:00:00.000Z'),
        endAt: new Date('2026-04-25T16:00:00.000Z'),
        location: 'Salle Informatique',
      },
    ],
  });
  console.log(`✅ Stage "${stagePrintemps.title}" seedé avec 10 séances`);

  console.log('🚀 Massive Seeding Complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
