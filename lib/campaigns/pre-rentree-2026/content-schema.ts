import { z } from 'zod';
import { EntryLevelCode } from './schema';

export const OfferRange = z.enum(['FONDATIONS', 'PREMIUM']);
const SubjectId = z.enum(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'FRANCAIS', 'PHILOSOPHIE']);

export const PreRentreeOffersSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  version: z.string().min(1),
  campaignId: z.literal('pre-rentree-2026'),
  depositRate: z.literal(0.3),
  levels: z.array(z.object({
    level: EntryLevelCode,
    range: OfferRange,
    signature: z.string().min(1),
    subjects: z.array(SubjectId).min(1).max(4),
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

export type PreRentreeOfferRange = z.infer<typeof OfferRange>;
