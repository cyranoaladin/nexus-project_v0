import { z } from 'zod';

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const sessionSubjectValues = [
  'MATHEMATIQUES',
  'NSI',
  'FRANCAIS',
  'PHILOSOPHIE',
  'HISTOIRE_GEO',
  'ANGLAIS',
  'ESPAGNOL',
  'PHYSIQUE_CHIMIE',
  'SVT',
  'SES',
] as const;

export const sessionTypeValues = ['INDIVIDUAL', 'GROUP', 'MASTERCLASS'] as const;
export const sessionModalityValues = ['ONLINE', 'IN_PERSON', 'HYBRID'] as const;
export const sessionListRoleValues = ['assistant', 'coach', 'student', 'parent'] as const;
export const sessionStatusValues = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'RESCHEDULED',
] as const;

export const sessionResponseInclude = {
  student: true,
  coach: true,
  parent: true,
} as const;

type SessionParticipant = {
  id: string | null;
  firstName: string | null;
  lastName: string | null;
} | null;

export type SessionWithRelations = {
  id: string;
  title: string;
  subject: string;
  scheduledDate: Date;
  startTime: string;
  endTime: string;
  duration: number;
  status: string;
  type: string;
  modality: string;
  creditsUsed: number;
  studentId: string;
  coachId: string;
  parentId: string | null;
  createdAt: Date;
  student: SessionParticipant;
  coach: SessionParticipant;
  parent: SessionParticipant;
};

type ParticipantRelation = {
  id: string | null;
  firstName: string | null;
  lastName: string | null;
};

const isoDateString = z
  .string()
  .regex(isoDateRegex, 'Invalid date format. Use YYYY-MM-DD');

export const bookSessionSchema = z
  .object({
    coachId: z.string().min(1, 'Coach ID is required'),
    studentId: z.string().min(1, 'Student ID is required'),
    subject: z.enum(sessionSubjectValues),
    scheduledDate: isoDateString.refine((date) => {
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, 'Cannot book sessions in the past'),
    startTime: z.string().regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:MM)'),
    endTime: z.string().regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:MM)'),
    duration: z.number().min(30).max(180),
    type: z.enum(sessionTypeValues).default('INDIVIDUAL'),
    modality: z.enum(sessionModalityValues).default('ONLINE'),
    title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
    description: z.string().max(500, 'Description too long').optional(),
    creditsToUse: z.number().min(1).max(10, 'Cannot use more than 10 credits per session'),
  })
  .refine((data) => {
    const [startHour, startMinute] = data.startTime.split(':').map(Number);
    const [endHour, endMinute] = data.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    return endMinutes > startMinutes;
  }, {
    message: 'End time must be after start time',
    path: ['endTime'],
  })
  .refine((data) => {
    const [startHour, startMinute] = data.startTime.split(':').map(Number);
    const [endHour, endMinute] = data.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    return endMinutes - startMinutes === data.duration;
  }, {
    message: 'Duration must match the time difference between start and end time',
    path: ['duration'],
  });

export type BookSessionInput = z.infer<typeof bookSessionSchema>;

export const sessionListQuerySchema = z
  .object({
    role: z.enum(sessionListRoleValues).optional(),
    status: z.enum(sessionStatusValues).optional(),
    startDate: isoDateString.optional(),
    endDate: isoDateString.optional(),
  })
  .refine((data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  }, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;

export type NormalizedSessionListQuery = {
  role?: SessionListQuery['role'];
  status?: SessionListQuery['status'];
  startDate?: Date;
  endDate?: Date;
};

export function extractSessionListQuery(searchParams: URLSearchParams) {
  return sessionListQuerySchema.safeParse({
    role: searchParams.get('role') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
  });
}

export function normalizeSessionListQuery(query: SessionListQuery): NormalizedSessionListQuery {
  return {
    role: query.role,
    status: query.status,
    startDate: query.startDate ? new Date(query.startDate) : undefined,
    endDate: query.endDate ? new Date(query.endDate) : undefined,
  };
}

function buildParticipant(data: ParticipantRelation | null | undefined) {
  return {
    id: data?.id ?? null,
    firstName: data?.firstName ?? '',
    lastName: data?.lastName ?? '',
  };
}

export function mapSessionToResponse(session: SessionWithRelations) {
  return {
    id: session.id,
    title: session.title,
    subject: session.subject,
    scheduledDate: session.scheduledDate,
    startTime: session.startTime,
    endTime: session.endTime,
    duration: session.duration,
    status: session.status,
    type: session.type,
    modality: session.modality,
    creditsUsed: session.creditsUsed,
    student: {
      ...buildParticipant(session.student as ParticipantRelation),
      id: session.studentId,
    },
    coach: {
      ...buildParticipant(session.coach as ParticipantRelation),
      id: session.coachId,
    },
    parent: session.parentId
      ? {
          ...buildParticipant(session.parent as ParticipantRelation),
          id: session.parentId,
        }
      : null,
    createdAt: session.createdAt,
  };
}

export const sessionStatusUpdatableValues = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export const sessionStatusUpdateSchema = z.object({
  status: z.enum(sessionStatusUpdatableValues, { errorMap: () => ({ message: 'Invalid status value' }) }),
  notes: z.string().trim().max(1000, 'Notes too long').optional(),
});

export type SessionStatusUpdateInput = z.infer<typeof sessionStatusUpdateSchema>;

export const cancelSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  reason: z
    .string()
    .trim()
    .max(500, 'Reason must be 500 characters or fewer')
    .optional(),
});

export type CancelSessionInput = z.infer<typeof cancelSessionSchema>;

export const sessionVideoActionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  action: z.enum(['JOIN', 'LEAVE'], { errorMap: () => ({ message: 'Unsupported action' }) }),
});

export type SessionVideoActionInput = z.infer<typeof sessionVideoActionSchema>;

export const paymentResponseInclude = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  },
} as const;

type PaymentOwner = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
};

export type PaymentWithRelations = {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  description: string | null;
  status: string;
  method: string | null;
  type: string;
  externalId: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  user: PaymentOwner;
};

export function mapPaymentToResponse(payment: PaymentWithRelations) {
  const user = payment.user;
  return {
    id: payment.id,
    userId: payment.userId,
    amount: payment.amount,
    currency: payment.currency,
    description: payment.description,
    status: payment.status,
    method: payment.method ?? 'unknown',
    type: payment.type,
    externalId: payment.externalId,
    metadata: payment.metadata,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    user: {
      id: user.id,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email,
      role: user.role,
    },
  };
}

export const sessionNotificationResponseInclude = {
  session: {
    include: sessionResponseInclude,
  },
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
} as const;

type NotificationUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

export type SessionNotificationWithRelations = {
  id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  method: string;
  createdAt: Date;
  sentAt: Date | null;
  readAt: Date | null;
  session: SessionWithRelations;
  user: NotificationUser;
};

export function mapSessionNotificationToResponse(notification: SessionNotificationWithRelations) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    status: notification.status,
    method: notification.method,
    createdAt: notification.createdAt,
    sentAt: notification.sentAt,
    readAt: notification.readAt,
    user: {
      id: notification.user.id,
      firstName: notification.user.firstName ?? '',
      lastName: notification.user.lastName ?? '',
      role: notification.user.role,
    },
    session: mapSessionToResponse(notification.session),
  };
}

export const notificationStatusValues = [
  'PENDING',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
] as const;

const limitNumber = z.coerce.number().int().min(1).max(100);

export const sessionNotificationQuerySchema = z.object({
  status: z.enum(notificationStatusValues).optional(),
  limit: limitNumber.optional(),
});

export type SessionNotificationQuery = z.infer<typeof sessionNotificationQuerySchema>;

export function extractSessionNotificationQuery(searchParams: URLSearchParams) {
  return sessionNotificationQuerySchema.safeParse({
    status: searchParams.get('status') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });
}

export function normalizeSessionNotificationQuery(query: SessionNotificationQuery) {
  return {
    status: query.status,
    limit: query.limit ?? 20,
  };
}
