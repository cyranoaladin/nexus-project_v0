import { z } from 'zod';

import contractJson from '@/content/pre-rentree-2026/commercial-contract.fr.json';
import proofsJson from '@/content/pre-rentree-2026/proofs.registry.json';
import {
  getPreRentreeFoundationsProducts,
  getPreRentreePacks,
  getRules,
} from '@/lib/pricing';

const SubjectSchema = z.enum([
  'MATHEMATIQUES',
  'PHYSIQUE_CHIMIE',
  'NSI',
  'FRANCAIS',
  'PHILOSOPHIE',
]);

const OfferSourceSchema = z.object({
  offerId: z.string().min(1),
  pricingId: z.string().min(1),
  pricingKind: z.enum(['FOUNDATIONS', 'PREMIUM_PACK']),
  level: z.enum(['TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE']),
  subjects: z.array(SubjectSchema).min(1).max(4),
  subjectCount: z.number().int().min(1).max(4).optional(),
  audience: z.array(z.string().min(1)).min(1),
  objectives: z.array(z.string().min(1)).min(1),
  included: z.array(z.string().min(1)).min(1),
  optional: z.array(z.string().min(1)),
  excluded: z.array(z.string().min(1)),
  supports: z.array(z.string().min(1)),
  followUp: z.array(z.string().min(1)),
  cta: z.string().min(1),
  proofIds: z.array(z.string().min(1)).min(1),
  publicStatus: z.enum(['APPROVED', 'HIDDEN', 'DRAFT']),
  approvers: z.array(z.string().min(1)).min(1),
  validatedAt: z.string().date(),
  lastRevisedAt: z.string().date(),
}).strict();

const CommercialContractSourceSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  version: z.string().min(1),
  campaignId: z.literal('pre-rentree-2026'),
  locale: z.literal('fr-TN'),
  validationDate: z.string().date(),
  lastRevisedAt: z.string().date(),
  offers: z.array(OfferSourceSchema).length(13),
}).strict().superRefine((source, context) => {
  for (const [index, offer] of source.offers.entries()) {
    if (offer.level === 'SECONDE' && offer.subjects.some((subject) => subject === 'NSI')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['offers', index, 'subjects'],
        message: 'NSI/SNT is not an approved Seconde subject.',
      });
    }
    if (offer.pricingKind === 'PREMIUM_PACK' && offer.subjectCount === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['offers', index, 'subjectCount'],
        message: 'A Premium pack requires a subject count.',
      });
    }
  }
});

const ProofSchema = z.object({
  proofId: z.string().min(1),
  claim: z.string().min(1),
  evidenceType: z.string().min(1),
  sourceRef: z.string().min(1),
  status: z.enum(['APPROVED', 'PENDING', 'REJECTED']),
  approvedByRole: z.string().min(1).nullable().optional(),
  approvedAt: z.string().date().nullable().optional(),
  scope: z.string().min(1),
}).strict();

const DecisionSchema = z.object({
  decisionId: z.string().min(1),
  subject: z.string().min(1),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CLOSED_EXCLUDED']),
  publicEffect: z.enum(['HIDDEN', 'PACKAGE_REVIEW', 'RESOURCES_DRAFT', 'PUBLIC']),
  responsibleRole: z.string().min(1),
  decidedAt: z.string().date().nullable(),
  nextReviewAt: z.string().date().nullable(),
  reason: z.string().min(1),
}).strict();

const ProofRegistrySchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  version: z.string().min(1),
  campaignId: z.literal('pre-rentree-2026'),
  lastRevisedAt: z.string().date(),
  proofs: z.array(ProofSchema).min(1),
  decisions: z.array(DecisionSchema).min(1),
}).strict();

const source = CommercialContractSourceSchema.parse(contractJson);
const proofs = ProofRegistrySchema.parse(proofsJson);

export type CommercialOffer = z.infer<typeof OfferSourceSchema> & {
  hours: number;
  sessions: number;
  sessionDurationHours: number;
  groupMin: number;
  groupMax: number;
  price: number;
  deposit: number;
  balance: number;
  currency: 'TND';
  publiclyEligible: boolean;
};

export function compileCommercialPublicationContract() {
  const proofById = new Map(proofs.proofs.map((proof) => [proof.proofId, proof]));
  const foundationsById = new Map(
    getPreRentreeFoundationsProducts().map((product) => [product.id, product]),
  );
  const packsById = new Map(getPreRentreePacks().map((product) => [product.id, product]));

  const offers: CommercialOffer[] = source.offers.map((offer) => {
    const product = offer.pricingKind === 'FOUNDATIONS'
      ? foundationsById.get(offer.pricingId)
      : packsById.get(offer.pricingId);
    if (!product) throw new Error(`Unknown canonical pricingId: ${offer.pricingId}`);

    const publiclyEligible = offer.publicStatus === 'APPROVED'
      && offer.proofIds.every((proofId) => proofById.get(proofId)?.status === 'APPROVED')
      && !(offer.level === 'SECONDE' && offer.subjects.includes('NSI'));

    return {
      ...offer,
      hours: product.total_hours,
      sessions: product.sessions_per_subject * ('subjects_count' in product ? product.subjects_count : 1),
      sessionDurationHours: product.session_duration_h,
      groupMin: product.group_min_open,
      groupMax: product.group_max,
      price: product.price_per_student,
      deposit: product.payment.deposit,
      balance: product.payment.solde,
      currency: 'TND' as const,
      publiclyEligible,
    };
  });

  const rules = getRules();
  const pricingExceptions = getPreRentreeFoundationsProducts()
    .filter((product) => product.commercial_exception)
    .map((product) => ({
      exceptionId: product.commercial_exception!.exception_id,
      editionId: product.commercial_exception!.edition_id,
      status: product.commercial_exception!.status,
      approvedAt: product.commercial_exception!.approved_at,
      approvedByRole: product.commercial_exception!.approved_by_role,
      scope: product.commercial_exception!.scope,
      justification: product.commercial_exception!.justification,
      pricePerStudentHour: product.price_per_student_hour,
      standardFloorPerStudentHour: rules.price_floor_per_student_hour_tnd[product.floor_type],
    }));

  return {
    schemaVersion: source.schemaVersion,
    version: source.version,
    campaignId: source.campaignId,
    locale: source.locale,
    validationDate: source.validationDate,
    lastRevisedAt: source.lastRevisedAt,
    offers,
    proofs,
    pricingExceptions,
  };
}

export function getCommercialPublicOffers(): CommercialOffer[] {
  return compileCommercialPublicationContract().offers.filter((offer) => offer.publiclyEligible);
}
