const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://nexus_admin:NexusDB2026@nexus-postgres-prod:5432/nexus_prod?schema=public'
    }
  }
});

async function main() {
  console.log('🔍 Recherche de Lamis dans la base de données...');
  
  const students = await prisma.student.findMany({
    where: {
      user: {
        OR: [
          { firstName: { contains: 'Lamis', mode: 'insensitive' } },
          { lastName: { contains: 'Lamis', mode: 'insensitive' } },
          { email: { contains: 'lamis', mode: 'insensitive' } }
        ]
      }
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  console.log(`📊 ${students.length} élève(s) trouvé(s):`);
  students.forEach((s: any) => {
    console.log(`  - ID: ${s.id}, Nom: ${s.user.firstName} ${s.user.lastName}, Email: ${s.user.email}, Niveau: ${s.gradeLevel}, Filière: ${s.academicTrack}`);
  });

  if (students.length === 0) {
    console.log('❌ Aucun élève trouvé');
  } else {
    console.log(`✅ Premier élève ID: ${students[0].id}`);
  }
}

main()
  .catch(e => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
