import {
  AcademicTrack,
  BilanStatus,
  BilanType,
  GradeLevel,
  PrismaClient,
  ServiceType,
  SessionStatus,
  StmgPathway,
  Subject,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createId } from '@paralleldrive/cuid2';
import { createDefaultSurvivalSnapshot, toPrismaSurvivalData } from '../lib/survival/progress';

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

  async function seedStudentScenario(params: {
    scenarioKey: string;
    studentId: string;
    email: string;
    name: string;
    subject: Subject;
    title: string;
  }) {
    const scheduledAt = new Date('2026-04-20T09:00:00.000Z');

    await prisma.session.upsert({
      where: { id: `seed-session-${params.scenarioKey}` },
      update: {
        studentId: params.studentId,
        subject: params.subject,
        title: params.title,
        scheduledAt,
        status: SessionStatus.COMPLETED,
      },
      create: {
        id: `seed-session-${params.scenarioKey}`,
        studentId: params.studentId,
        type: ServiceType.COURS_ONLINE,
        subject: params.subject,
        title: params.title,
        description: 'Session historique seed pour le dashboard refonte.',
        scheduledAt,
        duration: 60,
        creditCost: 1,
        status: SessionStatus.COMPLETED,
        report: 'Progression régulière, prochaines étapes à suivre dans le cockpit.',
        reportedAt: new Date('2026-04-20T10:15:00.000Z'),
      },
    });

    await prisma.ariaConversation.upsert({
      where: { id: `seed-aria-${params.scenarioKey}` },
      update: {
        studentId: params.studentId,
        subject: params.subject,
        title: `ARIA - ${params.title}`,
      },
      create: {
        id: `seed-aria-${params.scenarioKey}`,
        studentId: params.studentId,
        subject: params.subject,
        title: `ARIA - ${params.title}`,
        messages: {
          create: [
            {
              role: 'user',
              content: 'Peux-tu me proposer une remédiation ciblée ?',
            },
            {
              role: 'assistant',
              content: 'Voici un plan court avec une ressource RAG à consulter et un exercice de reprise.',
            },
          ],
        },
      },
    });

    await prisma.bilan.upsert({
      where: { id: `seed-bilan-${params.scenarioKey}` },
      update: {
        studentId: params.studentId,
        studentEmail: params.email,
        studentName: params.name,
        subject: params.subject,
        status: BilanStatus.COMPLETED,
        isPublished: true,
      },
      create: {
        id: `seed-bilan-${params.scenarioKey}`,
        type: BilanType.CONTINUOUS,
        subject: params.subject,
        studentId: params.studentId,
        studentEmail: params.email,
        studentName: params.name,
        globalScore: 68,
        confidenceIndex: 72,
        ssn: 64,
        uai: 66,
        domainScores: [{ domain: params.title, score: 68 }],
        studentMarkdown: `# Bilan ${params.title}\n\nProgression encourageante.`,
        parentsMarkdown: `# Bilan ${params.title}\n\nVotre enfant progresse avec régularité.`,
        nexusMarkdown: `# Bilan ${params.title}\n\nSeed technique pour dashboards.`,
        status: BilanStatus.COMPLETED,
        progress: 100,
        isPublished: true,
        publishedAt: new Date('2026-04-20T11:00:00.000Z'),
        sourceVersion: 'seed_dashboard_refonte_v1',
        engineVersion: 'seed',
      },
    });
  }

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
    update: {
      grade: 'PREMIERE',
      gradeLevel: GradeLevel.PREMIERE,
      academicTrack: AcademicTrack.EDS_GENERALE,
      specialties: [Subject.MATHEMATIQUES, Subject.NSI, Subject.PHYSIQUE_CHIMIE],
      stmgPathway: null,
      survivalMode: false,
      survivalModeReason: null,
      survivalModeBy: null,
      survivalModeAt: null,
      updatedTrackAt: new Date(),
    },
    create: {
      userId: demoStudentUser.id,
      parentId: demoParentProfile.id,
      grade: 'PREMIERE',
      gradeLevel: GradeLevel.PREMIERE,
      academicTrack: AcademicTrack.EDS_GENERALE,
      specialties: [Subject.MATHEMATIQUES, Subject.NSI, Subject.PHYSIQUE_CHIMIE],
      updatedTrackAt: new Date(),
      credits: 5,
    },
  });

  // Dedicated STMG Student for testing the new dashboards
  const stmgStudentUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: { activatedAt: new Date() },
    create: {
      email: 'test@example.com',
      password: hashedPassword,
      firstName: 'Sophie',
      lastName: 'STMG',
      role: 'ELEVE',
      activatedAt: new Date(),
    },
  });
  await prisma.student.upsert({
    where: { userId: stmgStudentUser.id },
    update: {
      grade: 'PREMIERE',
      gradeLevel: GradeLevel.PREMIERE,
      academicTrack: AcademicTrack.STMG,
      specialties: [],
      stmgPathway: StmgPathway.INDETERMINE,
      survivalMode: false,
      survivalModeReason: null,
      survivalModeBy: null,
      survivalModeAt: null,
      updatedTrackAt: new Date(),
    },
    create: {
      userId: stmgStudentUser.id,
      parentId: demoParentProfile.id,
      grade: 'PREMIERE', // Will match the dashboard check
      gradeLevel: GradeLevel.PREMIERE,
      academicTrack: AcademicTrack.STMG,
      specialties: [],
      stmgPathway: StmgPathway.INDETERMINE,
      updatedTrackAt: new Date(),
      credits: 5,
    },
  });

  const edsDashboardUser = await prisma.user.upsert({
    where: { email: 'eleve.eds@nexus-reussite.com' },
    update: { activatedAt: new Date() },
    create: {
      email: 'eleve.eds@nexus-reussite.com',
      password: hashedPassword,
      firstName: 'Nour',
      lastName: 'EDS',
      role: 'ELEVE',
      activatedAt: new Date(),
    },
  });
  const edsDashboardStudent = await prisma.student.upsert({
    where: { userId: edsDashboardUser.id },
    update: {
      grade: 'PREMIERE',
      gradeLevel: GradeLevel.PREMIERE,
      academicTrack: AcademicTrack.EDS_GENERALE,
      specialties: [Subject.MATHEMATIQUES, Subject.NSI, Subject.PHYSIQUE_CHIMIE],
      stmgPathway: null,
      survivalMode: false,
      survivalModeReason: null,
      survivalModeBy: null,
      survivalModeAt: null,
      updatedTrackAt: new Date(),
      credits: 8,
    },
    create: {
      userId: edsDashboardUser.id,
      parentId: demoParentProfile.id,
      grade: 'PREMIERE',
      gradeLevel: GradeLevel.PREMIERE,
      academicTrack: AcademicTrack.EDS_GENERALE,
      specialties: [Subject.MATHEMATIQUES, Subject.NSI, Subject.PHYSIQUE_CHIMIE],
      updatedTrackAt: new Date(),
      credits: 8,
    },
  });

  const stmgDashboardUser = await prisma.user.upsert({
    where: { email: 'eleve.stmg@nexus-reussite.com' },
    update: { activatedAt: new Date() },
    create: {
      email: 'eleve.stmg@nexus-reussite.com',
      password: hashedPassword,
      firstName: 'Ines',
      lastName: 'STMG',
      role: 'ELEVE',
      activatedAt: new Date(),
    },
  });
  const stmgDashboardStudent = await prisma.student.upsert({
    where: { userId: stmgDashboardUser.id },
    update: {
      grade: 'PREMIERE',
      gradeLevel: GradeLevel.PREMIERE,
      academicTrack: AcademicTrack.STMG,
      specialties: [],
      stmgPathway: StmgPathway.INDETERMINE,
      survivalMode: false,
      survivalModeReason: null,
      survivalModeBy: null,
      survivalModeAt: null,
      updatedTrackAt: new Date(),
      credits: 8,
    },
    create: {
      userId: stmgDashboardUser.id,
      parentId: demoParentProfile.id,
      grade: 'PREMIERE',
      gradeLevel: GradeLevel.PREMIERE,
      academicTrack: AcademicTrack.STMG,
      specialties: [],
      stmgPathway: StmgPathway.INDETERMINE,
      updatedTrackAt: new Date(),
      credits: 8,
    },
  });

  await seedStudentScenario({
    scenarioKey: 'eds-premiere',
    studentId: edsDashboardStudent.id,
    email: edsDashboardUser.email,
    name: 'Nour EDS',
    subject: Subject.MATHEMATIQUES,
    title: 'Mathématiques EDS Première',
  });
  await seedStudentScenario({
    scenarioKey: 'stmg-premiere',
    studentId: stmgDashboardStudent.id,
    email: stmgDashboardUser.email,
    name: 'Ines STMG',
    subject: Subject.MATHEMATIQUES,
    title: 'Mathématiques STMG Première',
  });

  const survivalParentUser = await prisma.user.upsert({
    where: { email: 'parent.stmg.survival@nexus-reussite.com' },
    update: { activatedAt: new Date() },
    create: {
      email: 'parent.stmg.survival@nexus-reussite.com',
      password: hashedPassword,
      firstName: 'Parent',
      lastName: 'Survie',
      role: 'PARENT',
      activatedAt: new Date(),
    },
  });
  const survivalParentProfile = await prisma.parentProfile.upsert({
    where: { userId: survivalParentUser.id },
    update: {},
    create: { userId: survivalParentUser.id },
  });
  const survivalStudentUser = await prisma.user.upsert({
    where: { email: 'eleve.stmg.survival@nexus-reussite.com' },
    update: { activatedAt: new Date() },
    create: {
      email: 'eleve.stmg.survival@nexus-reussite.com',
      password: hashedPassword,
      firstName: 'Lina',
      lastName: 'Survie',
      role: 'ELEVE',
      activatedAt: new Date(),
    },
  });
  const survivalStudent = await prisma.student.upsert({
    where: { userId: survivalStudentUser.id },
    update: {
      grade: 'PREMIERE',
      gradeLevel: GradeLevel.PREMIERE,
      academicTrack: AcademicTrack.STMG,
      specialties: [],
      stmgPathway: StmgPathway.INDETERMINE,
      survivalMode: true,
      survivalModeReason: 'Profil tres grande difficulte - objectif tactique 8/20',
      survivalModeBy: survivalParentUser.id,
      survivalModeAt: new Date('2026-04-25T08:00:00.000Z'),
      updatedTrackAt: new Date(),
      credits: 6,
    },
    create: {
      userId: survivalStudentUser.id,
      parentId: survivalParentProfile.id,
      grade: 'PREMIERE',
      gradeLevel: GradeLevel.PREMIERE,
      academicTrack: AcademicTrack.STMG,
      specialties: [],
      stmgPathway: StmgPathway.INDETERMINE,
      survivalMode: true,
      survivalModeReason: 'Profil tres grande difficulte - objectif tactique 8/20',
      survivalModeBy: survivalParentUser.id,
      survivalModeAt: new Date('2026-04-25T08:00:00.000Z'),
      updatedTrackAt: new Date(),
      credits: 6,
    },
  });
  const survivalSnapshot = createDefaultSurvivalSnapshot();
  survivalSnapshot.reflexesState.reflex_1 = 'ACQUIS';
  survivalSnapshot.reflexesState.reflex_2 = 'ACQUIS';
  survivalSnapshot.reflexesState.reflex_3 = 'REVOIR';
  survivalSnapshot.phrasesState.phrase_1 = 3;
  survivalSnapshot.phrasesState.phrase_2 = 1;
  survivalSnapshot.qcmAttempts = 6;
  survivalSnapshot.qcmCorrect = 3;

  await prisma.survivalProgress.upsert({
    where: { studentId: survivalStudent.id },
    update: {
      examDate: new Date('2026-06-08T08:00:00.000Z'),
      ...toPrismaSurvivalData(survivalSnapshot),
    },
    create: {
      studentId: survivalStudent.id,
      examDate: new Date('2026-06-08T08:00:00.000Z'),
      ...toPrismaSurvivalData(survivalSnapshot),
    },
  });

  await seedStudentScenario({
    scenarioKey: 'stmg-survival',
    studentId: survivalStudent.id,
    email: survivalStudentUser.email,
    name: 'Lina Survie',
    subject: Subject.MATHEMATIQUES,
    title: 'Mathématiques STMG Mode Survie',
  });

  console.log('✅ Named demo users seeded (helios, zenon, parent@example.com, student@example.com, test@example.com, eleve.eds@nexus-reussite.com, eleve.stmg@nexus-reussite.com, eleve.stmg.survival@nexus-reussite.com)');

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
            update: {
                grade: j === 1 ? 'PREMIERE' : 'TERMINALE',
                gradeLevel: j === 1 ? GradeLevel.PREMIERE : GradeLevel.TERMINALE,
                academicTrack: AcademicTrack.EDS_GENERALE,
                specialties: j === 1 ? [Subject.MATHEMATIQUES, Subject.NSI] : [Subject.MATHEMATIQUES],
                stmgPathway: null,
                updatedTrackAt: new Date(),
            },
            create: {
                userId: studentUser.id,
                parentId: parentProfile.id,
                grade: j === 1 ? 'PREMIERE' : 'TERMINALE',
                gradeLevel: j === 1 ? GradeLevel.PREMIERE : GradeLevel.TERMINALE,
                academicTrack: AcademicTrack.EDS_GENERALE,
                specialties: j === 1 ? [Subject.MATHEMATIQUES, Subject.NSI] : [Subject.MATHEMATIQUES],
                updatedTrackAt: new Date(),
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
