import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/nexus_e2e?schema=public';

// Load credentials from file if it exists (written by seed-e2e-db.ts)
function loadCredentials() {
  const credentialsPath = path.resolve(process.cwd(), 'e2e/.credentials.json');
  if (fs.existsSync(credentialsPath)) {
    return JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
  }
  // Fallback to default test credentials (specific E2E test emails)
  return {
    student: { email: 'yasmine.dupont@test.com' },
    coach: { email: 'helios@test.com' },
  };
}

const credentials = loadCredentials();

let prisma: PrismaClient | null = null;

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: { url: DATABASE_URL },
      },
    });
  }
  return prisma;
}

export async function setStudentCreditsByEmail(email: string, credits: number) {
  const client = getPrisma();
  const user = await client.user.findUnique({
    where: { email },
    include: { student: true },
  });

  if (!user?.student) {
    throw new Error(`Student not found for email ${email}`);
  }

  // Keep legacy credits field in sync
  await client.student.update({
    where: { id: user.student.id },
    data: { credits },
  });

  // Reset credit transactions to match requested credits
  await client.creditTransaction.deleteMany({
    where: { studentId: user.student.id },
  });

  if (credits > 0) {
    await client.creditTransaction.create({
      data: {
        studentId: user.student.id,
        type: 'MANUAL_ADJUST',
        amount: credits,
        description: 'E2E credits reset',
      },
    });
  }
}

export async function ensureCoachAvailabilityByEmail(email: string) {
  const client = getPrisma();
  const user = await client.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`Coach not found for email ${email}`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const farPast = new Date('2000-01-01T00:00:00Z');

  // Clear any existing 10:00-11:00 availability for this coach
  await client.coachAvailability.deleteMany({
    where: {
      coachId: user.id,
      startTime: '10:00',
      endTime: '11:00',
    },
  });

  // Create recurring availability for weekdays (Mon-Fri)
  const weekdaySlots = [1, 2, 3, 4, 5].map((day) => ({
    coachId: user.id,
    dayOfWeek: day,
    startTime: '10:00',
    endTime: '11:00',
    specificDate: null,
    isAvailable: true,
    isRecurring: true,
    validFrom: farPast,
    validUntil: null,
  }));

  await client.coachAvailability.createMany({
    data: weekdaySlots,
    skipDuplicates: true,
  });

  // Add specific-date slots for the next 14 days (weekdays only) to guarantee UI slots
  const specificSlots: Array<{
    coachId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    specificDate: Date;
    isAvailable: boolean;
    isRecurring: boolean;
    validFrom: Date;
    validUntil: Date | null;
  }> = [];

  const cursor = new Date(today);
  for (let i = 0; i < 14; i += 1) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day === 0 || day === 6) continue;
    const slotDate = new Date(cursor);
    slotDate.setHours(12, 0, 0, 0); // noon to avoid TZ boundary issues
    specificSlots.push({
      coachId: user.id,
      dayOfWeek: slotDate.getDay(),
      startTime: '10:00',
      endTime: '11:00',
      specificDate: slotDate,
      isAvailable: true,
      isRecurring: false,
      validFrom: slotDate,
      validUntil: null,
    });
  }

  if (specificSlots.length > 0) {
    await client.coachAvailability.createMany({
      data: specificSlots,
      skipDuplicates: true,
    });
  }

}

export async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
