import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole, GradeLevel, AcademicTrack, Subject } from '@prisma/client';

const prisma = new PrismaClient();

// Password must be provided via env var — never hardcode credentials
const PASSWORD = process.env.DEFAULT_STUDENT_PASSWORD;
if (!PASSWORD) {
  console.error('ERROR: DEFAULT_STUDENT_PASSWORD env var is required.');
  console.error('Usage: DEFAULT_STUDENT_PASSWORD=... npx tsx scripts/seed-nsi-pratique-students.ts [csv_path]');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== 'true') {
  console.error('ERROR: This seed script must not run in production.');
  console.error('       Set SEED_FORCE=true to override (at your own risk).');
  process.exit(1);
}
const SYSTEM_PARENT_EMAIL = 'parent-technique@nexusreussite.academy';

type CsvStudent = {
  fullName: string;
  birthDate: Date | null;
  sex: string;
  email: string;
  className: string | null;
};

function parseFrenchDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
}

function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.pop() ?? fullName.trim();
  const lastName = parts.join(' ') || firstName;
  return {
    firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase(),
    lastName: lastName
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' '),
  };
}

function parseCsv(filePath: string): CsvStudent[] {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((col) => col.trim());
    const emailIndex = cols.findIndex((col) => col.includes('@'));
    if (emailIndex === -1) {
      throw new Error(`Email introuvable pour la ligne: ${line}`);
    }
    return {
      fullName: cols[0],
      birthDate: parseFrenchDate(cols[1] ?? ''),
      sex: cols[2] ?? '',
      email: cols[emailIndex].toLowerCase(),
      className: cols[emailIndex + 1] || null,
    };
  });
}

async function main() {
  const csvPath = process.argv[2] ?? path.resolve(process.cwd(), 'Terminale_NSI.csv');
  const students = parseCsv(csvPath);
  const uniqueEmails = new Set(students.map((student) => student.email));
  if (uniqueEmails.size !== students.length) {
    throw new Error('Le CSV contient des emails dupliqués.');
  }

  const systemParent = await prisma.user.findUnique({
    where: { email: SYSTEM_PARENT_EMAIL },
    include: { parentProfile: true },
  });

  if (!systemParent?.parentProfile) {
    throw new Error(`Parent technique introuvable: ${SYSTEM_PARENT_EMAIL}`);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const emptyProgress = {
    subjects: {},
    patterns: {},
    flashcards: {},
    fiveDayPlan: {},
    selfAssessment: {},
    mockExams: [],
    oralPhrases: {},
  };

  for (const student of students) {
    const { firstName, lastName } = parseName(student.fullName);
    const user = await prisma.user.upsert({
      where: { email: student.email },
      update: {
        password: passwordHash,
        role: UserRole.ELEVE,
        firstName,
        lastName,
        activatedAt: new Date(),
        activationToken: null,
        activationExpiry: null,
      },
      create: {
        email: student.email,
        password: passwordHash,
        role: UserRole.ELEVE,
        firstName,
        lastName,
        activatedAt: new Date(),
      },
    });

    await prisma.student.upsert({
      where: { userId: user.id },
      update: {
        parentId: systemParent.parentProfile.id,
        grade: student.className ?? 'Terminale',
        gradeLevel: GradeLevel.TERMINALE,
        academicTrack: AcademicTrack.EDS_GENERALE,
        specialties: [Subject.NSI],
        birthDate: student.birthDate,
        school: student.sex ? `Terminale NSI - ${student.sex}` : 'Terminale NSI',
        updatedTrackAt: new Date(),
      },
      create: {
        userId: user.id,
        parentId: systemParent.parentProfile.id,
        grade: student.className ?? 'Terminale',
        gradeLevel: GradeLevel.TERMINALE,
        academicTrack: AcademicTrack.EDS_GENERALE,
        specialties: [Subject.NSI],
        birthDate: student.birthDate,
        school: student.sex ? `Terminale NSI - ${student.sex}` : 'Terminale NSI',
        updatedTrackAt: new Date(),
      },
    });

    await prisma.nsiPracticeProgress.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        data: emptyProgress,
      },
    });
  }

  console.log(`NSI pratique: ${students.length} comptes élèves créés/mis à jour.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
