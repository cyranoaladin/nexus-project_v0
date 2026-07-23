import { z } from 'zod';
import {
  PreRentreeCapabilitiesSchema,
  PreRentreeCommunicationSchema,
  PreRentreeManualsRegistrySchema,
  PreRentreeOffersSchema,
  PreRentreeOperationsSchema,
  PreRentreeWhatsAppSchema,
} from '@/lib/campaigns/pre-rentree-2026/content-schema';

const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const GitCommitSha = z.string().regex(/^[a-f0-9]{40}$/);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Time = z.string().regex(/^\d{2}:\d{2}$/);
const EntryLevel = z.enum(['TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE']);
const SubjectId = z.enum(['MATHEMATIQUES', 'FRANCAIS', 'NSI', 'PHYSIQUE_CHIMIE', 'PHILOSOPHIE', 'SVT']);

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
  publicationStatus: z.enum(['PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION', 'DRAFT_PENDING_QUALIFIED_TEACHER_VALIDATION']).optional(),
  objective: z.string().min(1).optional(),
  equipment: z.string().min(1).optional(),
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
  }).strict()).min(1),
}).strict();

const PerformanceRubricSchema = z.object({
  ACQUIS: z.string().min(1),
  FRAGILE: z.string().min(1),
  LACUNE: z.string().min(1),
}).strict();

const PositioningTestSchema = z.object({
  id: z.string().startsWith('POS-'),
  moduleId: z.string().min(1),
  version: z.string().min(1),
  durationMinutes: z.number().int().min(15).max(60),
  materialAllowed: z.string().min(1),
  domains: z.array(z.string().min(1)).length(5),
  questions: z.array(z.object({
    number: z.number().int().min(1).max(5),
    domain: z.string().min(1),
    prompt: z.string().min(1),
    correction: z.string().min(1),
    points: z.number().int().positive(),
    errorTypes: z.array(z.string().min(1)).min(3),
  }).strict()).length(5),
  totalPoints: z.literal(20),
  rubric: PerformanceRubricSchema,
  errorTypes: z.array(z.string().min(1)).min(3),
  coherenceChecks: z.array(z.string().min(1)).min(3),
  anonymousSample: z.object({
    sampleId: z.string().regex(/^SAMPLE-ANON-\d{2}$/),
    response: z.string().min(1),
    assessment: z.string().min(1),
  }).strict(),
}).strict();

const QuickAssessmentSchema = z.object({
  id: z.string().startsWith('QA-'),
  sessionRef: z.string().min(1),
  durationMinutes: z.number().int().min(5).max(10),
  domain: z.string().min(1),
  prompt: z.string().min(1),
  correction: z.string().min(1),
  successCriterion: z.string().min(1),
  expectedLevel: EntryLevel,
  captureMode: z.string().min(1),
}).strict();

const SessionDeliverableSchema = z.object({
  id: z.string().startsWith('DEL-'),
  sessionRef: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  instructions: z.array(z.string().min(1)).min(3),
  expectedEvidence: z.array(z.string().min(1)).min(2),
  selfCheck: z.array(z.string().min(1)).min(3),
}).strict();

const ClaimSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  type: z.string().min(1),
  text: z.string().min(1),
  source: SourceEvidenceSchema,
}).strict();

const EvidenceReferenceSchema = z.string().startsWith('/');

const ParentGuideBlockSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    kind: z.literal('EVIDENCED_TEXT'),
    text: z.string().min(1),
    evidenceRefs: z.array(EvidenceReferenceSchema).min(1),
    capabilityId: z.string().optional(),
  }).strict(),
  z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    kind: z.literal('EVIDENCED_PROCEDURE'),
    steps: z.array(z.object({
      text: z.string().min(1),
      evidenceRefs: z.array(EvidenceReferenceSchema).min(1),
    }).strict()).min(1),
  }).strict(),
  z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    kind: z.literal('DYNAMIC_REFERENCE'),
    sourceRef: EvidenceReferenceSchema,
  }).strict(),
]);

export const ParentGuideContentSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  contentVersion: z.string().min(1),
  locale: z.literal('fr-TN'),
  status: z.literal('DRAFT_FOR_OWNER_REVIEW'),
  documentPackageVersion: z.string().regex(/^\d+\.\d+\.\d+-rc\.\d+$/),
  documentEditionDate: IsoDate,
  snapshotBuiltAt: z.string().datetime({ offset: true }),
  sections: z.array(z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1),
    blocks: z.array(ParentGuideBlockSchema).min(1),
  }).strict()).min(1),
}).strict();

export const PublicationSnapshotSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  sourceSetSha256: Sha256,
  sourceAnchorSha: GitCommitSha,
  repositoryCommitSha: GitCommitSha,
  repositoryCommitDate: z.string().datetime({ offset: true }),
  snapshotBuiltAt: z.string().datetime({ offset: true }),
  provenance: z.object({
    sourceAnchor: SourceProvenanceSchema,
    campaign: SourceProvenanceSchema,
    modules: SourceProvenanceSchema,
    pricing: SourceProvenanceSchema,
    legal: SourceProvenanceSchema,
    contact: SourceProvenanceSchema,
    parentGuide: SourceProvenanceSchema,
    pedagogyFramework: SourceProvenanceSchema,
    offers: SourceProvenanceSchema,
    capabilities: SourceProvenanceSchema,
    manuals: SourceProvenanceSchema,
    communication: SourceProvenanceSchema,
    whatsapp: SourceProvenanceSchema,
    operations: SourceProvenanceSchema,
  }).strict(),
  campaign: z.object({
    id: z.literal('pre-rentree-2026'),
    version: z.string().min(1),
    schoolYear: z.string().min(1),
    timezone: z.literal('Africa/Tunis'),
    publicationMode: z.enum(['REVIEW', 'RELEASE']),
    startDate: IsoDate,
    endDate: IsoDate,
    noClassDates: z.array(IsoDate),
    decisionDeadline: z.string().datetime({ offset: true }),
    venue: z.object({
      name: z.string().min(1),
      neighborhood: z.string().min(1),
      city: z.string().min(1),
    }).strict(),
    capacityByOffer: z.object({
      FONDATIONS: z.object({ min: z.literal(4), max: z.literal(6) }).strict(),
      PREMIUM: z.object({ min: z.literal(3), max: z.literal(5) }).strict(),
    }).strict(),
    operationalGates: z.object({
      roomAssignmentsValidated: z.boolean(),
      teacherAssignmentsValidated: z.boolean(),
      noTeacherConflict: z.boolean(),
      noRoomConflict: z.boolean(),
      dailyLoadValid: z.boolean(),
    }).strict(),
  }).strict(),
  levels: z.array(z.object({ id: EntryLevel, label: z.string().min(1) }).strict()).length(4),
  subjects: z.array(z.object({
    id: SubjectId,
    label: z.string().min(1),
    labelByLevel: z.record(z.string()).optional(),
    publicLabelByLevel: z.record(z.string()),
    abbreviation: z.string().min(1),
    color: z.string().regex(/^#[A-Fa-f0-9]{6}$/),
  }).strict()).length(6),
  blocks: z.array(z.object({ id: z.enum(['A', 'B', 'C', 'D']), startTime: Time, endTime: Time }).strict()).length(4),
  schedule: z.object({
    weeks: z.array(ScheduleWeekSchema).length(2),
    sessions: z.array(ScheduleSessionSchema).length(75),
  }).strict(),
  academicProfiles: z.record(z.unknown()),
  packs: z.array(PackSchema).length(4),
  modules: z.array(ModuleSchema).length(15),
  pedagogy: z.object({
    positioningTests: z.array(PositioningTestSchema).length(15),
    quickAssessments: z.array(QuickAssessmentSchema).length(75),
    sessionDeliverables: z.array(SessionDeliverableSchema).length(75),
  }).strict(),
  offers: PreRentreeOffersSchema,
  offerPricing: z.array(z.object({
    level: EntryLevel,
    range: z.enum(['FONDATIONS', 'PREMIUM']),
    subjectCount: z.number().int().min(1).max(4),
    totalHours: z.number().int().positive(),
    price: z.number().int().positive(),
    deposit: z.number().int().positive(),
    balance: z.number().int().positive(),
    pricePerHour: z.number().positive(),
  }).strict()).length(13),
  capabilities: PreRentreeCapabilitiesSchema,
  manuals: PreRentreeManualsRegistrySchema,
  communication: PreRentreeCommunicationSchema,
  whatsapp: PreRentreeWhatsAppSchema,
  operations: PreRentreeOperationsSchema,
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
    primary: z.literal('Demander un parcours ou un conseil'),
    whatsapp: z.string().min(1),
    bilanLabel: z.string().min(1),
    bilanPath: z.string().startsWith('/'),
  }).strict(),
  contact: z.object({
    phone: z.string().min(1),
    phoneRaw: z.string().min(1),
    email: z.string().email(),
    addressLabel: z.string().min(1),
    address: z.string().min(1),
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
  parentGuide: ParentGuideContentSchema,
  assets: z.object({
    logos: z.array(z.object({ id: z.string(), path: z.string(), sha256: Sha256 }).strict()).min(1),
    fonts: z.array(z.object({ id: z.string(), path: z.string(), sha256: Sha256 }).strict()).min(1),
  }).strict(),
  document: z.object({
    documentPackageVersion: z.string().regex(/^\d+\.\d+\.\d+-rc\.\d+$/),
    documentEditionDate: IsoDate,
    publicClassification: z.literal('PUBLIC'),
    qrTarget: z.string().url(),
    outputs: z.object({
      publicPdf: z.record(z.string().endsWith('.pdf')),
      publicHtml: z.record(z.string().endsWith('.html')),
      social: z.object({
        feed: z.string().endsWith('.png'),
        story: z.string().endsWith('.png'),
        monochrome: z.string().endsWith('.png'),
        altText: z.string().endsWith('.json'),
      }).strict(),
    }).strict(),
  }).strict(),
  reviews: z.object({
    ownerReviewedAt: z.string().datetime({ offset: true }).nullable(),
    legalReviewedAt: z.string().datetime({ offset: true }).nullable(),
    privacyReviewedAt: z.string().datetime({ offset: true }).nullable(),
  }).strict(),
}).strict();

export type PublicationSnapshot = z.infer<typeof PublicationSnapshotSchema>;
