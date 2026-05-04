const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://nexus_admin:Wq8h4k2j9m5p1q3r7@localhost:5432/nexus_prod',
    },
  },
});

async function main() {
  console.log('🚀 Création des comptes parents...');

  // 1. Find Leyna MAGHREBI
  const leyna = await prisma.user.findFirst({
    where: {
      lastName: { contains: 'MAGHREBI' },
      firstName: { contains: 'Leyna' },
    },
  });

  console.log('🔍 Recherche Leyna MAGHREBI:', leyna ? { id: leyna.id, name: `${leyna.firstName} ${leyna.lastName}` } : 'Non trouvée');

  if (!leyna) {
    console.error('❌ Leyna MAGHREBI non trouvée');
    process.exit(1);
  }

  // 2. Find Lamis
  const lamis = await prisma.student.findUnique({
    where: { id: 'cmoh7fpsn0002mgqsnw0vupv5' },
    include: { user: true },
  });

  console.log('🔍 Recherche Lamis:', lamis ? { id: lamis.id, name: `${lamis.user.firstName} ${lamis.user.lastName}` } : 'Non trouvée');

  if (!lamis) {
    console.error('❌ Lamis non trouvée');
    process.exit(1);
  }

  // 3. Create user for hasnae.maghrebi@ert.tn
  const hasnaeEmail = 'hasnae.maghrebi@ert.tn';

  let hasnaeUser = await prisma.user.findUnique({
    where: { email: hasnaeEmail },
  });

  if (!hasnaeUser) {
    hasnaeUser = await prisma.user.create({
      data: {
        email: hasnaeEmail,
        role: 'PARENT',
        firstName: 'Hasnae',
        lastName: 'Maghrebi',
        activatedAt: new Date(),
      },
    });
    console.log('✅ Utilisateur créé:', hasnaeEmail);
  } else {
    console.log('ℹ️ Utilisateur existe déjà:', hasnaeEmail);
  }

  // 4. Create parent profile for Hasnae and link to Leyna
  let hasnaeProfile = await prisma.parentProfile.findUnique({
    where: { userId: hasnaeUser.id },
  });

  if (!hasnaeProfile) {
    hasnaeProfile = await prisma.parentProfile.create({
      data: {
        userId: hasnaeUser.id,
        children: { connect: [{ id: leyna.student?.id || leyna.id }] },
      },
    });
    console.log('✅ Profil parent créé pour Hasnae');
  } else {
    // Check if Leyna is already linked
    const currentChildren = await prisma.parentProfile.findUnique({
      where: { userId: hasnaeUser.id },
      select: { children: true },
    });

    const leynaStudentId = leyna.student?.id;
    const isLinked = currentChildren?.children.some((c) => c.id === leynaStudentId);

    if (!isLinked && leynaStudentId) {
      await prisma.parentProfile.update({
        where: { userId: hasnaeUser.id },
        data: {
          children: { connect: [{ id: leynaStudentId }] },
        },
      });
      console.log('✅ Leyna liée au profil parent de Hasnae');
    } else {
      console.log('ℹ️ Leyna déjà liée au profil parent de Hasnae');
    }
  }

  // 5. Create user for Asma Boulares with temporary email
  const asmaEmail = 'asma.boulares.temp@nexusreussite.academy';

  let asmaUser = await prisma.user.findUnique({
    where: { email: asmaEmail },
  });

  if (!asmaUser) {
    asmaUser = await prisma.user.create({
      data: {
        email: asmaEmail,
        role: 'PARENT',
        firstName: 'Asma',
        lastName: 'Boulares',
        activatedAt: new Date(),
      },
    });
    console.log('✅ Utilisateur créé (temporaire):', asmaEmail);
  } else {
    console.log('ℹ️ Utilisateur existe déjà:', asmaEmail);
  }

  // 6. Create parent profile for Asma and link to Lamis
  let asmaProfile = await prisma.parentProfile.findUnique({
    where: { userId: asmaUser.id },
  });

  if (!asmaProfile) {
    asmaProfile = await prisma.parentProfile.create({
      data: {
        userId: asmaUser.id,
        children: { connect: [{ id: lamis.id }] },
      },
    });
    console.log('✅ Profil parent créé pour Asma');
  } else {
    // Check if Lamis is already linked
    const currentChildren = await prisma.parentProfile.findUnique({
      where: { userId: asmaUser.id },
      select: { children: true },
    });

    const isLinked = currentChildren?.children.some((c) => c.id === lamis.id);

    if (!isLinked) {
      await prisma.parentProfile.update({
        where: { userId: asmaUser.id },
        data: {
          children: { connect: [{ id: lamis.id }] },
        },
      });
      console.log('✅ Lamis liée au profil parent de Asma');
    } else {
      console.log('ℹ️ Lamis déjà liée au profil parent de Asma');
    }
  }

  console.log('\n✅ Comptes parents créés avec succès !');
  console.log('📧 Asma Boulares peut utiliser l\'email temporaire:', asmaEmail);
  console.log('⚠️ L\'email devra être mis à jour ultérieurement avec son adresse réelle.');
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
