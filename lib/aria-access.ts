import { prisma } from '@/lib/prisma'
import { Prisma, Student, Subject, AriaAccessStatus } from '@prisma/client'

const SUBJECT_VALUES = Object.values(Subject)

function parseConfiguredSubjects(envKey: string, fallback: Subject[]): Subject[] {
  const raw = process.env[envKey]
  if (!raw) {
    return fallback
  }

  const parsed = raw
    .split(',')
    .map(value => value.trim().toUpperCase())
    .map(value => Subject[value as keyof typeof Subject])
    .filter((value): value is Subject => Boolean(value))

  return parsed.length > 0 ? uniqueSubjects(parsed) : fallback
}

function uniqueSubjects(subjects: Subject[]): Subject[] {
  return Array.from(new Set(subjects))
}

function coerceSubjects(input?: string | Subject[] | null): Subject[] {
  if (!input) {
    return []
  }

  if (Array.isArray(input)) {
    return input.filter((subject): subject is Subject => SUBJECT_VALUES.includes(subject as Subject))
  }

  try {
    const parsed = JSON.parse(input)
    if (Array.isArray(parsed)) {
      return parsed
        .map(value => String(value).trim().toUpperCase())
        .map(value => Subject[value as keyof typeof Subject])
        .filter((value): value is Subject => Boolean(value))
    }
  } catch (error) {
    console.warn('ARIA access: unable to parse subject list', error)
  }

  return []
}

export const DEFAULT_PREMIUM_SUBJECTS = parseConfiguredSubjects(
  'ARIA_PREMIUM_DEFAULT_SUBJECTS',
  SUBJECT_VALUES
)

export const DEFAULT_FREEMIUM_SUBJECTS = parseConfiguredSubjects(
  'ARIA_FREEMIUM_SUBJECTS',
  [Subject.MATHEMATIQUES, Subject.FRANCAIS]
)

export const DEFAULT_FREEMIUM_TOKENS = Number.isFinite(Number(process.env.ARIA_FREEMIUM_TOKENS))
  ? Math.max(0, Number(process.env.ARIA_FREEMIUM_TOKENS))
  : 20

export const DEFAULT_FREEMIUM_DURATION_DAYS = Number.isFinite(Number(process.env.ARIA_FREEMIUM_DURATION_DAYS))
  ? Math.max(1, Number(process.env.ARIA_FREEMIUM_DURATION_DAYS))
  : 21

export type AriaAccessSnapshot = {
  status: AriaAccessStatus
  subjects: Subject[]
  activatedAt: Date | null
  deactivatedAt: Date | null
  freemium: {
    tokensGranted: number
    tokensUsed: number
    remaining: number
    expiresAt: Date | null
  }
  lastInteractionAt: Date | null
}

export function serializeSubjects(subjects: Subject[]): string {
  return JSON.stringify(uniqueSubjects(subjects))
}

export function getAriaAccessSnapshot(student: Pick<
  Student,
  | 'ariaStatus'
  | 'ariaSubjects'
  | 'ariaActivatedAt'
  | 'ariaDeactivatedAt'
  | 'ariaFreemiumTokens'
  | 'ariaFreemiumTokensUsed'
  | 'ariaFreemiumExpiresAt'
  | 'ariaLastInteractionAt'
>): AriaAccessSnapshot {
  const subjects = coerceSubjects(student.ariaSubjects)
  const tokensGranted = student.ariaFreemiumTokens ?? 0
  const tokensUsed = student.ariaFreemiumTokensUsed ?? 0
  const remaining = Math.max(0, tokensGranted - tokensUsed)

  return {
    status: student.ariaStatus,
    subjects,
    activatedAt: student.ariaActivatedAt ?? null,
    deactivatedAt: student.ariaDeactivatedAt ?? null,
    freemium: {
      tokensGranted,
      tokensUsed,
      remaining,
      expiresAt: student.ariaFreemiumExpiresAt ?? null
    },
    lastInteractionAt: student.ariaLastInteractionAt ?? null
  }
}

type ActivateAriaSubscriptionOptions = {
  studentId: string
  subjects?: Subject[]
  activatedAt?: Date
}

export async function activateAriaSubscription(options: ActivateAriaSubscriptionOptions) {
  const { studentId, activatedAt = new Date() } = options
  const subjects = uniqueSubjects(options.subjects && options.subjects.length > 0
    ? options.subjects
    : DEFAULT_PREMIUM_SUBJECTS)

  await prisma.student.update({
    where: { id: studentId },
    data: {
      ariaStatus: AriaAccessStatus.ACTIVE,
      ariaSubjects: serializeSubjects(subjects),
      ariaActivatedAt: activatedAt,
      ariaDeactivatedAt: null,
      ariaFreemiumTokens: 0,
      ariaFreemiumTokensUsed: 0,
      ariaFreemiumExpiresAt: null
    }
  })
}

type GrantFreemiumOptions = {
  studentId: string
  subjects?: Subject[]
  tokens?: number
  durationDays?: number
}

export async function grantAriaFreemium(options: GrantFreemiumOptions) {
  const { studentId } = options
  const subjects = uniqueSubjects(options.subjects && options.subjects.length > 0
    ? options.subjects
    : DEFAULT_FREEMIUM_SUBJECTS)

  const tokens = Number.isFinite(options.tokens)
    ? Math.max(0, Number(options.tokens))
    : DEFAULT_FREEMIUM_TOKENS

  const duration = Number.isFinite(options.durationDays)
    ? Math.max(1, Number(options.durationDays))
    : DEFAULT_FREEMIUM_DURATION_DAYS

  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + duration)

  await prisma.student.update({
    where: { id: studentId },
    data: {
      ariaStatus: AriaAccessStatus.FREEMIUM,
      ariaSubjects: serializeSubjects(subjects),
      ariaActivatedAt: now,
      ariaDeactivatedAt: null,
      ariaFreemiumTokens: tokens,
      ariaFreemiumTokensUsed: 0,
      ariaFreemiumExpiresAt: expiresAt
    }
  })
}

type RevokeOptions = {
  studentId: string
  reason?: string
}

export async function revokeAriaAccess(options: RevokeOptions) {
  const { studentId } = options
  const now = new Date()

  await prisma.student.update({
    where: { id: studentId },
    data: {
      ariaStatus: AriaAccessStatus.SUSPENDED,
      ariaDeactivatedAt: now
    }
  })
}

type InteractionOptions = {
  studentId: string
  status: AriaAccessStatus
  tokensConsumed?: number
}

export async function registerAriaInteraction(options: InteractionOptions) {
  const { studentId, status } = options
  const consumed = Number.isFinite(options.tokensConsumed)
    ? Math.max(0, Number(options.tokensConsumed))
    : 1

  const data: Prisma.StudentUpdateInput = {
    ariaLastInteractionAt: new Date()
  }

  if (status === AriaAccessStatus.FREEMIUM && consumed > 0) {
    data.ariaFreemiumTokensUsed = { increment: consumed }
  }

  await prisma.student.update({
    where: { id: studentId },
    data
  })
}

export function parseSubjectsDescriptor(value?: string | Subject[] | null): Subject[] {
  return coerceSubjects(value)
}

export function hasFreemiumQuota(snapshot: AriaAccessSnapshot): boolean {
  if (snapshot.status !== AriaAccessStatus.FREEMIUM) {
    return true
  }

  const hasTokens = snapshot.freemium.tokensGranted > 0
  const hasRemaining = snapshot.freemium.remaining > 0
  const expirationOk = !snapshot.freemium.expiresAt || snapshot.freemium.expiresAt > new Date()

  return hasTokens && hasRemaining && expirationOk
}
