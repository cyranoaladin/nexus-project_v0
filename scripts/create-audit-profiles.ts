import { PrismaClient, UserRole, Subject, MathsLevel } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creating Audit Test Profiles...');

  const password = 'NexusTest2026!';
  const hashedPassword = await bcrypt.hash(password, 10);
  const now = new Date();

  // 1. ADMIN
  await prisma.user.upsert({
    where: { email: 'audit.admin@nexusreussite.academy' },
    update: { password: hashedPassword, activatedAt: now },
    create: {
      email: 'audit.admin@nexusreussite.academy',
      password: hashedPassword,
      firstName: 'Audit',
      lastName: 'Admin',
      role: 'ADMIN',
      activatedAt: now,
    },
  });

  // 2. ASSISTANTE
  await prisma.user.upsert({
    where: { email: 'audit.assistante@nexusreussite.academy' },
    update: { password: hashedPassword, activatedAt: now },
    create: {
      email: 'audit.assistante@nexusreussite.academy',
      password: hashedPassword,
      firstName: 'Audit',
      lastName: 'Assistante',
      role: 'ASSISTANTE',
      activatedAt: now,
    },
  });

  // 3. COACH (Assigned)
  const coachAssigned = await prisma.user.upsert({
    where: { email: 'audit.coach.assigned@nexusreussite.academy' },
    update: { password: hashedPassword, activatedAt: now },
    create: {
      email: 'audit.coach.assigned@nexusreussite.academy',
      password: hashedPassword,
      firstName: 'Audit',
      lastName: 'CoachAssigned',
      role: 'COACH',
      activatedAt: now,
    },
  });

  await prisma.coachProfile.upsert({
    where: { userId: coachAssigned.id },
    update: {},
    create: {
      userId: coachAssigned.id,
      pseudonym: 'AuditCoachAssigned',
      subjects: ['MATHEMATIQUES', 'NSI'],
      title: 'Professeur Test',
      description: 'Profil de test pour l\'audit.',
    },
  });

  // 4. COACH (Idle)
  const coachIdle = await prisma.user.upsert({
    where: { email: 'audit.coach.idle@nexusreussite.academy' },
    update: { password: hashedPassword, activatedAt: now },
    create: {
      email: 'audit.coach.idle@nexusreussite.academy',
      password: hashedPassword,
      firstName: 'Audit',
      lastName: 'CoachIdle',
      role: 'COACH',
      activatedAt: now,
    },
  });

  await prisma.coachProfile.upsert({
    where: { userId: coachIdle.id },
    update: {},
    create: {
      userId: coachIdle.id,
      pseudonym: 'AuditCoachIdle',
      subjects: ['MATHEMATIQUES'],
      title: 'Professeur En Attente',
      description: 'Profil de test non assigné.',
    },
  });

  // 5. PARENT
  const parent = await prisma.user.upsert({
    where: { email: 'audit.parent@nexusreussite.academy' },
    update: { password: hashedPassword, activatedAt: now },
    create: {
      email: 'audit.parent@nexusreussite.academy',
      password: hashedPassword,
      firstName: 'Audit',
      lastName: 'Parent',
      role: 'PARENT',
      activatedAt: now,
    },
  });

  const parentProfile = await prisma.parentProfile.upsert({
    where: { userId: parent.id },
    update: {},
    create: { userId: parent.id },
  });

  // 6. STUDENT (P1 - Première)
  const studentP1 = await prisma.user.upsert({
    where: { email: 'audit.student.p1@nexusreussite.academy' },
    update: { password: hashedPassword, activatedAt: now },
    create: {
      email: 'audit.student.p1@nexusreussite.academy',
      password: hashedPassword,
      firstName: 'Audit',
      lastName: 'StudentP1',
      role: 'ELEVE',
      activatedAt: now,
    },
  });

  await prisma.student.upsert({
    where: { userId: studentP1.id },
    update: { grade: 'PREMIERE' },
    create: {
      userId: studentP1.id,
      parentId: parentProfile.id,
      grade: 'PREMIERE',
      credits: 10,
    },
  });

  // 7. STUDENT (T - Terminale)
  const studentT = await prisma.user.upsert({
    where: { email: 'audit.student.t@nexusreussite.academy' },
    update: { password: hashedPassword, activatedAt: now },
    create: {
      email: 'audit.student.t@nexusreussite.academy',
      password: hashedPassword,
      firstName: 'Audit',
      lastName: 'StudentT',
      role: 'ELEVE',
      activatedAt: now,
    },
  });

  await prisma.student.upsert({
    where: { userId: studentT.id },
    update: { grade: 'TERMINALE' },
    create: {
      userId: studentT.id,
      parentId: parentProfile.id,
      grade: 'TERMINALE',
      credits: 10,
    },
  });

  // 8. STUDENT (Pending)
  const studentPending = await prisma.user.upsert({
    where: { email: 'audit.student.pending@nexusreussite.academy' },
    update: { activatedAt: null, password: hashedPassword },
    create: {
      email: 'audit.student.pending@nexusreussite.academy',
      password: hashedPassword,
      firstName: 'Audit',
      lastName: 'StudentPending',
      role: 'ELEVE',
      activatedAt: null,
      activationToken: 'test-token-123',
    },
  });

  await prisma.student.upsert({
    where: { userId: studentPending.id },
    update: {},
    create: {
      userId: studentPending.id,
      parentId: parentProfile.id,
      grade: 'PREMIERE',
    },
  });

  // Assignments for tests
  const stage = await prisma.stage.findFirst({
    where: { slug: 'printemps-2026' }
  });

  if (stage) {
    console.log(`📍 Assigning AuditCoachAssigned to stage: ${stage.title}`);
    await prisma.stageCoach.upsert({
      where: {
        stageId_coachId: {
          stageId: stage.id,
          coachId: coachAssigned.id,
        }
      },
      update: {},
      create: {
        stageId: stage.id,
        coachId: coachAssigned.id,
        role: 'PRINCIPAL',
      }
    });

    // Register students to stage
    console.log(`📍 Registering students to stage: ${stage.title}`);
    for (const studentId of [studentP1.id, studentT.id]) {
        await prisma.stageReservation.upsert({
            where: {
                stageId_studentId: {
                    stageId: stage.id,
                    studentId: studentId
                }
            },
            update: {},
            create: {
                stageId: stage.id,
                studentId: studentId,
                status: 'CONFIRMED'
            }
        });
    }
  }

  console.log('✅ Audit Test Profiles created successfully!');
  console.log(`🔑 All profiles use password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
