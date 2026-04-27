
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = 'the.lamoussa1@gmail.com';
  const hashedPassword = '$2b$10$Zpv9VyqWDFhFKT8lJsk87uQcrwXhyk.jhtXAOx75TMIHOKDuA3A5W'; // Hash pour 'Nexus2026!'

  console.log(`🚀 Création de l'élève Lamis dans la VRAIE base de production...`);

  // 1. Création de l'utilisateur
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
  console.log(`✅ Utilisateur : ${user.email} (${user.id})`);

  // 2. Création du profil parent par défaut (requis par Student)
  const parentEmail = 'parent.lamis@nexus.tn';
  const parent = await prisma.parentProfile.upsert({
    where: { email: parentEmail },
    update: {},
    create: {
      firstName: 'Parent',
      lastName: 'Lamis',
      email: parentEmail,
      userId: user.id // On le lie à l'utilisateur pour l'instant
    }
  });
  console.log(`✅ Profil Parent créé`);

  // 3. Création du profil Student
  const student = await prisma.student.upsert({
    where: { userId: user.id },
    update: {
      academicTrack: 'STMG',
      gradeLevel: 'PREMIERE',
      grade: 'Première',
      credits: 10,
    },
    create: {
      userId: user.id,
      parentId: parent.id,
      academicTrack: 'STMG',
      gradeLevel: 'PREMIERE',
      grade: 'Première',
      credits: 10,
    }
  });
  console.log(`✅ Profil Étudiant créé/mis à jour (STMG, Première)`);

  // 4. Entitlements
  const entitlements = [
    { code: 'ABONNEMENT_HYBRIDE', label: 'Abonnement Hybride (Premium)' },
    { code: 'ARIA_ADDON_MATHS', label: 'ARIA — Maths STMG' },
  ];

  for (const ent of entitlements) {
    // Note: Pas de contrainte unique sur Entitlement, on check manuellement
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

  // 5. Subscription
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
