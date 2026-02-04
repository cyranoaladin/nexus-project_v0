import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkParentProfile() {
    // Find parent user
    const parentUser = await prisma.user.findUnique({
        where: { email: 'parent@example.com' },
        include: {
            parentProfile: {
                include: {
                    children: {
                        include: {
                            user: true
                        }
                    }
                }
            }
        }
    });

    console.log('Parent User:', JSON.stringify(parentUser, null, 2));

    if (parentUser && !parentUser.parentProfile) {
        console.log('Creating missing parent profile...');
        const profile = await prisma.parentProfile.create({
            data: {
                userId: parentUser.id,
                address: '123 Rue Test',
                city: 'Tunis',
                country: 'Tunisie'
            }
        });
        console.log('Created profile:', profile);
    }

    await prisma.$disconnect();
}

checkParentProfile();
