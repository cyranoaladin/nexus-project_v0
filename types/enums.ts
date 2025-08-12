// Client-side enums that mirror Prisma schema enums
// This file contains the same enum values as in prisma/schema.prisma
// but can be safely imported in client components

export enum UserRole {
  ADMIN = 'ADMIN',
  ASSISTANTE = 'ASSISTANTE',
  COACH = 'COACH',
  PARENT = 'PARENT',
  ELEVE = 'ELEVE'
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export enum ServiceType {
  COURS_ONLINE = 'COURS_ONLINE',
  COURS_PRESENTIEL = 'COURS_PRESENTIEL',
  ATELIER_GROUPE = 'ATELIER_GROUPE'
}

export enum Subject {
  MATHEMATIQUES = 'MATHEMATIQUES',
  NSI = 'NSI',
  FRANCAIS = 'FRANCAIS',
  PHILOSOPHIE = 'PHILOSOPHIE',
  HISTOIRE_GEO = 'HISTOIRE_GEO',
  ANGLAIS = 'ANGLAIS',
  ESPAGNOL = 'ESPAGNOL',
  PHYSIQUE_CHIMIE = 'PHYSIQUE_CHIMIE',
  SVT = 'SVT',
  SES = 'SES'
}

export enum SessionStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  RESCHEDULED = 'RESCHEDULED'
}

export enum PaymentType {
  SUBSCRIPTION = 'SUBSCRIPTION',
  CREDIT_PACK = 'CREDIT_PACK',
  SPECIAL_PACK = 'SPECIAL_PACK'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}
