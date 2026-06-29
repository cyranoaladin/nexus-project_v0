import { PrismaClient } from '@prisma/client';
import { serializeError } from '@/lib/utils/serialize-error';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Attempting to connect to database...');
        console.log(`URL: ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@')}`); // Hide password in logs
        await prisma.$connect();
        console.log('✅ Connection successful!');
        const userCount = await prisma.user.count();
        console.log(`Found ${userCount} users in database.`);
    } catch (error) {
        console.error('❌ Connection failed:', serializeError(error));
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
