import { PrismaClient } from '@prisma/client';
import { CREDS } from './credentials';
import { Page } from '@playwright/test';
import { loginAsUser } from './auth';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

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

export async function setParentSubscription(
  email: string,
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED',
  plan: string
): Promise<void> {
  const client = getPrisma();
  const parentUser = await client.user.findUnique({
    where: { email },
    include: {
      parentProfile: {
        include: { children: true },
      },
    },
  });
  if (!parentUser?.parentProfile) throw new Error(`Parent not found for ${email}`);

  for (const child of parentUser.parentProfile.children) {
    await client.subscription.updateMany({
      where: { studentId: child.id },
      data: { status: 'CANCELLED' },
    });
    await client.subscription.create({
      data: {
        studentId: child.id,
        planName: plan,
        monthlyPrice: plan === 'IMMERSION' ? 750 : plan === 'HYBRIDE' ? 450 : 150,
        creditsPerMonth: plan === 'IMMERSION' ? 12 : plan === 'HYBRIDE' ? 8 : 0,
        status,
        startDate: new Date(),
        endDate: status === 'EXPIRED' ? new Date(Date.now() - 24 * 60 * 60 * 1000) : null,
      },
    });
  }
}

export async function clearParentSubscription(email: string): Promise<void> {
  const client = getPrisma();
  const parentUser = await client.user.findUnique({
    where: { email },
    include: { parentProfile: { include: { children: true } } },
  });
  if (!parentUser?.parentProfile) throw new Error(`Parent not found for ${email}`);

  await client.subscription.deleteMany({
    where: { studentId: { in: parentUser.parentProfile.children.map((c) => c.id) } },
  });
}

export async function createPendingSubscriptionRequest(parentEmail: string): Promise<{ id: string }> {
  const client = getPrisma();
  const parentUser = await client.user.findUnique({
    where: { email: parentEmail },
    include: { parentProfile: { include: { children: true } } },
  });
  if (!parentUser?.parentProfile?.children?.length) {
    throw new Error(`No child found for ${parentEmail}`);
  }
  const child = parentUser.parentProfile.children[0];
  const req = await client.subscriptionRequest.create({
    data: {
      studentId: child.id,
      requestType: 'PLAN_CHANGE',
      planName: 'HYBRIDE',
      monthlyPrice: 450,
      status: 'PENDING',
      requestedBy: parentUser.id,
      requestedByEmail: parentEmail,
    },
  });
  return { id: req.id };
}

export async function createPendingPayment(parentEmail: string): Promise<{ id: string }> {
  const client = getPrisma();
  const parentUser = await client.user.findUnique({ where: { email: parentEmail } });
  if (!parentUser) throw new Error(`User not found for ${parentEmail}`);
  const payment = await client.payment.create({
    data: {
      userId: parentUser.id,
      type: 'SUBSCRIPTION',
      amount: 450,
      description: 'E2E pending payment',
      status: 'PENDING',
      method: 'bank_transfer',
      metadata: { parentEmail },
    },
  });
  return { id: payment.id };
}

export async function createTestInvoice(parentEmail: string): Promise<{ id: string }> {
  const client = getPrisma();
  const parentUser = await client.user.findUnique({ where: { email: parentEmail } });
  if (!parentUser) throw new Error(`User not found for ${parentEmail}`);

  const yearMonth = Number(new Date().toISOString().slice(0, 7).replace('-', ''));
  const seq = await client.invoiceSequence.upsert({
    where: { yearMonth },
    update: { current: { increment: 1 } },
    create: { yearMonth, current: 1 },
  });
  const number = `${yearMonth}-${String(seq.current).padStart(4, '0')}`;

  const invoice = await client.invoice.create({
    data: {
      number,
      status: 'PAID',
      customerName: `${parentUser.firstName || ''} ${parentUser.lastName || ''}`.trim() || parentEmail,
      customerEmail: parentEmail,
      subtotal: 450000,
      total: 450000,
      taxTotal: 0,
      discountTotal: 0,
      paymentMethod: 'BANK_TRANSFER',
      paidAt: new Date(),
      paidAmount: 450000,
      paymentReference: `E2E-${Date.now()}`,
      createdByUserId: parentUser.id,
      beneficiaryUserId: parentUser.id,
      items: {
        create: [
          {
            label: 'Abonnement Hybride',
            qty: 1,
            unitPrice: 450000,
            total: 450000,
            productCode: 'HYBRIDE',
          },
        ],
      },
    },
  });
  return { id: invoice.id };
}

export async function createTestDocument(ownerEmail: string, filename: string): Promise<string> {
  const client = getPrisma();
  const owner = await client.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) throw new Error(`User not found for ${ownerEmail}`);

  const docId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storageDir = path.resolve(process.cwd(), 'storage', 'documents');
  fs.mkdirSync(storageDir, { recursive: true });
  const absolutePath = path.join(storageDir, `${docId}-${filename}`);
  fs.writeFileSync(absolutePath, '%PDF-1.4\n% E2E test document\n');

  const doc = await client.userDocument.create({
    data: {
      title: filename,
      originalName: filename,
      mimeType: filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
      sizeBytes: fs.statSync(absolutePath).size,
      localPath: absolutePath,
      userId: owner.id,
      uploadedById: owner.id,
    },
  });
  return doc.id;
}

export async function createScheduledSession(studentEmail: string, coachEmail: string): Promise<string> {
  const client = getPrisma();
  const studentUser = await client.user.findUnique({
    where: { email: studentEmail },
    include: { student: { include: { parent: true } } },
  });
  const coachUser = await client.user.findUnique({ where: { email: coachEmail } });
  if (!studentUser?.student || !coachUser) {
    throw new Error(`Missing student or coach for ${studentEmail} / ${coachEmail}`);
  }

  const parentUser = await client.user.findFirst({
    where: { parentProfile: { id: studentUser.student.parentId } },
  });

  const now = new Date();
  const scheduledDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const booking = await client.sessionBooking.create({
    data: {
      studentId: studentUser.id,
      coachId: coachUser.id,
      parentId: parentUser?.id ?? null,
      subject: 'MATHEMATIQUES',
      title: 'Session E2E',
      scheduledDate,
      startTime: '14:00',
      endTime: '15:00',
      duration: 60,
      status: 'SCHEDULED',
      type: 'INDIVIDUAL',
      modality: 'ONLINE',
      meetingUrl: `https://meet.jit.si/nexus-${Date.now()}`,
      creditsUsed: 1,
    },
  });
  return booking.id;
}

export async function createSessionNotification(userEmail: string, message: string): Promise<void> {
  const client = getPrisma();
  const user = await client.user.findUnique({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found for ${userEmail}`);
  await client.notification.create({
    data: {
      userId: user.id,
      userRole: user.role,
      type: 'E2E',
      title: 'Notification E2E',
      message,
      data: { source: 'e2e' },
      read: false,
    },
  });
}

export async function getStudentCredits(studentEmail: string): Promise<number> {
  const client = getPrisma();
  const user = await client.user.findUnique({
    where: { email: studentEmail },
    include: { student: true },
  });
  if (!user?.student) throw new Error(`Student not found for ${studentEmail}`);
  return user.student.credits;
}

export async function getAvailableSlotId(): Promise<string> {
  const client = getPrisma();
  const slot = await client.coachAvailability.findFirst({
    where: { isAvailable: true },
    orderBy: { createdAt: 'desc' },
  });
  if (slot) return slot.id;

  const coach = await client.user.findFirst({ where: { role: 'COACH' } });
  if (!coach) throw new Error('No coach available to create slot');
  const created = await client.coachAvailability.create({
    data: {
      coachId: coach.id,
      dayOfWeek: 1,
      startTime: '14:00',
      endTime: '15:00',
      isAvailable: true,
      isRecurring: true,
      validFrom: new Date('2000-01-01T00:00:00Z'),
    },
  });
  return created.id;
}

export async function createJWTForUser(payload: { id: string; role: string }): Promise<string> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'e2e-dev-secret';
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

export async function getAuthToken(email: string): Promise<string> {
  const client = getPrisma();
  const user = await client.user.findUnique({ where: { email } });
  if (!user) throw new Error(`User not found for ${email}`);
  return createJWTForUser({ id: user.id, role: user.role });
}

export async function seedManyUsers(count: number): Promise<void> {
  const client = getPrisma();
  const baseTs = Date.now();
  for (let i = 0; i < count; i += 1) {
    const email = `e2e.bulk.user.${baseTs}.${i}@test.local`;
    await client.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        role: i % 3 === 0 ? 'COACH' : i % 3 === 1 ? 'PARENT' : 'ELEVE',
        firstName: `Bulk${i}`,
        lastName: 'E2E',
      },
    });
  }
}

export async function loginAsParentWithNoChildren(page: Page): Promise<void> {
  const client = getPrisma();
  await loginAsUser(page, 'parent');
  const parent = await client.user.findUnique({
    where: { email: CREDS.parent.email },
    include: { parentProfile: { include: { children: true } } },
  });
  if (!parent?.parentProfile) return;

  for (const child of parent.parentProfile.children) {
    await client.subscription.deleteMany({ where: { studentId: child.id } });
    await client.student.delete({ where: { id: child.id } }).catch(() => undefined);
  }
}

export async function loginAsParentWithTwoChildren(page: Page): Promise<void> {
  const client = getPrisma();
  await loginAsUser(page, 'parent');
  const parent = await client.user.findUnique({
    where: { email: CREDS.parent.email },
    include: { parentProfile: { include: { children: true } } },
  });
  if (!parent?.parentProfile) throw new Error('Parent profile missing');
  const existingCount = parent.parentProfile.children.length;
  if (existingCount >= 2) return;

  for (let i = existingCount; i < 2; i += 1) {
    const email = `e2e.parent.child.${Date.now()}.${i}@test.local`;
    const user = await client.user.create({
      data: {
        email,
        role: 'ELEVE',
        firstName: `Child${i + 1}`,
        lastName: 'E2E',
      },
    });
    await client.student.create({
      data: {
        userId: user.id,
        parentId: parent.parentProfile.id,
        grade: i === 0 ? 'Première' : 'Terminale',
        credits: i === 0 ? 2 : 6,
      },
    });
  }
}

export async function loginAsUserWithEntitlement(
  page: Page,
  creds: { email: string; password: string },
  featureKey: string
): Promise<void> {
  await clearEntitlementsByUserEmail(creds.email);
  await setEntitlementByUserEmail(creds.email, featureKey);
  if (creds.email === CREDS.parent.email) return loginAsUser(page, 'parent');
  if (creds.email === CREDS.student.email) return loginAsUser(page, 'student');
  if (creds.email === CREDS.coach.email) return loginAsUser(page, 'coach');
  if (creds.email === CREDS.admin.email) return loginAsUser(page, 'admin');
  await loginAsUser(page, 'student');
}

export async function createInvoiceForUser(email: string): Promise<string> {
  const invoice = await createTestInvoice(email);
  return invoice.id;
}

export async function setStudentCreditsWithExpiry(email: string, amount: number, expiresAt: Date): Promise<void> {
  const client = getPrisma();
  const user = await client.user.findUnique({
    where: { email },
    include: { student: true },
  });
  if (!user?.student) throw new Error(`Student not found for ${email}`);

  await client.student.update({
    where: { id: user.student.id },
    data: { credits: amount },
  });

  await client.creditTransaction.create({
    data: {
      studentId: user.student.id,
      type: 'MANUAL_ADJUST',
      amount,
      description: 'E2E credits with expiry',
      expiresAt,
    },
  });
}

export async function getStudentId(email: string): Promise<string> {
  const client = getPrisma();
  const user = await client.user.findUnique({
    where: { email },
    include: { student: true },
  });
  if (!user?.student) throw new Error(`Student not found for ${email}`);
  return user.student.id;
}

export async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
