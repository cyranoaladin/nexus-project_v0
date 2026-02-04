import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getUserIds() {
    const users = await prisma.user.findMany({
        where: {
            email: {
                in: ['parent@example.com', 'student@example.com', 'coach@example.com']
            }
        },
        select: {
            id: true,
            email: true,
            role: true
        }
    });

    console.log(JSON.stringify(users, null, 2));
    await prisma.$disconnect();
}

getUserIds();
