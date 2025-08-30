import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

async function main() {
  const studentEmail = process.env.E2E_STUDENT_EMAIL || 'e2e-student@nexus.local';
  const studentPass = process.env.E2E_STUDENT_PASS || 'e2e-student';
  const parentEmail = process.env.E2E_PARENT_EMAIL || 'e2e-parent@nexus.local';
  const parentPass = process.env.E2E_PARENT_PASS || 'e2e-parent';

  const studentHash = await bcrypt.hash(studentPass, 12);
  const parentHash = await bcrypt.hash(parentPass, 12);

  // Upsert parent user
  const parentUser = await prisma.user.upsert({
    where: { email: parentEmail },
    update: {
      role: 'PARENT' as any,
    },
    create: {
      email: parentEmail,
      password: parentHash,
      role: 'PARENT' as any,
      firstName: 'E2E',
      lastName: 'Parent',
    },
  });

  // Upsert parent profile
  const parentProfile = await prisma.parentProfile.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: { userId: parentUser.id },
  });

  // Upsert student user
  const studentUser = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {
      role: 'ELEVE' as any,
    },
    create: {
      email: studentEmail,
      password: studentHash,
      role: 'ELEVE' as any,
      firstName: 'E2E',
      lastName: 'Student',
    },
  });

  // Upsert student entity (domain)
  await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {
      parentId: parentProfile.id,
    },
    create: {
      userId: studentUser.id,
      parentId: parentProfile.id,
      grade: 'Première',
      credits: 5,
    },
  });

  // Ensure at least one coach exists to avoid later issues
  const coachEmail = 'e2e-coach@nexus.local';
  const coachHash = await bcrypt.hash('e2e-coach', 12);
  const coachUser = await prisma.user.upsert({
    where: { email: coachEmail },
    update: { role: 'COACH' as any },
    create: {
      email: coachEmail,
      password: coachHash,
      role: 'COACH' as any,
      firstName: 'E2E',
      lastName: 'Coach',
    },
  });
  await prisma.coachProfile.upsert({
    where: { userId: coachUser.id },
    update: { pseudonym: 'Coach-E2E', subjects: JSON.stringify(['MATHEMATIQUES']) },
    create: { userId: coachUser.id, pseudonym: 'Coach-E2E', subjects: JSON.stringify(['MATHEMATIQUES']) },
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[E2E SEED ERROR]', e);
    process.exit(1);
  });
