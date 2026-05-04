const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const studentId = 'cmoh7fpsn0002mgqsnw0vupv5';
  
  console.log(`🚀 Correction des tableaux dans le bilan de Lamis (${studentId})...`);

  const existingBilan = await prisma.bilan.findFirst({
    where: {
      studentId,
      type: 'STAGE_POST',
      subject: 'STMG',
      sourceVersion: 'coach_maths_premiere_stage_printemps_v1'
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!existingBilan) {
    console.error('❌ Aucun bilan trouvé');
    process.exit(1);
  }

  const sourceData = existingBilan.sourceData;
  
  // Fix chapter diagnostics: convert strings to arrays
  if (sourceData.chapterDiagnostics) {
    Object.keys(sourceData.chapterDiagnostics).forEach(chapter => {
      const chapterData = sourceData.chapterDiagnostics[chapter];
      if (chapterData.methodsAcquired && typeof chapterData.methodsAcquired === 'string') {
        chapterData.methodsAcquired = chapterData.methodsAcquired.split(',').map(s => s.trim());
      }
      if (chapterData.vigilancePoints && typeof chapterData.vigilancePoints === 'string') {
        chapterData.vigilancePoints = chapterData.vigilancePoints.split(',').map(s => s.trim());
      }
      if (chapterData.recurringErrors && typeof chapterData.recurringErrors === 'string') {
        chapterData.recurringErrors = chapterData.recurringErrors.split(',').map(s => s.trim());
      }
    });
  }

  console.log('📝 Mise à jour du bilan...');
  const bilan = await prisma.bilan.update({
    where: { id: existingBilan.id },
    data: {
      sourceData: sourceData,
      updatedAt: new Date()
    }
  });
  
  console.log(`✅ Bilan corrigé: ${bilan.id}`);
  console.log(`🎉 Tableaux corrigés avec succès !`);
}

main()
  .catch(e => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
