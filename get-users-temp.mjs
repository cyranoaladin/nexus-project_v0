import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'ASSISTANTE'] } },
    select: { email: true, role: true, password: true, firstName: true, lastName: true },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
  });
  console.table(users);
}
main().finally(() => prisma.$disconnect());
