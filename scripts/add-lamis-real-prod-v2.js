
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = 'the.lamoussa1@gmail.com';
  const hashedPassword = '$2b$10$Zpv9VyqWDFhFKT8lJsk87uQcrwXhyk.jhtXAOx75TMIHOKDuA3A5W';

  console.log(`🚀 Création de l'élève Lamis dans la VRAIE base de production (V2)...`);

  // 1. Création de l'utilisateur élève
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      activatedAt: new Date(),
    },
    create: {
      email,
      password: hashedPassword,
      role: 'ELEVE',
      firstName: 'Lamis',
      activatedAt: new Date(),
    }
  });
  console.log(`✅ Utilisateur élève : ${user.email} (${user.id})`);

  // 2. Création de l'utilisateur parent
  const parentEmail = 'parent.lamis@nexus.tn';
  const parentUser = await prisma.user.upsert({
    where: { email: parentEmail },
    update: {},
    create: {
      email: parentEmail,
      password: hashedPassword, // peu importe
      role: 'PARENT',
      firstName: 'Parent',
      lastName: 'Lamis',
      activatedAt: new Date()
    }
  });
  console.log(`✅ Utilisateur parent : ${parentUser.email}`);

  // 3. Création du profil parent
  const parentProfile = await prisma.parentProfile.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: {
      userId: parentUser.id
    }
  });
  console.log(`✅ Profil Parent créé`);

  // 4. Création du profil Student
  const student = await prisma.student.upsert({
    where: { userId: user.id },
    update: {
      parentId: parentProfile.id,
      academicTrack: 'STMG',
      gradeLevel: 'PREMIERE',
      grade: 'Première',
      credits: 10,
    },
    create: {
      userId: user.id,
      parentId: parentProfile.id,
      academicTrack: 'STMG',
      gradeLevel: 'PREMIERE',
      grade: 'Première',
      credits: 10,
    }
  });
  console.log(`✅ Profil Étudiant créé/mis à jour (STMG, Première)`);

  // 5. Entitlements
  const entitlements = [
    { code: 'ABONNEMENT_HYBRIDE', label: 'Abonnement Hybride (Premium)' },
    { code: 'ARIA_ADDON_MATHS', label: 'ARIA — Maths STMG' },
  ];

  for (const ent of entitlements) {
    const existing = await prisma.entitlement.findFirst({
      where: { userId: user.id, productCode: ent.code, status: 'ACTIVE' }
    });
    if (!existing) {
      await prisma.entitlement.create({
        data: {
          userId: user.id,
          productCode: ent.code,
          label: ent.label,
          status: 'ACTIVE',
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      });
      console.log(`✅ Entitlement ajouté : ${ent.code}`);
    }
  }

  // 6. Subscription
  const existingSub = await prisma.subscription.findFirst({
    where: { studentId: student.id, status: 'ACTIVE' }
  });
  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        studentId: student.id,
        planName: 'Hybride',
        monthlyPrice: 350,
        creditsPerMonth: 8,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ariaSubjects: ['MATHEMATIQUES'],
        ariaCost: 0
      }
    });
    console.log(`✅ Abonnement actif ajouté`);
  }

  console.log(`🎉 Lamis est maintenant configurée en PRODUCTION réelle !`);
}

main()
  .catch(e => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
