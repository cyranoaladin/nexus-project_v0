import {
  PrismaClient,
  UserRole,
  Subject,
  SessionStatus,
  SessionType,
  SessionModality,
  NotificationMethod,
  NotificationStatus,
  NotificationType,
  SubscriptionStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function getOrCreateUser(email: string, role: UserRole, firstName: string, lastName: string) {
  const hashedPassword = await bcrypt.hash('password123', 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashedPassword,
      role,
      firstName,
      lastName,
    },
  });
  return user;
}

async function ensureCoachForSubject(subject: Subject) {
  const email = `coach_${subject.toLowerCase()}@nexus.com`;
  const coach = await getOrCreateUser(email, UserRole.COACH, 'Coach', subject.replace('_', ' '));
  await prisma.coachProfile.upsert({
    where: { userId: coach.id },
    update: {
      pseudonym: `Coach-${subject}`,
      subjects: JSON.stringify([subject]),
      title: 'Professeur Certifié',
      tag: '🎓 Expert',
      description: `Expert de ${subject}`,
    },
    create: {
      userId: coach.id,
      pseudonym: `Coach-${subject}`,
      subjects: JSON.stringify([subject]),
      title: 'Professeur Certifié',
      tag: '🎓 Expert',
      description: `Expert de ${subject}`,
    },
  });
  return coach;
}

async function ensureCoachAvailabilities(coachUserId: string) {
  const entries = [
    { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 3, startTime: '14:00', endTime: '17:00' },
    { dayOfWeek: 5, startTime: '10:00', endTime: '12:00' },
  ];
  try {
    const data = entries.flatMap((e) => [
      {
        ...e,
        coachId: coachUserId,
        isRecurring: true,
        isAvailable: true,
        modality: 'ONLINE' as any,
      },
      {
        ...e,
        coachId: coachUserId,
        isRecurring: true,
        isAvailable: true,
        modality: 'IN_PERSON' as any,
      },
    ]);
    await prisma.coachAvailability.createMany({ data, skipDuplicates: true });
  } catch {}
}

async function ensureParentWithChildrenVariations() {
  const parent = await getOrCreateUser(
    'parent.variations@nexus.com',
    UserRole.PARENT,
    'Parent',
    'Variations'
  );
  const parentProfile = await prisma.parentProfile.upsert({
    where: { userId: parent.id },
    update: {},
    create: { userId: parent.id },
  });

  // Enfant A: IMMERSION actif, ARIA (2 matières), 10 crédits
  const childAUser = await getOrCreateUser('enfantA@nexus.com', UserRole.ELEVE, 'Enfant', 'A');
  const childAStudent = await prisma.student.upsert({
    where: { userId: childAUser.id },
    update: {},
    create: {
      userId: childAUser.id,
      parentId: parentProfile.id,
      grade: 'Terminale',
      credits: 10,
    },
  });
  await prisma.subscription.upsert({
    where: { id: `sub-${childAStudent.id}-IMMERSION` },
    update: {},
    create: {
      id: `sub-${childAStudent.id}-IMMERSION`,
      studentId: childAStudent.id,
      planName: 'IMMERSION',
      monthlyPrice: 350,
      creditsPerMonth: 16,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
      ariaSubjects: JSON.stringify(['MATHEMATIQUES', 'ANGLAIS']),
      ariaCost: 60,
    },
  });

  // Enfant B: HYBRIDE cancelled, 0 crédit
  const childBUser = await getOrCreateUser('enfantB@nexus.com', UserRole.ELEVE, 'Enfant', 'B');
  const childBStudent = await prisma.student.upsert({
    where: { userId: childBUser.id },
    update: {},
    create: {
      userId: childBUser.id,
      parentId: parentProfile.id,
      grade: 'Première',
      credits: 0,
    },
  });
  await prisma.subscription.upsert({
    where: { id: `sub-${childBStudent.id}-HYBRIDE` },
    update: {},
    create: {
      id: `sub-${childBStudent.id}-HYBRIDE`,
      studentId: childBStudent.id,
      planName: 'HYBRIDE',
      monthlyPrice: 250,
      creditsPerMonth: 8,
      status: SubscriptionStatus.CANCELLED,
      startDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      ariaSubjects: JSON.stringify([]),
      ariaCost: 0,
    },
  });

  // Enfant C: ACCES_PLATEFORME expiré, ARIA 1 matière, SubscriptionRequest PENDING
  const childCUser = await getOrCreateUser('enfantC@nexus.com', UserRole.ELEVE, 'Enfant', 'C');
  const childCStudent = await prisma.student.upsert({
    where: { userId: childCUser.id },
    update: {},
    create: {
      userId: childCUser.id,
      parentId: parentProfile.id,
      grade: 'Seconde',
      credits: 2,
    },
  });
  await prisma.subscription.upsert({
    where: { id: `sub-${childCStudent.id}-ACCES` },
    update: {},
    create: {
      id: `sub-${childCStudent.id}-ACCES`,
      studentId: childCStudent.id,
      planName: 'ACCES_PLATEFORME',
      monthlyPrice: 120,
      creditsPerMonth: 4,
      status: SubscriptionStatus.EXPIRED,
      startDate: new Date(Date.now() - 60 * 24 * 3600 * 1000),
      endDate: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      ariaSubjects: JSON.stringify(['MATHEMATIQUES']),
      ariaCost: 30,
    },
  });
  await prisma.subscriptionRequest.upsert({
    where: { id: `sr-${childCStudent.id}-1` },
    update: {},
    create: {
      id: `sr-${childCStudent.id}-1`,
      studentId: childCStudent.id,
      requestType: 'PLAN_CHANGE',
      planName: 'HYBRIDE',
      monthlyPrice: 250,
      reason: 'Upgrade souhaité',
      status: 'PENDING',
      requestedBy: parent.id,
      requestedByEmail: parent.email,
    },
  });

  return {
    parent,
    parentProfile,
    childAUser,
    childAStudent,
    childBUser,
    childBStudent,
    childCUser,
    childCStudent,
  };
}

async function ensureAriaSamples(studentId: string) {
  const convo = await prisma.ariaConversation.upsert({
    where: { id: `conv-${studentId}-MATH` },
    update: {},
    create: {
      id: `conv-${studentId}-MATH`,
      studentId,
      subject: Subject.MATHEMATIQUES,
      title: 'Rappels dérivées',
    },
  });
  await prisma.ariaMessage.createMany({
    data: [
      {
        id: `msg-${studentId}-1`,
        conversationId: convo.id,
        role: 'user',
        content: 'Explique la dérivée.',
      },
      {
        id: `msg-${studentId}-2`,
        conversationId: convo.id,
        role: 'assistant',
        content: 'La dérivée mesure ...',
        feedback: true,
      },
    ],
    skipDuplicates: true,
  });
}

async function ensureSessionBookings(
  studentUserId: string,
  coachUserId: string,
  parentUserId?: string
) {
  const baseDate = new Date();
  const sessions = [
    // SCHEDULED - Future individual online session
    {
      id: `sb-${studentUserId}-1`,
      studentId: studentUserId,
      coachId: coachUserId,
      parentId: parentUserId,
      subject: Subject.MATHEMATIQUES,
      title: 'Cours Maths - Dérivées',
      description: 'Révisions des dérivées et applications',
      scheduledDate: new Date(baseDate.getTime() + 24 * 3600 * 1000),
      startTime: '14:00',
      endTime: '15:00',
      duration: 60,
      status: SessionStatus.SCHEDULED,
      type: SessionType.INDIVIDUAL,
      modality: SessionModality.ONLINE,
      meetingUrl: 'https://meet.jit.si/nexus-aria-1',
      creditsUsed: 1,
    },
    // COMPLETED - Past individual in-person with feedback
    {
      id: `sb-${studentUserId}-2`,
      studentId: studentUserId,
      coachId: coachUserId,
      parentId: parentUserId,
      subject: Subject.ANGLAIS,
      title: 'English Speaking Practice',
      description: 'Oral practice and pronunciation',
      scheduledDate: new Date(baseDate.getTime() - 2 * 24 * 3600 * 1000),
      startTime: '10:00',
      endTime: '11:00',
      duration: 60,
      status: SessionStatus.COMPLETED,
      type: SessionType.INDIVIDUAL,
      modality: SessionModality.IN_PERSON,
      location: 'Campus Lac',
      creditsUsed: 1,
      studentAttended: true,
      coachAttended: true,
      rating: 5,
      feedback: 'Excellent progrès, bonne participation',
      coachNotes: 'Élève très motivé, à continuer le travail sur les temps',
      completedAt: new Date(baseDate.getTime() - 2 * 24 * 3600 * 1000 + 3600 * 1000),
    },
    // CONFIRMED - Tomorrow group hybrid masterclass
    {
      id: `sb-${studentUserId}-3`,
      studentId: studentUserId,
      coachId: coachUserId,
      parentId: parentUserId,
      subject: Subject.PHYSIQUE_CHIMIE,
      title: 'Masterclass - Mécanique quantique',
      description: 'Introduction aux concepts fondamentaux',
      scheduledDate: new Date(baseDate.getTime() + 48 * 3600 * 1000),
      startTime: '16:00',
      endTime: '18:00',
      duration: 120,
      status: SessionStatus.CONFIRMED,
      type: SessionType.MASTERCLASS,
      modality: SessionModality.HYBRID,
      meetingUrl: 'https://meet.jit.si/nexus-masterclass',
      location: 'Amphithéâtre A + Online',
      creditsUsed: 2,
    },
    // IN_PROGRESS - Currently running group online
    {
      id: `sb-${studentUserId}-4`,
      studentId: studentUserId,
      coachId: coachUserId,
      parentId: parentUserId,
      subject: Subject.PHILOSOPHIE,
      title: 'Atelier Philo - Conscience',
      description: 'Débat et réflexion sur la conscience',
      scheduledDate: baseDate,
      startTime: new Date(baseDate.getTime() - 30 * 60 * 1000).toTimeString().slice(0, 5),
      endTime: new Date(baseDate.getTime() + 30 * 60 * 1000).toTimeString().slice(0, 5),
      duration: 60,
      status: SessionStatus.IN_PROGRESS,
      type: SessionType.GROUP,
      modality: SessionModality.ONLINE,
      meetingUrl: 'https://meet.jit.si/nexus-philo-group',
      creditsUsed: 1,
    },
    // CANCELLED - Past cancelled session
    {
      id: `sb-${studentUserId}-5`,
      studentId: studentUserId,
      coachId: coachUserId,
      parentId: parentUserId,
      subject: Subject.SVT,
      title: 'TP Biologie - Génétique',
      description: 'Travaux pratiques sur la génétique',
      scheduledDate: new Date(baseDate.getTime() - 5 * 24 * 3600 * 1000),
      startTime: '09:00',
      endTime: '11:00',
      duration: 120,
      status: SessionStatus.CANCELLED,
      type: SessionType.GROUP,
      modality: SessionModality.IN_PERSON,
      location: 'Labo de biologie',
      creditsUsed: 0, // Credits refunded
      cancelledAt: new Date(baseDate.getTime() - 6 * 24 * 3600 * 1000),
      studentNotes: 'Empêchement familial',
    },
    // NO_SHOW - Student didn't show up
    {
      id: `sb-${studentUserId}-6`,
      studentId: studentUserId,
      coachId: coachUserId,
      parentId: parentUserId,
      subject: Subject.HISTOIRE_GEO,
      title: 'Cours Histoire - Seconde Guerre Mondiale',
      description: 'Les causes et conséquences',
      scheduledDate: new Date(baseDate.getTime() - 7 * 24 * 3600 * 1000),
      startTime: '15:00',
      endTime: '16:30',
      duration: 90,
      status: SessionStatus.NO_SHOW,
      type: SessionType.INDIVIDUAL,
      modality: SessionModality.ONLINE,
      meetingUrl: 'https://meet.jit.si/nexus-history',
      creditsUsed: 1, // Credits not refunded for no-show
      studentAttended: false,
      coachAttended: true,
      coachNotes: 'Élève absent sans préavis',
    },
    // RESCHEDULED - Moved to another date
    {
      id: `sb-${studentUserId}-7`,
      studentId: studentUserId,
      coachId: coachUserId,
      parentId: parentUserId,
      subject: Subject.FRANCAIS,
      title: 'Dissertation - Méthodologie',
      description: 'Techniques de dissertation',
      scheduledDate: new Date(baseDate.getTime() + 5 * 24 * 3600 * 1000),
      startTime: '11:00',
      endTime: '12:30',
      duration: 90,
      status: SessionStatus.RESCHEDULED,
      type: SessionType.INDIVIDUAL,
      modality: SessionModality.HYBRID,
      meetingUrl: 'https://meet.jit.si/nexus-francais',
      location: 'Salle 204 ou Online',
      creditsUsed: 1,
      studentNotes: 'Reporté de la semaine dernière',
    },
    // GROUP session in-person completed
    {
      id: `sb-${studentUserId}-8`,
      studentId: studentUserId,
      coachId: coachUserId,
      parentId: parentUserId,
      subject: Subject.SES,
      title: 'Atelier SES - Économie',
      description: 'Analyse économique contemporaine',
      scheduledDate: new Date(baseDate.getTime() - 3 * 24 * 3600 * 1000),
      startTime: '14:00',
      endTime: '16:00',
      duration: 120,
      status: SessionStatus.COMPLETED,
      type: SessionType.GROUP,
      modality: SessionModality.IN_PERSON,
      location: 'Salle de conférence B',
      creditsUsed: 2,
      studentAttended: true,
      coachAttended: true,
      rating: 4,
      feedback: 'Bon travail en groupe',
      completedAt: new Date(baseDate.getTime() - 3 * 24 * 3600 * 1000 + 2 * 3600 * 1000),
    },
  ];
  await prisma.sessionBooking.createMany({ data: sessions as any, skipDuplicates: true });

  // Notifications et rappels pour différents statuts
  await prisma.sessionNotification.createMany({
    data: [
      // Notification for SCHEDULED session
      {
        id: `snotif-${studentUserId}-1`,
        sessionId: `sb-${studentUserId}-1`,
        userId: studentUserId,
        type: NotificationType.SESSION_BOOKED,
        title: 'Session réservée',
        message: 'Votre session de Mathématiques a été réservée',
        status: NotificationStatus.SENT,
        method: NotificationMethod.EMAIL,
        sentAt: new Date(),
      },
      // Notification for CONFIRMED session
      {
        id: `snotif-${studentUserId}-3`,
        sessionId: `sb-${studentUserId}-3`,
        userId: studentUserId,
        type: NotificationType.SESSION_CONFIRMED,
        title: 'Session confirmée',
        message: 'Votre Masterclass de Physique-Chimie est confirmée',
        status: NotificationStatus.DELIVERED,
        method: NotificationMethod.IN_APP,
        sentAt: new Date(baseDate.getTime() - 24 * 3600 * 1000),
      },
      // Notification for CANCELLED session
      {
        id: `snotif-${studentUserId}-5`,
        sessionId: `sb-${studentUserId}-5`,
        userId: studentUserId,
        type: NotificationType.SESSION_CANCELLED,
        title: 'Session annulée',
        message: 'Votre TP de SVT a été annulé',
        status: NotificationStatus.READ,
        method: NotificationMethod.SMS,
        sentAt: new Date(baseDate.getTime() - 6 * 24 * 3600 * 1000),
        readAt: new Date(baseDate.getTime() - 6 * 24 * 3600 * 1000 + 3600 * 1000),
      },
      // Notification for RESCHEDULED session
      {
        id: `snotif-${studentUserId}-7`,
        sessionId: `sb-${studentUserId}-7`,
        userId: studentUserId,
        type: NotificationType.SESSION_RESCHEDULED,
        title: 'Session reportée',
        message: 'Votre cours de Français a été reporté',
        status: NotificationStatus.PENDING,
        method: NotificationMethod.PUSH,
      },
      // Coach notification for completed session
      {
        id: `snotif-${studentUserId}-coach-2`,
        sessionId: `sb-${studentUserId}-2`,
        userId: coachUserId,
        type: NotificationType.SESSION_COMPLETED,
        title: 'Session terminée',
        message: "Session d'Anglais complétée avec succès",
        status: NotificationStatus.DELIVERED,
        method: NotificationMethod.EMAIL,
        sentAt: new Date(baseDate.getTime() - 2 * 24 * 3600 * 1000 + 3600 * 1000),
      },
    ],
    skipDuplicates: true,
  });

  // Multiple reminders for different sessions
  await prisma.sessionReminder.createMany({
    data: [
      // Reminder for tomorrow's session
      {
        id: `srem-${studentUserId}-1`,
        sessionId: `sb-${studentUserId}-1`,
        reminderType: 'ONE_DAY_BEFORE' as any,
        scheduledFor: new Date(sessions[0].scheduledDate.getTime() - 24 * 3600 * 1000),
        sent: false,
      },
      // 2-hour reminder for confirmed masterclass
      {
        id: `srem-${studentUserId}-3a`,
        sessionId: `sb-${studentUserId}-3`,
        reminderType: 'TWO_HOURS_BEFORE' as any,
        scheduledFor: new Date(sessions[2].scheduledDate.getTime() - 2 * 3600 * 1000),
        sent: false,
      },
      // 30-min reminder for confirmed masterclass
      {
        id: `srem-${studentUserId}-3b`,
        sessionId: `sb-${studentUserId}-3`,
        reminderType: 'THIRTY_MINUTES_BEFORE' as any,
        scheduledFor: new Date(sessions[2].scheduledDate.getTime() - 30 * 60 * 1000),
        sent: false,
      },
      // Starting reminder for in-progress session (already sent)
      {
        id: `srem-${studentUserId}-4`,
        sessionId: `sb-${studentUserId}-4`,
        reminderType: 'SESSION_STARTING' as any,
        scheduledFor: sessions[3].scheduledDate,
        sent: true,
        sentAt: sessions[3].scheduledDate,
      },
    ],
    skipDuplicates: true,
  });
}

async function ensureBadgesAndReports(studentId: string, coachProfileId?: string) {
  await prisma.badge.createMany({
    data: [
      {
        name: 'ASSIDUITE_BRONZE',
        description: '3 sessions suivies',
        category: 'ASSIDUITE',
        icon: '🥉',
        condition: '3_sessions',
      },
      {
        name: 'PROGRESSION_1',
        description: 'Amélioration notable',
        category: 'PROGRESSION',
        icon: '📈',
        condition: 'progress_1',
      },
    ],
    skipDuplicates: true,
  });
  const b1 = await prisma.badge.findUnique({ where: { name: 'ASSIDUITE_BRONZE' } });
  if (b1) {
    await prisma.studentBadge.createMany({
      data: [{ studentId, badgeId: b1.id, earnedAt: new Date() }],
      skipDuplicates: true,
    });
  }
  if (coachProfileId) {
    await prisma.studentReport
      .create({
        data: {
          id: `rpt-${studentId}-1`,
          studentId,
          coachId: coachProfileId,
          title: 'Bilan Pédagogique',
          content: 'Progrès observés et recommandations.',
          period: 'Semaine en cours',
          sessionsCount: 2,
          averageGrade: 14.5,
        },
      })
      .catch(() => {});
  }
}

async function ensurePayments(userId: string) {
  const now = new Date();
  const base = new Date(now);
  const types = ['SUBSCRIPTION', 'CREDIT_PACK', 'SPECIAL_PACK'] as const;
  const statuses = ['COMPLETED', 'PENDING', 'FAILED', 'REFUNDED'] as const;
  const methods = ['KONNECT', 'MANUAL', 'WISE'] as const;

  const batch: any[] = [];
  for (let i = 1; i <= 18; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    batch.push({
      id: `pay-${userId}-${i}`,
      userId,
      type: types[i % types.length] as any,
      amount: 50 + (i % 7) * 25,
      currency: 'TND',
      description: i % 5 === 0 ? 'Paiement promotionnel' : 'Paiement récurrent',
      status: statuses[i % statuses.length] as any,
      method: methods[i % methods.length] as any,
      createdAt: d,
    });
  }
  await prisma.payment.createMany({ data: batch, skipDuplicates: true });
}

async function ensureUserSignupsTimeline() {
  const now = new Date();
  for (let i = 1; i <= 14; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const count = i <= 7 ? 2 : 1;
    for (let j = 1; j <= count; j++) {
      const email = `signup-${day.toISOString().slice(0, 10)}-${j}@nexus.com`;
      await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          password: await bcrypt.hash('password123', 12),
          role: UserRole.PARENT,
          firstName: 'Signup',
          lastName: `${i}-${j}`,
          createdAt: day,
        },
      });
    }
  }
}

async function main() {
  // Admin & Assistante
  const admin = await getOrCreateUser('admin@nexus.com', UserRole.ADMIN, 'Admin', 'Nexus');
  await getOrCreateUser('assistante@nexus.com', UserRole.ASSISTANTE, 'Assistante', 'Nexus');

  // Coaches pour chaque Subject + disponibilités
  const subjects = Object.values(Subject);
  for (const s of subjects) {
    const coach = await ensureCoachForSubject(s as Subject);
    await ensureCoachAvailabilities(coach.id);
  }

  // Parent variations + enfants
  const {
    parent,
    childAUser,
    childAStudent,
    childBUser,
    childBStudent,
    childCUser,
    childCStudent,
  } = await ensureParentWithChildrenVariations();

  // Subscription Requests variations (APPROVED/REJECTED)
  await prisma.subscriptionRequest.upsert({
    where: { id: `sr-${childAStudent.id}-2` },
    update: { status: 'REJECTED' },
    create: {
      id: `sr-${childAStudent.id}-2`,
      studentId: childAStudent.id,
      requestType: 'ARIA_ADDON',
      planName: 'HYBRIDE',
      monthlyPrice: 280,
      reason: 'Ajout ARIA NSI',
      status: 'REJECTED',
      requestedBy: parent.id,
      requestedByEmail: parent.email,
    },
  });
  await prisma.subscriptionRequest.upsert({
    where: { id: `sr-${childBStudent.id}-2` },
    update: { status: 'APPROVED' },
    create: {
      id: `sr-${childBStudent.id}-2`,
      studentId: childBStudent.id,
      requestType: 'PLAN_CHANGE',
      planName: 'IMMERSION',
      monthlyPrice: 350,
      reason: 'Upgrade approuvé',
      status: 'APPROVED',
      requestedBy: parent.id,
      requestedByEmail: parent.email,
      processedBy: admin.id,
      processedAt: new Date(),
    },
  });

  // Sessions Booking (réservation) pour Enfant A avec un coach math
  const coachMath = await prisma.user.findFirst({
    where: { email: 'coach_mathematiques@nexus.com' },
  });
  if (coachMath) {
    await ensureSessionBookings(childAUser.id, coachMath.id, parent.id);
    // Rapports/Badges pour Enfant A
    const coachProfile = await prisma.coachProfile.findUnique({ where: { userId: coachMath.id } });
    await ensureBadgesAndReports(childAStudent.id, coachProfile?.id);
  }

  // Aria conversations/messages pour chaque enfant
  await ensureAriaSamples(childAStudent.id);
  await ensureAriaSamples(childBStudent.id);
  await ensureAriaSamples(childCStudent.id);

  // Quelques paiements additionnels pour Admin
  await ensurePayments(admin.id);

  // Timeline d'inscriptions utilisateurs pour nourrir userGrowth
  await ensureUserSignupsTimeline();

  console.log(
    'Extended seed completed (idempotent): coaches, availabilities, parent variations, bookings, notifications, reminders, badges, reports, aria, payments, signups timeline.'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
