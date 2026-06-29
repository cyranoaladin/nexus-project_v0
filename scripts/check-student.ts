import { PrismaClient } from '@prisma/client';
import { serializeError } from '@/lib/utils/serialize-error';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'audit.student.p1@nexus.test' },
    include: { student: true }
  });
  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch((error) => {
    console.error(serializeError(error));
  })
  .finally(() => prisma.$disconnect());
