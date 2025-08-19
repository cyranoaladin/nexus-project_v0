import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function listUsers() {
  const users = await prisma.user.findMany();
  console.log(users);
}

listUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
