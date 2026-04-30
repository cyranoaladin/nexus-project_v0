import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const parents = await prisma.user.findMany({
    where: { role: 'PARENT' },
    include: { parentProfile: true },
    take: 5
  });
  console.log('Parents:', JSON.stringify(parents, null, 2));

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    include: { parentProfile: true },
    take: 5
  });
  console.log('Admins:', JSON.stringify(admins, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
