import { z } from 'zod';
import { EntryLevelCode } from './schema';

export const OfferRange = z.enum(['FONDATIONS', 'PREMIUM']);
const SubjectId = z.enum(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'FRANCAIS', 'PHILOSOPHIE', 'SVT']);

export const PreRentreeOffersSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  version: z.string().min(1),
  campaignId: z.literal('pre-rentree-2026'),
  depositRate: z.literal(0.3),
  levels: z.array(z.object({
    level: EntryLevelCode,
    range: OfferRange,
    signature: z.string().min(1),
    subjects: z.array(SubjectId).min(1).max(5),
    pricing: z.object({
      model: z.enum(['PER_SUBJECT', 'PACK_BY_SUBJECT_COUNT']),
      productIds: z.array(z.string().min(1)).min(1).max(4),
      multiSubjectDiscount: z.boolean(),
      maximumSubjects: z.number().int().min(1).max(4),
    }).strict(),
    capacity: z.object({
      min: z.number().int().min(3).max(4),
      max: z.number().int().min(5).max(6),
    }).strict(),
    serviceCapabilityIds: z.array(z.string().min(1)).min(1),
  }).strict()).length(4),
}).strict();

const ManualSchema = z.object({
  id: z.string().min(1),
  subject: z.enum(['MATHEMATIQUES', 'NSI']),
  level: z.enum(['PREMIERE', 'TERMINALE']),
  sourceRepository: z.literal('cyranoaladin/manuels-nexus'),
  sourceCommitSha: z.union([z.literal(''), z.string().regex(/^[a-f0-9]{40}$/)]),
  edition: z.string().min(1),
  printReady: z.boolean(),
  ownerApproved: z.boolean(),
  stockReady: z.boolean(),
  pageCount: z.number().int().positive().nullable(),
  studentCopiesOrdered: z.number().int().nonnegative(),
  reserveCopies: z.number().int().nonnegative(),
}).strict();

export const PreRentreeManualsRegistrySchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  version: z.string().min(1),
  manuals: z.array(ManualSchema).length(4),
}).strict();

export const PreRentreeCapabilitiesSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  version: z.string().min(1),
  capabilities: z.array(z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    label: z.string().min(1),
    designed: z.boolean(),
    implemented: z.boolean(),
    tested: z.boolean(),
    operationallyReady: z.boolean(),
    ownerApproved: z.boolean(),
    publiclyCommitted: z.boolean(),
  }).strict()).min(1),
}).strict().superRefine((document, context) => {
  for (const [index, capability] of document.capabilities.entries()) {
    if (capability.publiclyCommitted && (
      !capability.implemented ||
      !capability.tested ||
      !capability.operationallyReady ||
      !capability.ownerApproved
    )) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['capabilities', index, 'publiclyCommitted'],
        message: 'A public commitment requires implementation, tests, operational readiness and owner approval.',
      });
    }
  }
});

const PedagogyPatternSchema = z.object({
  taskLead: z.string().min(1),
  correctionLead: z.string().min(1),
  errorTypes: z.array(z.string().min(1)).min(3),
}).strict();

export const PreRentreePedagogyFrameworkSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  version: z.string().min(1),
  locale: z.literal('fr-TN'),
  positioningDurationMinutes: z.number().int().min(15).max(60),
  quickAssessmentDurationMinutes: z.number().int().min(5).max(10),
  moduleCodes: z.array(z.object({
    moduleId: z.string().min(1),
    code: z.string().regex(/^POS-(?:3|2|1|T)-(?:MATH|FR|PC|NSI|PHILO|SVT)$/),
    material: z.string().min(1),
  }).strict()).length(15),
  subjectPatterns: z.object({
    MATHEMATIQUES: PedagogyPatternSchema,
    PHYSIQUE_CHIMIE: PedagogyPatternSchema,
    NSI: PedagogyPatternSchema,
    FRANCAIS: PedagogyPatternSchema,
    PHILOSOPHIE: PedagogyPatternSchema,
    SVT: PedagogyPatternSchema,
  }).strict(),
  rubric: z.object({
    ACQUIS: z.string().min(1),
    FRAGILE: z.string().min(1),
    LACUNE: z.string().min(1),
  }).strict(),
  anonymousSample: z.object({
    response: z.string().min(1),
    assessment: z.string().min(1),
  }).strict(),
}).strict();

export const PreRentreeWhatsAppSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  version: z.string().min(1),
  locale: z.literal('fr-TN'),
  keywords: z.array(z.string().min(1)).length(7),
  tracking: z.object({
    campaign: z.literal('pre-rentree-2026'),
    source: z.literal('whatsapp'),
    medium: z.literal('conversation'),
  }).strict(),
  scripts: z.array(z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    purpose: z.string().min(1),
    publicGate: z.string().min(1).nullable(),
    text: z.string().min(40),
  }).strict()).length(24),
}).strict();

const PublicGate = z.string().min(1).nullable();
export const PreRentreeCommunicationSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  version: z.string().min(1),
  locale: z.literal('fr-TN'),
  formats: z.array(z.string().min(1)).min(7),
  publications: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    publicGate: PublicGate,
    text: z.string().min(1),
  }).strict()).min(13),
  carousels: z.array(z.object({
    id: z.string().min(1),
    slides: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) }).strict()).min(4),
  }).strict()).length(8),
  stories: z.array(z.object({ id: z.string().min(1) }).strict()).min(12),
  reels: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    durationSeconds: z.number().int().min(20).max(35),
    captionsRequired: z.literal(true),
    publicGate: PublicGate,
    scenes: z.array(z.string().min(1)).min(4),
  }).strict()).length(3),
  altTextTemplate: z.string().min(1),
}).strict();

const OperationalFieldType = z.enum([
  'TEXT', 'LONG_TEXT', 'PHONE', 'EMAIL', 'DATE', 'DATETIME', 'SELECT', 'RADIO',
  'CHECKBOX', 'AMOUNT', 'IDENTIFIER',
]);

export const PreRentreeOperationsSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  version: z.string().min(1),
  locale: z.literal('fr-TN'),
  reviewForms: z.array(z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1),
    purpose: z.string().min(1),
    privacyGate: z.boolean(),
    fields: z.array(z.object({
      id: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
      label: z.string().min(1),
      type: OperationalFieldType,
      required: z.boolean(),
    }).strict()).min(1),
  }).strict()).length(11),
  crm: z.object({
    statuses: z.tuple([
      z.literal('NEW'), z.literal('CONTACTED'), z.literal('QUALIFIED'),
      z.literal('PROGRAM_SENT'), z.literal('PATH_PROPOSED'), z.literal('PENDING_DEPOSIT'),
      z.literal('RESERVED'), z.literal('WAITLIST'), z.literal('GROUP_CONFIRMED'),
      z.literal('BALANCE_PENDING'), z.literal('FULLY_PAID'), z.literal('COMPLETED'),
      z.literal('CANCELLED'), z.literal('REFUNDED'),
    ]),
    fields: z.array(z.object({
      id: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
      label: z.string().min(1),
      type: z.enum(['TEXT', 'DATE', 'DATETIME', 'ENUM', 'BOOLEAN', 'AMOUNT']),
      required: z.boolean(),
    }).strict()).min(20),
  }).strict(),
  economicModel: z.object({
    currency: z.literal('TND'),
    inputs: z.array(z.object({
      id: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
      label: z.string().min(1),
      unit: z.enum(['TND', 'HOURS', 'RATE']),
      value: z.null(),
    }).strict()).min(15),
    acquisitionScenarios: z.tuple([
      z.object({ id: z.literal('LOW'), inputId: z.string().min(1) }).strict(),
      z.object({ id: z.literal('MEDIUM'), inputId: z.string().min(1) }).strict(),
      z.object({ id: z.literal('HIGH'), inputId: z.string().min(1) }).strict(),
    ]),
  }).strict(),
}).strict();

export type PreRentreeOfferRange = z.infer<typeof OfferRange>;
export type PreRentreePedagogyFramework = z.infer<typeof PreRentreePedagogyFrameworkSchema>;
