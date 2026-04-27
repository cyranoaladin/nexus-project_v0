const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FIXED_HASH = '$2b$10$7q6ucHigT7EInls1W9HT8ODilo7gimaQFhS/tC57NGKNmQhsZHCpq';

async function main() {
  console.log('🌱 Creating minimal accounts for Zakaria + Coach in production...');

  // 1. Coach
  const coachUser = await prisma.user.upsert({
    where: { email: 'alaeddine.benrhouma@ert.tn' },
    update: { activatedAt: new Date() },
    create: {
      email: 'alaeddine.benrhouma@ert.tn',
      password: FIXED_HASH,
      firstName: 'Alaeddine',
      lastName: 'Benrhouma',
      role: 'COACH',
      activatedAt: new Date(),
    },
  });
  
  await prisma.coachProfile.upsert({
    where: { userId: coachUser.id },
    update: {},
    create: {
      userId: coachUser.id,
      pseudonym: 'Coach Alaeddine',
      subjects: ['MATHEMATIQUES'],
    },
  });

  // 2. Parent
  const parentEmail = 'parent.amaimia@nexus-reussite.com';
  const parentUser = await prisma.user.upsert({
    where: { email: parentEmail },
    update: { activatedAt: new Date() },
    create: {
      email: parentEmail,
      password: FIXED_HASH,
      firstName: 'Parent',
      lastName: 'AMAIMIA',
      role: 'PARENT',
      activatedAt: new Date(),
    },
  });
  const parentProfile = await prisma.parentProfile.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: { userId: parentUser.id },
  });

  // 3. Student
  const studentEmail = 'zakaria.amaimia@nexus-reussite.com';
  const studentUser = await prisma.user.upsert({
    where: { email: studentEmail },
    update: { activatedAt: new Date() },
    create: {
      email: studentEmail,
      password: FIXED_HASH,
      firstName: 'Zakaria',
      lastName: 'AMAIMIA',
      role: 'ELEVE',
      activatedAt: new Date(),
    },
  });

  await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: { grade: 'Terminale' },
    create: {
      userId: studentUser.id,
      grade: 'Terminale',
      credits: 10,
      parentId: parentProfile.id,
    },
  });

  console.log('✅ Minimal accounts created! Login should work now.');
  console.log('⚠️ WARNING: The Diagnostic Bilan is NOT visible because the production schema is outdated.');
}

main()
  .catch((e) => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
