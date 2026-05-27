/**
 * Seed script to create a demo student profile with diagnostic bilan.
 * Scope: LOCAL | STAGING only — never run in production.
 *
 * Run: SEED_PASSWORD=changeme npx tsx prisma/seed-demo-student.ts
 */

import {
  AcademicTrack,
  BilanStatus,
  GradeLevel,
  PrismaClient,
  Subject,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: This seed script must not run in production.');
    console.error('       Set NODE_ENV to "development" or "staging".');
    process.exit(1);
  }

  console.log('🌱 Seeding demo student + coach...');

  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) {
    console.error('ERROR: SEED_PASSWORD env var required');
    process.exit(1);
  }
  const hashedPassword = await bcrypt.hash(seedPassword, 12);

  // ──── 1. Load diagnostic JSON ─────────────────────────────────────────────
  const diagnosticPath = path.resolve(__dirname, '../diagnostic.example.json');
  if (!fs.existsSync(diagnosticPath)) {
    console.error(`ERROR: diagnostic.example.json not found at ${diagnosticPath}`);
    process.exit(1);
  }
  const diagnosticRaw = fs.readFileSync(diagnosticPath, 'utf-8');
  const diagnosticJson = JSON.parse(diagnosticRaw);
  console.log(
    `  📄 Loaded diagnostic JSON (step: ${diagnosticJson.step}, QCM score: ${diagnosticJson.evaluatedData?.qcmRawScore}/${diagnosticJson.evaluatedData?.qcmMaxScore})`,
  );

  // ──── 2. Create Coach ─────────────────────────────────────────────────────
  const coachUser = await prisma.user.upsert({
    where: { email: 'coach.demo@nexus-reussite.com' },
    update: { activatedAt: new Date() },
    create: {
      email: 'coach.demo@nexus-reussite.com',
      password: hashedPassword,
      firstName: 'Hélio',
      lastName: 'DEMO',
      role: 'COACH',
      activatedAt: new Date(),
    },
  });
  console.log(`  ✅ Coach user: ${coachUser.email} (id: ${coachUser.id})`);

  const coachProfile = await prisma.coachProfile.upsert({
    where: { userId: coachUser.id },
    update: {
      subjects: [Subject.MATHEMATIQUES],
    },
    create: {
      userId: coachUser.id,
      pseudonym: 'Coach Hélio',
      subjects: [Subject.MATHEMATIQUES],
      title: 'Professeur de Mathématiques',
      description: 'Spécialiste Terminale EDS — Préparation Bac',
    },
  });
  console.log(`  ✅ Coach profile: ${coachProfile.pseudonym} (id: ${coachProfile.id})`);

  // ──── 3. Create Parent profile (required FK) ──────────────────────────────
  const parentEmail = 'parent.demo@nexus-reussite.com';
  const parentUser = await prisma.user.upsert({
    where: { email: parentEmail },
    update: { activatedAt: new Date() },
    create: {
      email: parentEmail,
      password: hashedPassword,
      firstName: 'Samia',
      lastName: 'DEMO',
      role: 'PARENT',
      activatedAt: new Date(),
    },
  });
  const parentProfile = await prisma.parentProfile.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: { userId: parentUser.id },
  });
  console.log(`  ✅ Parent profile: ${parentProfile.id}`);

  // ──── 4. Create Student ───────────────────────────────────────────────────
  const studentEmail = 'eleve.demo@nexus-reussite.com';
  const studentUser = await prisma.user.upsert({
    where: { email: studentEmail },
    update: { activatedAt: new Date() },
    create: {
      email: studentEmail,
      password: hashedPassword,
      firstName: 'Yassine',
      lastName: 'DEMO',
      role: 'ELEVE',
      activatedAt: new Date(),
    },
  });
  console.log(`  ✅ Student user: ${studentUser.email} (id: ${studentUser.id})`);

  const studentProfile = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {
      grade: 'TERMINALE',
      gradeLevel: GradeLevel.TERMINALE,
      academicTrack: AcademicTrack.EDS_GENERALE,
      specialties: [Subject.MATHEMATIQUES],
      updatedTrackAt: new Date(),
    },
    create: {
      userId: studentUser.id,
      grade: 'TERMINALE',
      gradeLevel: GradeLevel.TERMINALE,
      academicTrack: AcademicTrack.EDS_GENERALE,
      specialties: [Subject.MATHEMATIQUES],
      updatedTrackAt: new Date(),
      credits: 10,
      parentId: parentProfile.id,
    },
  });
  console.log(
    `  ✅ Student profile: ${studentProfile.id} (TERMINALE / EDS_GENERALE / MATHEMATIQUES)`,
  );

  // ──── 5. Create CoachStudentAssignment ────────────────────────────────────
  const existingAssignment = await prisma.coachStudentAssignment.findFirst({
    where: {
      coachId: coachProfile.id,
      studentId: studentProfile.id,
      status: 'ACTIVE',
    },
  });

  if (!existingAssignment) {
    await prisma.coachStudentAssignment.create({
      data: {
        coachId: coachProfile.id,
        studentId: studentProfile.id,
        assignmentType: 'PRIMARY',
        status: 'ACTIVE',
        subjects: [Subject.MATHEMATIQUES],
        notes: 'Coach principal — Demo seed',
        startsAt: new Date(),
      },
    });
    console.log(`  ✅ CoachStudentAssignment created (ACTIVE / PRIMARY)`);
  } else {
    console.log(`  ⏭️  CoachStudentAssignment already exists`);
  }

  // ──── 6. Create SessionBooking (needed for coach dashboard discovery) ─────
  const bookingId = 'seed-booking-demo-student';
  await prisma.sessionBooking.upsert({
    where: { id: bookingId },
    update: {
      studentId: studentUser.id,
      coachId: coachUser.id,
    },
    create: {
      id: bookingId,
      studentId: studentUser.id,
      coachId: coachUser.id,
      subject: Subject.MATHEMATIQUES,
      title: 'Session Diagnostic — Analyse du bilan',
      scheduledDate: new Date('2026-04-28T09:00:00.000Z'),
      startTime: '09:00',
      endTime: '11:00',
      duration: 120,
      status: 'CONFIRMED',
      coachNotes: 'Première session — Analyse du bilan diagnostic',
    },
  });
  console.log(`  ✅ SessionBooking created for dashboard visibility`);

  // ──── 7. Build and insert Bilan ───────────────────────────────────────────
  const {
    progress,
    qcmAnswers,
    openAnswers,
    teacherGrades,
    isTeacherGraded,
    evaluatedData,
    step,
  } = diagnosticJson;

  const sourceData = {
    version: 'maths_terminale_v1',
    progress,
    qcmAnswers,
    openAnswers,
    teacherGrades: teacherGrades || {},
    isTeacherGraded: isTeacherGraded || false,
    evaluatedData,
    step: step || 'results',
  };

  const domainScores = evaluatedData.domainScores
    ? Object.entries(evaluatedData.domainScores).map(([domainId, score]) => ({
        domainId,
        domain: domainId,
        score: score as number,
      }))
    : [];

  const bilanId = 'seed-bilan-demo-maths-terminale';
  await prisma.bilan.upsert({
    where: { id: bilanId },
    update: {
      studentId: studentProfile.id,
      studentEmail: studentEmail,
      studentName: 'Yassine DEMO',
      sourceData: sourceData as any,
      globalScore: evaluatedData.qcmPercentage ?? 67,
      domainScores: domainScores as any,
      status: BilanStatus.SCORING,
      progress: 100,
    },
    create: {
      id: bilanId,
      type: 'DIAGNOSTIC_PRE_STAGE',
      subject: 'MATHEMATIQUES',
      studentId: studentProfile.id,
      studentEmail: studentEmail,
      studentName: 'Yassine DEMO',
      sourceData: sourceData as any,
      globalScore: evaluatedData.qcmPercentage ?? 67,
      domainScores: domainScores as any,
      sourceVersion: 'maths_terminale_v1',
      status: BilanStatus.SCORING,
      progress: 100,
    },
  });
  console.log(
    `  ✅ Bilan DIAGNOSTIC_PRE_STAGE created (status: SCORING, globalScore: ${evaluatedData.qcmPercentage}%)`,
  );

  // ──── Summary ─────────────────────────────────────────────────────────────
  console.log('\n🎯 Seed complete! Login credentials:');
  console.log('  📚 Élève     : eleve.demo@nexus-reussite.com / <SEED_PASSWORD>');
  console.log('  🎓 Coach     : coach.demo@nexus-reussite.com / <SEED_PASSWORD>');
  console.log('\n  Workflow:');
  console.log('  1. Élève se connecte → Dashboard → Bilan Diagnostic visible');
  console.log('  2. Coach se connecte → Dashboard → Alerte "Bilan à corriger" → Dossier élève');
  console.log('  3. Le coach corrige les exercices ouverts → Score final + Parcours généré');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
