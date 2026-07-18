import { z } from 'zod';

const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Time = z.string().regex(/^\d{2}:\d{2}$/);
const EntryLevel = z.enum(['SECONDE', 'PREMIERE', 'TERMINALE']);
const SubjectId = z.enum(['MATHEMATIQUES', 'FRANCAIS', 'NSI', 'PHYSIQUE_CHIMIE']);

const SourceEvidenceSchema = z.object({
  path: z.string().min(1),
  pointer: z.string().min(1),
}).strict();

const SourceProvenanceSchema = z.object({
  path: z.string().min(1),
  version: z.string().min(1),
  sha256: Sha256,
}).strict();

const ModuleSessionSchema = z.object({
  number: z.number().int().min(1).max(5),
  title: z.string().min(1),
  objective: z.string().min(1),
  topics: z.array(z.string().min(1)).min(1),
  method: z.string().min(1),
  deliverable: z.string().min(1),
}).strict();

const ModuleSchema = z.object({
  id: z.string().min(1),
  level: EntryLevel,
  subjectId: SubjectId,
  subject: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  prerequisites: z.string().min(1),
  differentiation: z.string().min(1),
  quickAssessment: z.string().min(1),
  sessions: z.array(ModuleSessionSchema).length(5),
}).strict();

const PackSchema = z.object({
  subjectCount: z.number().int().min(1).max(4),
  title: z.string().min(1),
  hoursPerSubject: z.number().positive(),
  totalHours: z.number().positive(),
  sessionsPerSubject: z.number().int().positive(),
  sessionDurationHours: z.number().positive(),
  groupMin: z.number().int().positive(),
  groupMax: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  deposit: z.number().int().nonnegative(),
  balance: z.number().int().nonnegative(),
  pricePerHour: z.number().positive(),
}).strict();

const ScheduleSessionSchema = z.object({
  date: IsoDate,
  week: z.number().int().min(1).max(2),
  level: EntryLevel,
  subjectId: SubjectId,
  subjectLabel: z.string().min(1),
  blockId: z.enum(['A', 'B', 'C', 'D']),
  startTime: Time,
  endTime: Time,
  roomLabel: z.string().min(1),
  sessionNumber: z.number().int().min(1).max(5),
}).strict();

const ScheduleWeekSchema = z.object({
  week: z.number().int().min(1).max(2),
  label: z.string().min(1),
  startDate: IsoDate,
  endDate: IsoDate,
  slots: z.array(z.object({
    level: EntryLevel,
    subjectId: SubjectId,
    subjectLabel: z.string().min(1),
    blockId: z.enum(['A', 'B', 'C', 'D']),
    startTime: Time,
    endTime: Time,
    roomLabel: z.string().min(1),
  }).strict()).length(6),
}).strict();

const ClaimSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  type: z.string().min(1),
  text: z.string().min(1),
  source: SourceEvidenceSchema,
}).strict();

export const PublicationSnapshotSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  sourceRepoSha: z.string().regex(/^[a-f0-9]{40}$/),
  generatedAt: z.string().datetime({ offset: true }),
  provenance: z.object({
    campaign: SourceProvenanceSchema,
    modules: SourceProvenanceSchema,
    pricing: SourceProvenanceSchema,
    legal: SourceProvenanceSchema,
    contact: SourceProvenanceSchema,
  }).strict(),
  campaign: z.object({
    id: z.literal('pre-rentree-2026'),
    version: z.string().min(1),
    schoolYear: z.string().min(1),
    timezone: z.literal('Africa/Tunis'),
    publicationMode: z.literal('PRE_REGISTRATION_ONLY'),
    startDate: IsoDate,
    endDate: IsoDate,
    noClassDates: z.array(IsoDate),
    decisionDeadline: z.string().datetime({ offset: true }),
    venue: z.object({
      name: z.string().min(1),
      neighborhood: z.string().min(1),
      city: z.string().min(1),
    }).strict(),
    capacity: z.object({ min: z.number().int(), max: z.number().int() }).strict(),
  }).strict(),
  levels: z.array(z.object({ id: EntryLevel, label: z.string().min(1) }).strict()).length(3),
  subjects: z.array(z.object({
    id: SubjectId,
    label: z.string().min(1),
    labelByLevel: z.record(z.string()).optional(),
    publicLabelByLevel: z.record(z.string()),
    abbreviation: z.string().min(1),
    color: z.string().regex(/^#[A-Fa-f0-9]{6}$/),
  }).strict()).length(4),
  blocks: z.array(z.object({ id: z.enum(['A', 'B', 'C', 'D']), startTime: Time, endTime: Time }).strict()).length(4),
  schedule: z.object({
    weeks: z.array(ScheduleWeekSchema).length(2),
    sessions: z.array(ScheduleSessionSchema).length(60),
  }).strict(),
  academicProfiles: z.record(z.unknown()),
  packs: z.array(PackSchema).length(4),
  modules: z.array(ModuleSchema).length(12),
  content: z.object({
    hero: z.object({ eyebrow: z.string(), h1: z.string(), subtitle: z.string() }).strict(),
    method: z.array(z.object({ title: z.string(), description: z.string() }).strict()),
    practical: z.record(z.unknown()),
    faq: z.array(z.object({ question: z.string(), answer: z.string() }).strict()),
    adaptationNotice: z.string().min(1),
    recordingConsentNotice: z.string().min(1),
  }).strict(),
  labels: z.object({
    deposit: z.literal('Acompte'),
    balance: z.literal('Solde'),
    price: z.literal('Prix'),
  }).strict(),
  cta: z.object({
    primary: z.literal('Se pré-inscrire ou demander un conseil'),
    whatsapp: z.string().min(1),
    bilanLabel: z.string().min(1),
    bilanPath: z.string().startsWith('/'),
  }).strict(),
  contact: z.object({
    phone: z.string().min(1),
    phoneRaw: z.string().min(1),
    email: z.string().email(),
    whatsappUrl: z.string().url(),
    canonicalUrl: z.string().url(),
    domain: z.string().min(1),
  }).strict(),
  legal: z.object({
    status: z.enum(['APPROVED', 'MISSING_APPROVED_COMMERCIAL_TERMS', 'UNAPPROVED_COMMERCIAL_TERMS']),
    commercialTermsPath: z.string().min(1),
    contractualDossierPublicationBlocked: z.boolean(),
    termsVersion: z.string().nullable(),
    effectiveDate: IsoDate.nullable(),
    ownerApprovalReference: z.string().nullable(),
    legalApprovalReference: z.string().nullable(),
    privacyNoticeComplete: z.boolean(),
  }).strict(),
  approvedPublicClaims: z.array(ClaimSchema).min(1),
  assets: z.object({
    logos: z.array(z.object({ id: z.string(), path: z.string(), sha256: Sha256 }).strict()).min(1),
    fonts: z.array(z.object({ id: z.string(), path: z.string(), sha256: Sha256 }).strict()).min(1),
  }).strict(),
  document: z.object({
    version: z.literal('v5-canonical'),
    editDate: IsoDate,
    publicClassification: z.literal('PUBLIC'),
    privateClassification: z.literal('PRIVÉ'),
    qrTarget: z.string().url(),
  }).strict(),
}).strict();

export type PublicationSnapshot = z.infer<typeof PublicationSnapshotSchema>;
