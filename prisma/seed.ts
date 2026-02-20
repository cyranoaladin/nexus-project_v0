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
