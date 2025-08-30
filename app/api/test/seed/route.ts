import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { seedTestDatabase } from '@/prisma/seed-test';

export async function POST() {
  if (process.env.E2E !== '1') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const studentEmail = process.env.E2E_STUDENT_EMAIL || 'e2e-student@nexus.local';
    const studentPass = process.env.E2E_STUDENT_PASS || 'e2e-student';
    const parentEmail = process.env.E2E_PARENT_EMAIL || 'e2e-parent@nexus.local';
    const parentPass = process.env.E2E_PARENT_PASS || 'e2e-parent';

    const studentHash = await bcrypt.hash(studentPass, 12);
    const parentHash = await bcrypt.hash(parentPass, 12);

    const parentUser = await prisma.user.upsert({
      where: { email: parentEmail },
      update: { role: 'PARENT' as any },
      create: { email: parentEmail, password: parentHash, role: 'PARENT' as any, firstName: 'E2E', lastName: 'Parent' },
    });
    const parentProfile = await prisma.parentProfile.upsert({ where: { userId: parentUser.id }, update: {}, create: { userId: parentUser.id } });

    const studentUser = await prisma.user.upsert({
      where: { email: studentEmail },
      update: { role: 'ELEVE' as any },
      create: { email: studentEmail, password: studentHash, role: 'ELEVE' as any, firstName: 'E2E', lastName: 'Student' },
    });

    await prisma.student.upsert({
      where: { userId: studentUser.id },
      update: { parentId: parentProfile.id },
      create: { userId: studentUser.id, parentId: parentProfile.id, grade: 'Première', credits: 5 },
    });

    const coachEmail = 'e2e-coach@nexus.local';
    const coachHash = await bcrypt.hash('e2e-coach', 12);
    const coachUser = await prisma.user.upsert({ where: { email: coachEmail }, update: { role: 'COACH' as any }, create: { email: coachEmail, password: coachHash, role: 'COACH' as any, firstName: 'E2E', lastName: 'Coach' } });
    await prisma.coachProfile.upsert({ where: { userId: coachUser.id }, update: { pseudonym: 'Coach-E2E', subjects: JSON.stringify(['MATHEMATIQUES']) }, create: { userId: coachUser.id, pseudonym: 'Coach-E2E', subjects: JSON.stringify(['MATHEMATIQUES']) } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'seed failed' }, { status: 500 });
  }
}
