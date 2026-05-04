const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://nexus_admin:Wq8h4k2j9m5p1q3r7@localhost:5432/nexus_prod',
    },
  },
});

async function main() {
  console.log('🔑 Définition des mots de passe parents...');

  // Set password for hasnae.maghrebi@ert.tn
  const hasnaeUser = await prisma.user.findUnique({
    where: { email: 'hasnae.maghrebi@ert.tn' },
  });

  if (hasnaeUser) {
    const hasnaePassword = 'NexusParent2026!';
    await prisma.user.update({
      where: { id: hasnaeUser.id },
      data: { password: hasnaePassword },
    });
    console.log('✅ Mot de passe défini pour hasnae.maghrebi@ert.tn:', hasnaePassword);
  } else {
    console.log('❌ Utilisateur hasnae.maghrebi@ert.tn non trouvé');
  }

  // Set password for asma.boulares.temp@nexusreussite.academy
  const asmaUser = await prisma.user.findUnique({
    where: { email: 'asma.boulares.temp@nexusreussite.academy' },
  });

  if (asmaUser) {
    const asmaPassword = 'NexusParent2026!';
    await prisma.user.update({
      where: { id: asmaUser.id },
      data: { password: asmaPassword },
    });
    console.log('✅ Mot de passe défini pour asma.boulares.temp@nexusreussite.academy:', asmaPassword);
  } else {
    console.log('❌ Utilisateur asma.boulares.temp@nexusreussite.academy non trouvé');
  }

  console.log('\n📝 Mots de passe:');
  console.log('🔐 hasnae.maghrebi@ert.tn: NexusParent2026!');
  console.log('🔐 asma.boulares.temp@nexusreussite.academy: NexusParent2026!');
  console.log('\n⚠️ Les parents devront changer leur mot de passe lors de la première connexion.');
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
