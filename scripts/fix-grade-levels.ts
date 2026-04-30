import { PrismaClient, GradeLevel, AcademicTrack } from '@prisma/client';
import { normalizeGradeLevel, getDefaultTrackForLevel, normalizeStudentLevelAndTrack } from '../lib/utils/grade-utils';

const prisma = new PrismaClient();

// Configuration
const DRY_RUN = process.env.DRY_RUN !== 'false'; // Par défaut true

async function main() {
  console.log('🚀 Starting GradeLevel synchronization and normalization...');
  console.log(`🔍 Mode: ${DRY_RUN ? 'DRY_RUN (Simulation)' : 'REAL_RUN (Modification)'}`);

  const students = await prisma.student.findMany({
    select: {
      id: true,
      userId: true,
      grade: true,
      gradeLevel: true,
      academicTrack: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        }
      }
    }
  });

  console.log(`📊 Found ${students.length} students to audit.`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const ambiguities: string[] = [];

  for (const student of students) {
    try {
      const gTrack = normalizeStudentLevelAndTrack(student.grade, student.academicTrack);
      
      if (!gTrack) {
        console.warn(`⚠️  Could not normalize grade "${student.grade}" for student ${student.user.email} (ID: ${student.id}). Skipping.`);
        ambiguities.push(`${student.user.email}: ${student.grade}`);
        skippedCount++;
        continue;
      }

      const normalizedLevel = gTrack.level;
      const normalizedTrack = gTrack.track;
      
      // Determine if update is needed
      const needsLevelUpdate = student.gradeLevel !== normalizedLevel;
      const needsTrackUpdate = student.academicTrack !== normalizedTrack;
      const needsGradeNormalize = student.grade !== normalizedLevel.toString();

      if (needsLevelUpdate || needsTrackUpdate || needsGradeNormalize) {
        console.log(`[${DRY_RUN ? 'SIM' : 'UPD'}] student ${student.id} (${student.user.email}):`);
        console.log(`    grade: "${student.grade}" -> "${normalizedLevel}"`);
        console.log(`    gradeLevel: ${student.gradeLevel} -> ${normalizedLevel}`);
        if (needsTrackUpdate) {
          console.log(`    academicTrack: ${student.academicTrack} -> ${normalizedTrack}`);
        }

        if (!DRY_RUN) {
          await prisma.$transaction(async (tx) => {
            await tx.student.update({
              where: { id: student.id },
              data: {
                gradeLevel: normalizedLevel,
                grade: normalizedLevel.toString(),
                academicTrack: normalizedTrack,
                updatedTrackAt: new Date(),
              }
            });
          });
        }
        
        updatedCount++;
      } else {
        skippedCount++;
      }
    } catch (err) {
      console.error(`❌ Error processing student ${student.id}:`, err);
      errorCount++;
    }
  }

  console.log('\n✨ Migration finished !');
  console.log(`✅ Students ${DRY_RUN ? 'to update' : 'updated'}: ${updatedCount}`);
  console.log(`⏭️  Students skipped/already OK: ${skippedCount}`);
  console.log(`⚠️  Errors: ${errorCount}`);
  
  if (ambiguities.length > 0) {
    console.log('\n❓ Ambiguous values found:');
    ambiguities.forEach(a => console.log(`  - ${a}`));
  }

  console.log(`\n📊 Total processed: ${students.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
