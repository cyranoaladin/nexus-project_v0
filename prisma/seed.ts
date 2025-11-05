import {
  PrismaClient,
  ServiceType,
  SessionStatus,
  Subject,
  SubscriptionStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

function computeDashboardId(seed: string): string {
  const digest = createHash('sha1').update(seed).digest();
  const bytes = Buffer.from(digest);
  // Enforce UUID version 5 layout (SHA-1 namespace based)
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function main() {
  // Créer un utilisateur admin par défaut
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const hashedParentPassword = await bcrypt.hash('parent123', 10);
  const hashedStudentPassword = await bcrypt.hash('password', 10);
  const hashedAssistantPassword = await bcrypt.hash('assist123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@nexus-reussite.com' },
    update: {},
    create: {
      email: 'admin@nexus-reussite.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Nexus',
      role: 'ADMIN',
    },
  });

  console.log('Utilisateur admin créé:', admin);

  // Créer un compte assistante pédagogique
  const assistante = await prisma.user.upsert({
    where: { email: 'assistante@nexus-reussite.com' },
    update: {
      firstName: 'Cléa',
      lastName: 'Support',
      phone: '+216 20 000 100',
    },
    create: {
      email: 'assistante@nexus-reussite.com',
      password: hashedAssistantPassword,
      firstName: 'Cléa',
      lastName: 'Support',
      phone: '+216 20 000 100',
      role: 'ASSISTANTE',
    },
  });

  console.log('Assistante pédagogique créée:', {
    id: assistante.id,
    email: assistante.email,
  });

  // Créer des coachs avec leurs profils
  const coaches = [
    {
      email: 'helios@nexus-reussite.com',
      firstName: 'Hélios',
      lastName: 'Lumière',
      pseudonym: 'Hélios',
      tag: '🎓 Agrégé',
      subjects: JSON.stringify(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE']),
      description: 'Agrégé en mathématiques avec 15 ans d\'expérience dans l\'enseignement supérieur.',
      philosophy: 'Les mathématiques sont un langage universel qui ouvre les portes de la logique et de la créativité.',
      expertise: 'Préparation aux concours, remise à niveau, approfondissement'
    },
    {
      email: 'zenon@nexus-reussite.com',
      firstName: 'Zénon',
      lastName: 'Stratège',
      pseudonym: 'Zénon',
      tag: '🎯 Stratège',
      subjects: JSON.stringify(['NSI', 'MATHEMATIQUES']),
      description: 'Expert en informatique et algorithmique, spécialisé dans la préparation aux concours d\'ingénieur.',
      philosophy: 'L\'informatique moderne nécessite une approche structurée et créative.',
      expertise: 'Programmation, algorithmes, préparation aux concours d\'ingénieur'
    },
    {
      email: 'athena@nexus-reussite.com',
      firstName: 'Athéna',
      lastName: 'Sagesse',
      pseudonym: 'Athéna',
      tag: '📚 Philosophe',
      subjects: JSON.stringify(['PHILOSOPHIE', 'FRANCAIS']),
      description: 'Docteur en philosophie, spécialisée dans la méthodologie et l\'argumentation.',
      philosophy: 'La philosophie développe l\'esprit critique et la capacité d\'argumentation.',
      expertise: 'Méthodologie, dissertation, culture générale'
    },
    {
      email: 'hermes@nexus-reussite.com',
      firstName: 'Hermès',
      lastName: 'Messager',
      pseudonym: 'Hermès',
      tag: '🌍 Linguiste',
      subjects: JSON.stringify(['ANGLAIS', 'ESPAGNOL']),
      description: 'Professeur de langues vivantes, spécialisé dans la préparation aux examens internationaux.',
      philosophy: 'Les langues sont des ponts vers d\'autres cultures et perspectives.',
      expertise: 'Préparation TOEFL, IELTS, DELE, conversation'
    },
    {
      email: 'clio@nexus-reussite.com',
      firstName: 'Clio',
      lastName: 'Mémoire',
      pseudonym: 'Clio',
      tag: '🏛️ Historienne',
      subjects: JSON.stringify(['HISTOIRE_GEO', 'SES']),
      description: 'Agrégée d\'histoire-géographie, spécialisée dans la méthodologie et l\'analyse documentaire.',
      philosophy: 'L\'histoire nous éclaire sur le présent et nous guide vers l\'avenir.',
      expertise: 'Méthodologie, analyse documentaire, géopolitique'
    }
  ];

  for (const coachData of coaches) {
    // Créer l'utilisateur coach
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

    // Créer le profil coach
    const coachProfile = await prisma.coachProfile.upsert({
      where: { userId: coachUser.id },
      update: {},
      create: {
        userId: coachUser.id,
        title: 'Professeur',
        pseudonym: coachData.pseudonym,
        tag: coachData.tag,
        description: coachData.description,
        philosophy: coachData.philosophy,
        expertise: coachData.expertise,
        subjects: coachData.subjects,
        availableOnline: true,
        availableInPerson: true,
      },
    });

    console.log(`Coach ${coachData.pseudonym} créé:`, coachProfile);

    // Créer quelques disponibilités pour chaque coach
    const availabilitySlots = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }, // Lundi
      { dayOfWeek: 1, startTime: '14:00', endTime: '15:00' },
      { dayOfWeek: 2, startTime: '10:00', endTime: '11:00' }, // Mardi
      { dayOfWeek: 2, startTime: '15:00', endTime: '16:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '10:00' }, // Mercredi
      { dayOfWeek: 3, startTime: '14:00', endTime: '15:00' },
      { dayOfWeek: 4, startTime: '10:00', endTime: '11:00' }, // Jeudi
      { dayOfWeek: 4, startTime: '15:00', endTime: '16:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '10:00' }, // Vendredi
      { dayOfWeek: 5, startTime: '14:00', endTime: '15:00' }
    ];

    for (const slot of availabilitySlots) {
      const exists = await prisma.coachAvailability.findFirst({
        where: {
          coachId: coachUser.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isRecurring: true,
          specificDate: null
        }
      });
      if (!exists) {
        await prisma.coachAvailability.create({
          data: {
            coachId: coachUser.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isAvailable: true,
            isRecurring: true,
            validFrom: new Date(),
            validUntil: null
          }
        });
      }
    }

    console.log(`Disponibilités créées pour ${coachData.pseudonym}`);
  }

  // Créer quelques données de test
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      role: 'ELEVE',
    },
  });

  // Créer des parents et étudiants de test
  const parentUser = await prisma.user.upsert({
    where: { email: 'parent@example.com' },
    update: {},
    create: {
      email: 'parent@example.com',
      password: hashedPassword,
      firstName: 'Parent',
      lastName: 'Test',
      role: 'PARENT',
    },
  });

  const parentProfile = await prisma.parentProfile.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: {
      userId: parentUser.id,
      address: '123 Rue de la Paix, Tunis',
      city: 'Tunis',
      country: 'Tunisie'
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: {},
    create: {
      email: 'student@example.com',
      password: hashedPassword,
      firstName: 'Étudiant',
      lastName: 'Test',
      role: 'ELEVE',
    },
  });

  const e2eStudentUser = await prisma.user.upsert({
    where: { email: 'student@test.local' },
    update: {
      password: hashedStudentPassword,
    },
    create: {
      email: 'student@test.local',
      password: hashedStudentPassword,
      firstName: 'Étudiant',
      lastName: 'E2E',
      role: 'ELEVE',
    },
  });

  const studentProfile = await prisma.studentProfile.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id,
      grade: 'Terminale',
      school: 'Lycée Pilote'
    },
  });

  const e2eStudentProfile = await prisma.studentProfile.upsert({
    where: { userId: e2eStudentUser.id },
    update: {},
    create: {
      userId: e2eStudentUser.id,
      grade: 'Terminale',
      school: 'Lycée Nexus',
    },
  });

  const existingStudent = await prisma.student.findUnique({ where: { userId: studentUser.id } });
  const studentDashboardId = existingStudent?.dashboardStudentId ?? computeDashboardId(studentUser.email);

  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {
      dashboardStudentId: studentDashboardId,
    },
    create: {
      userId: studentUser.id,
      parentId: parentProfile.id,
      credits: 10,
      totalSessions: 0,
      completedSessions: 0,
      dashboardStudentId: studentDashboardId,
    },
  });

  const existingE2EStudent = await prisma.student.findUnique({ where: { userId: e2eStudentUser.id } });
  const e2eDashboardId = existingE2EStudent?.dashboardStudentId ?? computeDashboardId(e2eStudentUser.email);

  await prisma.student.upsert({
    where: { userId: e2eStudentUser.id },
    update: {
      parentId: parentProfile.id,
      dashboardStudentId: e2eDashboardId,
    },
    create: {
      userId: e2eStudentUser.id,
      parentId: parentProfile.id,
      credits: 5,
      totalSessions: 0,
      completedSessions: 0,
      dashboardStudentId: e2eDashboardId,
    },
  });

  console.log('Utilisateur test créé:', testUser);
  console.log('Parent et étudiant créés:', { parent: parentProfile, student: student });
  console.log('Étudiant E2E créé:', { user: e2eStudentUser, profile: e2eStudentProfile });

  const badgesSeed = [
    {
      name: 'Assiduité',
      description: 'Participe activement aux sessions et remet les travaux dans les temps.',
      category: 'ASSIDUITE',
      icon: '🔥',
      condition: '4 sessions complétées sur le mois en cours',
    },
    {
      name: 'Progression continue',
      description: 'Maintient une progression académique supérieure à 15/20 sur trois évaluations consécutives.',
      category: 'PROGRESSION',
      icon: '📈',
      condition: 'Score moyen > 15 sur les évaluations récentes',
    },
    {
      name: 'Curiosité RAG',
      description: 'Utilise l’agent ARIA pour explorer des ressources complémentaires toutes les semaines.',
      category: 'CURIOSITE',
      icon: '🧠',
      condition: '3 conversations ARIA pertinentes sur le dernier mois',
    },
  ];

  const badges = await Promise.all(
    badgesSeed.map((badge) =>
      prisma.badge.upsert({
        where: { name: badge.name },
        update: {
          description: badge.description,
          category: badge.category,
          icon: badge.icon,
          condition: badge.condition,
        },
        create: badge,
      }),
    ),
  );

  const badgeMap = badges.reduce<Record<string, string>>((acc, badge) => {
    acc[badge.name] = badge.id;
    return acc;
  }, {});

  const coachesProfiles = await prisma.coachProfile.findMany({
    select: {
      id: true,
      pseudonym: true,
    },
  });

  if (coachesProfiles.length === 0) {
    throw new Error('Aucun coach trouvé, impossible de préparer les sessions.');
  }

  const coachByPseudonym = new Map(coachesProfiles.map((coach) => [coach.pseudonym, coach]));

  const diversifiedFamilies = [
    {
      parent: {
        email: 'salma.benahmed@example.com',
        firstName: 'Salma',
        lastName: 'Ben Ahmed',
        phone: '+216 22 123 456',
        address: '7 Rue des Jasmins',
        city: 'La Marsa',
        country: 'Tunisie',
      },
      students: [
        {
          email: 'ines.benahmed@example.com',
          firstName: 'Inès',
          lastName: 'Ben Ahmed',
          phone: '+216 52 987 654',
          profile: {
            grade: 'Terminale - Spé Maths & Physique',
            school: 'Lycée Pilote de Tunis',
            birthDate: new Date('2007-04-18T00:00:00.000Z'),
          },
          record: {
            credits: 18,
            totalSessions: 14,
            completedSessions: 12,
          },
          subscription: {
            id: 'sub-ines-2024',
            planName: 'HYBRIDE',
            monthlyPrice: 720,
            creditsPerMonth: 6,
            status: SubscriptionStatus.ACTIVE,
            startDate: new Date('2024-09-01T00:00:00.000Z'),
            endDate: null,
            ariaSubjects: ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'],
            ariaCost: 140,
          },
          creditTransactions: [
            {
              id: 'ctrx-ines-alloc-oct',
              type: 'MONTHLY_ALLOCATION',
              amount: 6,
              description: 'Allocation mensuelle de crédits - Octobre',
              createdAt: new Date('2024-10-01T08:00:00.000Z'),
            },
            {
              id: 'ctrx-ines-usage-lab',
              type: 'USAGE',
              amount: -1.5,
              description: 'Stage laboratoires de physique',
              sessionId: 'session-ines-phys-lab',
              createdAt: new Date('2024-10-05T19:00:00.000Z'),
            },
          ],
          sessions: [
            {
              id: 'session-ines-analyse',
              coachPseudonym: 'Hélios',
              type: ServiceType.COURS_ONLINE,
              subject: Subject.MATHEMATIQUES,
              title: 'Approfondissement — Suites et séries',
              description: 'Focus sur convergence et sommes d’une suite géométrique.',
              scheduledAt: new Date('2024-11-21T17:00:00.000Z'),
              duration: 75,
              location: 'Salle virtuelle Nexus',
              creditCost: 1.5,
              status: SessionStatus.CONFIRMED,
            },
            {
              id: 'session-ines-phys-lab',
              coachPseudonym: 'Hermès',
              type: ServiceType.COURS_PRESENTIEL,
              subject: Subject.PHYSIQUE_CHIMIE,
              title: 'Physique appliquée — Optique',
              description: 'Expériences sur l’optique et interprétation des résultats.',
              scheduledAt: new Date('2024-10-05T17:30:00.000Z'),
              duration: 90,
              location: 'Lab Nexus — Tunis',
              creditCost: 1.5,
              status: SessionStatus.COMPLETED,
              report: 'Travail sérieux, notions d’optique géométrique maîtrisées, prévoir un exercice de synthèse.',
              reportedAt: new Date('2024-10-05T19:30:00.000Z'),
            },
          ],
          reports: [
            {
              id: 'report-ines-oct-2024',
              coachPseudonym: 'Hélios',
              title: 'Synthèse octobre — Terminale Spécialité Sciences',
              content: 'Inès maintient une excellente cadence et anticipe les sujets difficiles. Point à renforcer : restitution orale des démonstrations.',
              period: 'Octobre 2024',
              sessionsCount: 4,
              averageGrade: 15.8,
              progressNotes: 'Maîtrise accrue des probabilités conditionnelles et du calcul vectoriel.',
              recommendations: 'Planifier un oral blanc sur les probabilités discrètes.',
            },
          ],
          ariaConversations: [
            {
              id: 'aria-ines-proba',
              subject: Subject.MATHEMATIQUES,
              title: 'Réviser les probabilités conditionnelles',
              messages: [
                {
                  id: 'aria-ines-proba-1',
                  role: 'user',
                  content: 'Peux-tu me donner un exercice clé sur les probabilités conditionnelles ?',
                },
                {
                  id: 'aria-ines-proba-2',
                  role: 'assistant',
                  content: 'Bien sûr, voici un exercice type concours avec correction détaillée.',
                },
              ],
            },
          ],
          badges: [
            { name: 'Assiduité', earnedAt: new Date('2024-10-10T10:00:00.000Z') },
            { name: 'Curiosité RAG', earnedAt: new Date('2024-10-18T09:30:00.000Z') },
          ],
        },
      ],
    },
    {
      parent: {
        email: 'mehdi.jlassi@example.com',
        firstName: 'Mehdi',
        lastName: 'Jlassi',
        phone: '+216 23 445 667',
        address: '18 Avenue Habib Bourguiba',
        city: 'Sfax',
        country: 'Tunisie',
      },
      students: [
        {
          email: 'amal.jlassi@example.com',
          firstName: 'Amal',
          lastName: 'Jlassi',
          phone: '+216 50 112 223',
          profile: {
            grade: 'Première — Série Économie & Gestion',
            school: 'Lycée Monji Slim',
            birthDate: new Date('2008-02-02T00:00:00.000Z'),
          },
          record: {
            credits: 9,
            totalSessions: 8,
            completedSessions: 6,
          },
          subscription: {
            id: 'sub-amal-2024',
            planName: 'ACCES_PLATEFORME',
            monthlyPrice: 420,
            creditsPerMonth: 3,
            status: SubscriptionStatus.ACTIVE,
            startDate: new Date('2024-09-15T00:00:00.000Z'),
            endDate: null,
            ariaSubjects: ['SES', 'FRANCAIS'],
            ariaCost: 80,
          },
          creditTransactions: [
            {
              id: 'ctrx-amal-pack-parcoursup',
              type: 'PURCHASE',
              amount: 4,
              description: 'Pack Parcoursup — crédits supplémentaires',
              createdAt: new Date('2024-10-12T09:00:00.000Z'),
            },
            {
              id: 'ctrx-amal-usage-oral',
              type: 'USAGE',
              amount: -1,
              description: 'Coaching oral Parcoursup',
              sessionId: 'session-amal-parcoursup',
              createdAt: new Date('2024-10-19T16:20:00.000Z'),
            },
          ],
          sessions: [
            {
              id: 'session-amal-ses',
              coachPseudonym: 'Clio',
              type: ServiceType.COURS_ONLINE,
              subject: Subject.SES,
              title: 'SES — Lecture critique de documents',
              description: 'Analyse de dossiers statistiques et rédaction de synthèses.',
              scheduledAt: new Date('2024-11-12T16:00:00.000Z'),
              duration: 60,
              location: 'Salle virtuelle Nexus',
              creditCost: 1,
              status: SessionStatus.SCHEDULED,
            },
            {
              id: 'session-amal-parcoursup',
              coachPseudonym: 'Athéna',
              type: ServiceType.ATELIER_GROUPE,
              subject: Subject.FRANCAIS,
              title: 'Atelier Parcoursup — Projet de formation motivé',
              description: 'Atelier collectif pour structurer et valoriser les PFMs.',
              scheduledAt: new Date('2024-10-19T15:00:00.000Z'),
              duration: 90,
              location: 'Campus Nexus — Sfax',
              creditCost: 1,
              status: SessionStatus.COMPLETED,
              report: 'Projet mieux structuré, encore un effort sur la personnalisation par formation.',
              reportedAt: new Date('2024-10-19T16:30:00.000Z'),
            },
          ],
          reports: [
            {
              id: 'report-amal-oct-2024',
              coachPseudonym: 'Athéna',
              title: 'Synthèse — Première Éco & Gestion',
              content: 'Amal progresse sur l’analyse de documents, poursuivre les entraînements oraux Parcoursup.',
              period: 'Octobre 2024',
              sessionsCount: 3,
              averageGrade: 14.2,
              progressNotes: 'Meilleure structuration des dissertations SES.',
              recommendations: 'Programmer un oral blanc Grand Oral en janvier.',
            },
          ],
          ariaConversations: [
            {
              id: 'aria-amal-parcoursup',
              subject: Subject.FRANCAIS,
              title: 'Argumentaire Parcoursup',
              messages: [
                {
                  id: 'aria-amal-parcoursup-1',
                  role: 'user',
                  content: 'Peux-tu analyser mon introduction pour un PFM ?'
                },
                {
                  id: 'aria-amal-parcoursup-2',
                  role: 'assistant',
                  content: 'Voici les points forts et les axes d’amélioration. Ajouter un exemple concret d’expérience.',
                },
              ],
            },
          ],
          badges: [
            { name: 'Progression continue', earnedAt: new Date('2024-10-25T11:00:00.000Z') },
          ],
        },
      ],
    },
    {
      parent: {
        email: 'contact.lazhar@example.com',
        firstName: 'Lazhar',
        lastName: 'Fethallah',
        phone: '+216 29 778 990',
        address: 'Résidence La Plage, Bloc B',
        city: 'Hammamet',
        country: 'Tunisie',
      },
      students: [
        {
          email: 'yasmine.fethallah@example.com',
          firstName: 'Yasmine',
          lastName: 'Fethallah',
          phone: '+216 55 778 110',
          profile: {
            grade: 'Terminale — Candidate libre',
            school: 'Candidat libre',
            birthDate: new Date('2006-09-30T00:00:00.000Z'),
          },
          record: {
            credits: 4,
            totalSessions: 5,
            completedSessions: 3,
          },
          subscription: {
            id: 'sub-yasmine-2024',
            planName: 'IMMERSION',
            monthlyPrice: 990,
            creditsPerMonth: 10,
            status: SubscriptionStatus.ACTIVE,
            startDate: new Date('2024-08-20T00:00:00.000Z'),
            endDate: null,
            ariaSubjects: ['PHILOSOPHIE', 'ANGLAIS', 'MATHEMATIQUES'],
            ariaCost: 200,
          },
          creditTransactions: [
            {
              id: 'ctrx-yasmine-immersion',
              type: 'PURCHASE',
              amount: 10,
              description: 'Pack immersion — crédits intensifs',
              createdAt: new Date('2024-09-01T10:00:00.000Z'),
            },
            {
              id: 'ctrx-yasmine-usage-oral',
              type: 'USAGE',
              amount: -2,
              description: 'Oral blanc Grand Oral',
              sessionId: 'session-yasmine-grand-oral',
              createdAt: new Date('2024-09-22T18:00:00.000Z'),
            },
          ],
          sessions: [
            {
              id: 'session-yasmine-grand-oral',
              coachPseudonym: 'Athéna',
              type: ServiceType.COURS_ONLINE,
              subject: Subject.PHILOSOPHIE,
              title: 'Grand Oral — Simulation complète',
              description: 'Simulation de 20 minutes suivie d’un feedback détaillé.',
              scheduledAt: new Date('2024-09-22T17:00:00.000Z'),
              duration: 80,
              location: 'Salle virtuelle Nexus',
              creditCost: 2,
              status: SessionStatus.COMPLETED,
              report: 'Oral dynamique, travailler la gestion du stress et l’ouverture finale.',
              reportedAt: new Date('2024-09-22T18:10:00.000Z'),
            },
            {
              id: 'session-yasmine-anglais',
              coachPseudonym: 'Hermès',
              type: ServiceType.COURS_ONLINE,
              subject: Subject.ANGLAIS,
              title: 'Anglais — Expression orale C1',
              description: 'Séance de préparation IELTS focale sur Speaking.',
              scheduledAt: new Date('2024-11-04T18:30:00.000Z'),
              duration: 60,
              location: 'Salle virtuelle Nexus',
              creditCost: 1.5,
              status: SessionStatus.CONFIRMED,
            },
          ],
          reports: [
            {
              id: 'report-yasmine-sept-2024',
              coachPseudonym: 'Athéna',
              title: 'Synthèse — Préparation Grand Oral',
              content: 'Yasmine progresse sur la posture, reste à sécuriser la structuration des arguments.',
              period: 'Septembre 2024',
              sessionsCount: 2,
              averageGrade: 16.5,
              progressNotes: 'Bonne mémorisation, améliorer la variation de la voix.',
              recommendations: 'Poursuivre les simulations toutes les deux semaines.',
            },
          ],
          ariaConversations: [
            {
              id: 'aria-yasmine-oral',
              subject: Subject.PHILOSOPHIE,
              title: 'Préparer un plan détaillé',
              messages: [
                {
                  id: 'aria-yasmine-oral-1',
                  role: 'user',
                  content: 'Aide-moi à structurer une introduction accrocheuse pour mon oral.',
                },
                {
                  id: 'aria-yasmine-oral-2',
                  role: 'assistant',
                  content: 'Commence par une anecdote courte liée au thème, puis annonce clairement ta problématique.',
                },
              ],
            },
          ],
          badges: [
            { name: 'Assiduité', earnedAt: new Date('2024-09-25T12:00:00.000Z') },
            { name: 'Progression continue', earnedAt: new Date('2024-10-02T09:00:00.000Z') },
          ],
        },
      ],
    },
  ];

  for (const family of diversifiedFamilies) {
    const parentUser = await prisma.user.upsert({
      where: { email: family.parent.email },
      update: {
        firstName: family.parent.firstName,
        lastName: family.parent.lastName,
        phone: family.parent.phone,
      },
      create: {
        email: family.parent.email,
        password: hashedParentPassword,
        firstName: family.parent.firstName,
        lastName: family.parent.lastName,
        phone: family.parent.phone,
        role: 'PARENT',
      },
    });

    const parentProfileRecord = await prisma.parentProfile.upsert({
      where: { userId: parentUser.id },
      update: {
        address: family.parent.address,
        city: family.parent.city,
        country: family.parent.country,
      },
      create: {
        userId: parentUser.id,
        address: family.parent.address,
        city: family.parent.city,
        country: family.parent.country,
      },
    });

    for (const studentSeed of family.students) {
      const studentUserRecord = await prisma.user.upsert({
        where: { email: studentSeed.email },
        update: {
          firstName: studentSeed.firstName,
          lastName: studentSeed.lastName,
          phone: studentSeed.phone,
        },
        create: {
          email: studentSeed.email,
          password: hashedStudentPassword,
          firstName: studentSeed.firstName,
          lastName: studentSeed.lastName,
          phone: studentSeed.phone,
          role: 'ELEVE',
        },
      });

      const studentProfileRecord = await prisma.studentProfile.upsert({
        where: { userId: studentUserRecord.id },
        update: {
          grade: studentSeed.profile.grade,
          school: studentSeed.profile.school,
          birthDate: studentSeed.profile.birthDate,
        },
        create: {
          userId: studentUserRecord.id,
          grade: studentSeed.profile.grade,
          school: studentSeed.profile.school,
          birthDate: studentSeed.profile.birthDate,
        },
      });

      const existingPortalStudent = await prisma.student.findUnique({ where: { userId: studentUserRecord.id } });
      const dashboardId = existingPortalStudent?.dashboardStudentId ?? computeDashboardId(studentSeed.email);

      const studentRecord = await prisma.student.upsert({
        where: { userId: studentUserRecord.id },
        update: {
          parentId: parentProfileRecord.id,
          credits: studentSeed.record.credits,
          totalSessions: studentSeed.record.totalSessions,
          completedSessions: studentSeed.record.completedSessions,
          grade: studentSeed.profile.grade,
          school: studentSeed.profile.school,
          birthDate: studentSeed.profile.birthDate,
          dashboardStudentId: dashboardId,
        },
        create: {
          userId: studentUserRecord.id,
          parentId: parentProfileRecord.id,
          credits: studentSeed.record.credits,
          totalSessions: studentSeed.record.totalSessions,
          completedSessions: studentSeed.record.completedSessions,
          grade: studentSeed.profile.grade,
          school: studentSeed.profile.school,
          birthDate: studentSeed.profile.birthDate,
          dashboardStudentId: dashboardId,
        },
      });

      if (studentSeed.subscription) {
        await prisma.subscription.upsert({
          where: { id: studentSeed.subscription.id },
          update: {
            planName: studentSeed.subscription.planName,
            monthlyPrice: studentSeed.subscription.monthlyPrice,
            creditsPerMonth: studentSeed.subscription.creditsPerMonth,
            status: studentSeed.subscription.status,
            startDate: studentSeed.subscription.startDate,
            endDate: studentSeed.subscription.endDate,
            ariaSubjects: JSON.stringify(studentSeed.subscription.ariaSubjects),
            ariaCost: studentSeed.subscription.ariaCost,
          },
          create: {
            id: studentSeed.subscription.id,
            studentId: studentRecord.id,
            planName: studentSeed.subscription.planName,
            monthlyPrice: studentSeed.subscription.monthlyPrice,
            creditsPerMonth: studentSeed.subscription.creditsPerMonth,
            status: studentSeed.subscription.status,
            startDate: studentSeed.subscription.startDate,
            endDate: studentSeed.subscription.endDate,
            ariaSubjects: JSON.stringify(studentSeed.subscription.ariaSubjects),
            ariaCost: studentSeed.subscription.ariaCost,
          },
        });
      }

      for (const transaction of studentSeed.creditTransactions ?? []) {
        const expiresAt = (transaction as { expiresAt?: Date | null }).expiresAt ?? null;
        await prisma.creditTransaction.upsert({
          where: { id: transaction.id },
          update: {
            studentId: studentRecord.id,
            type: transaction.type,
            amount: transaction.amount,
            description: transaction.description,
            sessionId: transaction.sessionId ?? null,
            expiresAt,
            createdAt: transaction.createdAt,
          },
          create: {
            id: transaction.id,
            studentId: studentRecord.id,
            type: transaction.type,
            amount: transaction.amount,
            description: transaction.description,
            sessionId: transaction.sessionId ?? null,
            expiresAt,
            createdAt: transaction.createdAt,
          },
        });
      }

      for (const session of studentSeed.sessions ?? []) {
        const coach = coachByPseudonym.get(session.coachPseudonym);
        if (!coach) {
          console.warn(`Impossible de trouver le coach ${session.coachPseudonym} pour la session ${session.id}`);
          continue;
        }

        await prisma.session.upsert({
          where: { id: session.id },
          update: {
            studentId: studentRecord.id,
            coachId: coach.id,
            type: session.type,
            subject: session.subject,
            title: session.title,
            description: session.description,
            scheduledAt: session.scheduledAt,
            duration: session.duration,
            location: session.location,
            creditCost: session.creditCost,
            status: session.status,
            report: session.report ?? null,
            reportedAt: session.reportedAt ?? null,
          },
          create: {
            id: session.id,
            studentId: studentRecord.id,
            coachId: coach.id,
            type: session.type,
            subject: session.subject,
            title: session.title,
            description: session.description,
            scheduledAt: session.scheduledAt,
            duration: session.duration,
            location: session.location,
            creditCost: session.creditCost,
            status: session.status,
            report: session.report ?? null,
            reportedAt: session.reportedAt ?? null,
          },
        });
      }

      for (const report of studentSeed.reports ?? []) {
        const coach = coachByPseudonym.get(report.coachPseudonym);
        if (!coach) {
          console.warn(`Impossible de trouver le coach ${report.coachPseudonym} pour le rapport ${report.id}`);
          continue;
        }

        await prisma.studentReport.upsert({
          where: { id: report.id },
          update: {
            studentId: studentRecord.id,
            coachId: coach.id,
            title: report.title,
            content: report.content,
            period: report.period,
            sessionsCount: report.sessionsCount,
            averageGrade: report.averageGrade,
            progressNotes: report.progressNotes,
            recommendations: report.recommendations,
          },
          create: {
            id: report.id,
            studentId: studentRecord.id,
            coachId: coach.id,
            title: report.title,
            content: report.content,
            period: report.period,
            sessionsCount: report.sessionsCount,
            averageGrade: report.averageGrade,
            progressNotes: report.progressNotes,
            recommendations: report.recommendations,
          },
        });
      }

      for (const badge of studentSeed.badges ?? []) {
        const badgeId = badgeMap[badge.name];
        if (!badgeId) {
          console.warn(`Badge ${badge.name} introuvable, vérifiez la configuration.`);
          continue;
        }

        await prisma.studentBadge.upsert({
          where: {
            studentId_badgeId: {
              studentId: studentRecord.id,
              badgeId,
            },
          },
          update: {
            earnedAt: badge.earnedAt,
          },
          create: {
            studentId: studentRecord.id,
            badgeId,
            earnedAt: badge.earnedAt,
          },
        });
      }

      for (const conversation of studentSeed.ariaConversations ?? []) {
        const conversationRecord = await prisma.ariaConversation.upsert({
          where: { id: conversation.id },
          update: {
            studentId: studentRecord.id,
            subject: conversation.subject,
            title: conversation.title,
          },
          create: {
            id: conversation.id,
            studentId: studentRecord.id,
            subject: conversation.subject,
            title: conversation.title,
          },
        });

        for (const message of conversation.messages ?? []) {
          const feedback = (message as { feedback?: boolean | null }).feedback ?? null;
          await prisma.ariaMessage.upsert({
            where: { id: message.id },
            update: {
              conversationId: conversationRecord.id,
              role: message.role,
              content: message.content,
              feedback,
            },
            create: {
              id: message.id,
              conversationId: conversationRecord.id,
              role: message.role,
              content: message.content,
              feedback,
            },
          });
        }
      }

      console.log(`Profil élève enrichi: ${studentSeed.firstName} ${studentSeed.lastName}`);
    }
  }

  console.log('Seed enrichi terminé avec profils diversifiés.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
