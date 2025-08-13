import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Créer un utilisateur admin par défaut
  const hashedPassword = await bcrypt.hash('admin123', 10);

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
      await prisma.coachAvailability.create({
        data: {
          coachId: coachUser.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          specificDate: null,
          isAvailable: true,
          isRecurring: true,
          validFrom: new Date(),
          validUntil: null
        }
      });
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

  const studentProfile = await prisma.studentProfile.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id,
      grade: 'TERMINALE',
      school: 'Lycée Pilote'
    },
  });

  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id,
      parentId: parentProfile.id,
      credits: 10,
      totalSessions: 0,
      completedSessions: 0
    },
  });

  console.log('Utilisateur test créé:', testUser);
  console.log('Parent et étudiant créés:', { parent: parentProfile, student: student });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
