const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://nexus_admin:Wq8h4k2j9m5p1q3r7@localhost:5432/nexus_prod',
    },
  },
});

async function main() {
  console.log('🔍 Vérification du statut des bilans...');

  // Check Lamis's bilan
  const lamisBilan = await prisma.bilan.findFirst({
    where: {
      studentId: 'cmoh7fpsn0002mgqsnw0vupv5',
      type: 'STAGE_POST',
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      isPublished: true,
      publishedAt: true,
      subject: true,
      parentsMarkdown: true,
    },
  });

  console.log('📋 Bilan Lamis:', lamisBilan ? {
    id: lamisBilan.id,
    isPublished: lamisBilan.isPublished,
    publishedAt: lamisBilan.publishedAt,
    subject: lamisBilan.subject,
    hasParentsMarkdown: !!lamisBilan.parentsMarkdown,
  } : 'Non trouvé');

  // Publish Lamis's bilan if not published
  if (lamisBilan && !lamisBilan.isPublished) {
    console.log('📤 Publication du bilan de Lamis...');
    await prisma.bilan.update({
      where: { id: lamisBilan.id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    console.log('✅ Bilan publié');
  }

  // Check parent profiles
  const asmaUser = await prisma.user.findUnique({
    where: { email: 'asma.boulares.temp@nexusreussite.academy' },
  });

  const asmaParent = asmaUser ? await prisma.parentProfile.findUnique({
    where: { userId: asmaUser.id },
    include: { children: true },
  }) : null;

  console.log('👩 Profil parent Asma:', asmaParent ? {
    userId: asmaParent.userId,
    childrenCount: asmaParent.children.length,
    children: asmaParent.children.map(c => ({ id: c.id, email: c.user?.email })),
  } : 'Non trouvé');

  const hasnaeParent = await prisma.parentProfile.findFirst({
    where: { user: { email: 'hasnae.maghrebi@ert.tn' } },
    include: { children: true },
  });

  console.log('👩 Profil parent Hasnae:', hasnaeParent ? {
    userId: hasnaeParent.userId,
    childrenCount: hasnaeParent.children.length,
    children: hasnaeParent.children.map(c => ({ id: c.id, email: c.user?.email })),
  } : 'Non trouvé');
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
