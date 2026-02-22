import { PrismaClient } from '@prisma/client';
import { CREDS } from './credentials';

const DEFAULT_E2E_DB_URL = 'postgresql://postgres:postgres@localhost:5435/nexus_e2e?schema=public';

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  (process.env.DATABASE_URL?.includes('nexus_e2e') ? process.env.DATABASE_URL : undefined) ??
  DEFAULT_E2E_DB_URL;

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

export async function setStudentCreditsByUserId(userId: string, credits: number) {
  const client = getPrisma();
  const student = await client.student.findUnique({
    where: { userId },
  });

  if (!student) {
    throw new Error(`Student not found for userId ${userId}`);
  }

  await client.student.update({
    where: { id: student.id },
    data: { credits },
  });

  await client.creditTransaction.deleteMany({
    where: { studentId: student.id },
  });

  if (credits > 0) {
    await client.creditTransaction.create({
      data: {
        studentId: student.id,
        type: 'MANUAL_ADJUST',
        amount: credits,
        description: 'E2E credits reset by userId',
      },
    });
  }
}

export async function ensureCoachAvailabilityByEmail(email: string) {
  const client = getPrisma();
  const user = await client.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (!user) {
    // Debug: List all coaches in database
    const allCoaches = await client.user.findMany({
      where: { role: 'COACH' },
      select: { email: true, firstName: true, lastName: true },
    });
    console.error(`[E2E DB Helper] Coach not found for email: ${email}`);
    console.error(`[E2E DB Helper] Available coaches in database:`, allCoaches);
    throw new Error(`Coach not found for email ${email}. Available coaches: ${allCoaches.map(c => c.email).join(', ')}`);
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

export async function clearEntitlementsByUserEmail(email: string) {
  const client = getPrisma();
  const user = await client.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`User not found for email ${email}`);
  await client.entitlement.deleteMany({ where: { userId: user.id } });
}

export async function setEntitlementByUserEmail(
  email: string,
  productCode: string,
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED' = 'ACTIVE',
  startsAt = new Date(),
  endsAt: Date | null = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
) {
  const client = getPrisma();
  const user = await client.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`User not found for email ${email}`);

  await client.entitlement.deleteMany({
    where: { userId: user.id, productCode },
  });

  await client.entitlement.create({
    data: {
      userId: user.id,
      productCode,
      label: `E2E ${productCode}`,
      status,
      startsAt,
      endsAt,
    },
  });
}

export async function getLatestInvoiceAndUserDocumentByEmail(email: string) {
  const client = getPrisma();
  const user = await client.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`User not found for email ${email}`);

  const invoice = await client.invoice.findFirst({
    where: { OR: [{ customerEmail: email }, { beneficiaryUserId: user.id }] },
    orderBy: { createdAt: 'desc' },
  });

  const userDocument = await client.userDocument.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  return { invoice, userDocument };
}

export async function getUserAndStudentIdsByEmail(email: string) {
  const client = getPrisma();
  const user = await client.user.findUnique({
    where: { email },
    include: { student: true, parentProfile: true },
  });
  if (!user) throw new Error(`User not found for email ${email}`);
  return {
    userId: user.id,
    studentId: user.student?.id ?? null,
    parentProfileId: user.parentProfile?.id ?? null,
  };
}

export async function getCoachUserIdByEmail(email: string) {
  const client = getPrisma();
  const user = await client.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!user || user.role !== 'COACH') {
    throw new Error(`Coach user not found for email ${email}`);
  }
  return user.id;
}

export async function getLatestSessionBooking(studentUserId: string) {
  const client = getPrisma();
  return client.sessionBooking.findFirst({
    where: { studentId: studentUserId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function ensureInactiveSubscriptionForStudentEmail(
  studentEmail: string,
  planName = 'HYBRIDE',
  creditsPerMonth = 8
) {
  const client = getPrisma();
  const studentUser = await client.user.findUnique({
    where: { email: studentEmail },
    include: { student: true },
  });
  if (!studentUser?.student) {
    throw new Error(`Student not found for email ${studentEmail}`);
  }

  await client.subscription.create({
    data: {
      studentId: studentUser.student.id,
      planName,
      monthlyPrice: 450,
      creditsPerMonth,
      status: 'INACTIVE',
      startDate: new Date(),
      endDate: null,
    },
  });

  return studentUser.student.id;
}

export async function ensureActiveAriaSubscriptionForStudentEmail(
  studentEmail: string,
  ariaSubjects: string[] = ['MATHEMATIQUES']
) {
  const client = getPrisma();
  const studentUser = await client.user.findUnique({
    where: { email: studentEmail },
    include: { student: true },
  });
  if (!studentUser?.student) {
    throw new Error(`Student not found for email ${studentEmail}`);
  }

  await client.subscription.updateMany({
    where: { studentId: studentUser.student.id, status: 'ACTIVE' },
    data: { status: 'CANCELLED' },
  });

  await client.subscription.create({
    data: {
      studentId: studentUser.student.id,
      planName: 'HYBRIDE',
      monthlyPrice: 450,
      creditsPerMonth: 8,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: null,
      ariaSubjects,
      ariaCost: 0,
    },
  });
}

export async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
