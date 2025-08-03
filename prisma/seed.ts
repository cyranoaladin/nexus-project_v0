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

  console.log('Utilisateur test créé:', testUser);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
