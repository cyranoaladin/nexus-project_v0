import {
  AcademicTrack,
  BilanStatus,
  GradeLevel,
  PrismaClient,
  Subject,
} from '@prisma/client';

const prisma = new PrismaClient();

// Pre-calculated hash for "Nexus2026!"
const FIXED_HASH = '$2b$10$7q6ucHigT7EInls1W9HT8ODilo7gimaQFhS/tC57NGKNmQhsZHCpq';

async function main() {
  console.log('🌱 Seeding Zakaria AMAIMIA (PROD-SAFE VERSION)...');

  // ──── 1. Bilan Data (Simplified injection) ────────────────────────────────
  // Note: We'll read the JSON from the file since fs is a native module
  const fs = require('fs');
  const path = require('path');
  const diagnosticPath = path.resolve(__dirname, '../diagnostic_maths_Zakaria_AMAIMIA_2026-04-27.json');
  const diagnosticJson = JSON.parse(fs.readFileSync(diagnosticPath, 'utf-8'));

  // ──── 2. Create Coach: alaeddine.benrhouma@ert.tn ──────────────────────────
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
  console.log(`  ✅ Coach user: ${coachUser.email}`);

  const coachProfile = await prisma.coachProfile.upsert({
    where: { userId: coachUser.id },
    update: { subjects: [Subject.MATHEMATIQUES] },
    create: {
      userId: coachUser.id,
      pseudonym: 'Coach Alaeddine',
      subjects: [Subject.MATHEMATIQUES],
      title: 'Professeur de Mathématiques',
      description: 'Spécialiste Terminale EDS — Préparation Bac',
    },
  });

  // ──── 3. Create Parent profile ──────────────────────────────────────────
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

  // ──── 4. Create Student: Zakaria AMAIMIA ──────────────────────────────────
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

  const studentProfile = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {
      grade: 'TERMINALE',
      gradeLevel: GradeLevel.TERMINALE,
      academicTrack: AcademicTrack.EDS_GENERALE,
      specialties: [Subject.MATHEMATIQUES],
    },
    create: {
      userId: studentUser.id,
      grade: 'TERMINALE',
      gradeLevel: GradeLevel.TERMINALE,
      academicTrack: AcademicTrack.EDS_GENERALE,
      specialties: [Subject.MATHEMATIQUES],
      credits: 10,
      parentId: parentProfile.id,
    },
  });
  console.log(`  ✅ Student profile: ${studentEmail}`);

  // ──── 5. Create CoachStudentAssignment ─────────────────────────────────────
  await prisma.coachStudentAssignment.upsert({
    where: { id: 'assignment-zakaria-alaeddine' }, // We use a fixed ID for upsert here
    update: { status: 'ACTIVE' },
    create: {
      id: 'assignment-zakaria-alaeddine',
      coachId: coachProfile.id,
      studentId: studentProfile.id,
      assignmentType: 'PRIMARY',
      status: 'ACTIVE',
      subjects: [Subject.MATHEMATIQUES],
      startsAt: new Date(),
    },
  });

  // ──── 6. Session Booking ──────────────────────────────────────────────────
  const bookingId = 'seed-booking-zakaria-alaeddine';
  await prisma.sessionBooking.upsert({
    where: { id: bookingId },
    update: { scheduledDate: new Date('2026-04-28T09:00:00.000Z') },
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
    },
  });

  // ──── 7. Build and insert Bilan ────────────────────────────────────────────
  const { evaluatedData } = diagnosticJson;
  const domainScores = evaluatedData.domainScores
    ? Object.entries(evaluatedData.domainScores).map(([domainId, score]) => ({
        domainId,
        domain: domainId,
        score: score as number,
      }))
    : [];

  const bilanId = 'seed-bilan-zakaria-maths-terminale';
  await prisma.bilan.upsert({
    where: { id: bilanId },
    update: {
      sourceData: diagnosticJson as any,
      globalScore: evaluatedData.qcmPercentage ?? 67,
      status: BilanStatus.SCORING,
    },
    create: {
      id: bilanId,
      type: 'DIAGNOSTIC_PRE_STAGE',
      subject: 'MATHEMATIQUES',
      studentId: studentProfile.id,
      studentEmail: studentEmail,
      studentName: 'Zakaria AMAIMIA',
      sourceData: diagnosticJson as any,
      globalScore: evaluatedData.qcmPercentage ?? 67,
      domainScores: domainScores as any,
      sourceVersion: 'maths_terminale_v1',
      status: BilanStatus.SCORING,
      progress: 100,
    },
  });
  console.log(`  ✅ Bilan created for ${studentEmail}`);
  console.log('🎯 Seed complete!');
}

main()
  .catch((e) => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
