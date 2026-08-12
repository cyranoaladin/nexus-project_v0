import { z } from 'zod';

import releaseGateMatrixSource from '@/content/pre-rentree-2026/release-gates.json';
import campaignManifest from '@/data/campaigns/pre-rentree-2026.json';
import { CampaignReleaseStatus } from './schema';

export const PRE_RENTREE_RELEASE_STATUSES = [
  'INTERNAL_DRAFT',
  'READY_FOR_REVIEW',
  'READY_FOR_OWNER_GO',
  'PUBLIC_READY',
] as const;

export type PreRentreeReleaseStatus = typeof PRE_RENTREE_RELEASE_STATUSES[number];

export const PRE_RENTREE_REQUIRED_GATE_IDS = [
  'pedagogical_validation',
  'teacher_assignments',
  'rooms',
  'capacity',
  'qualifications',
  'tariffs',
  'payment_receipt',
  'cancellation_refund',
  'privacy_retention',
  'downloads',
  'contact_channels_forms',
  'manuals_annual_discount',
  'publication_authorization',
] as const;

const PreRentreeReleaseGateId = z.enum(PRE_RENTREE_REQUIRED_GATE_IDS);
const PreRentreeReleaseGateResolutionStatus = z.enum([
  'VALIDATED',
  'MITIGATED_BY_SCOPE',
  'NOT_APPLICABLE',
  'OPEN',
]);

const PreRentreeReleaseGateMatrixSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  campaignId: z.literal('pre-rentree-2026'),
  releaseStatus: CampaignReleaseStatus,
  requiredPublicStatus: z.literal('PUBLIC_READY'),
  assessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gates: z.array(z.object({
    id: PreRentreeReleaseGateId,
    status: PreRentreeReleaseGateResolutionStatus,
    value: z.boolean(),
    resolution: z.string().min(1),
    evidence: z.array(z.string().min(1)).min(1),
    owner: z.string().min(1),
    validatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  }).strict()).length(PRE_RENTREE_REQUIRED_GATE_IDS.length),
}).strict().superRefine((matrix, context) => {
  const gateIds = matrix.gates.map(({ id }) => id);
  if (new Set(gateIds).size !== PRE_RENTREE_REQUIRED_GATE_IDS.length
    || gateIds.some((id, index) => id !== PRE_RENTREE_REQUIRED_GATE_IDS[index])) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['gates'],
      message: 'The release gate matrix must contain every required gate once, in canonical order.',
    });
  }

  matrix.gates.forEach((gate, index) => {
    if (gate.value !== (gate.status !== 'OPEN')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gates', index, 'value'],
        message: 'A gate value must be true exactly when its resolution status is not OPEN.',
      });
    }
    if (gate.value !== (gate.validatedAt !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gates', index, 'validatedAt'],
        message: 'A resolved gate requires a date; an open gate must not have one.',
      });
    }
  });
});

const releaseStatus = CampaignReleaseStatus.parse(campaignManifest.releaseStatus);
const releaseGateMatrix = PreRentreeReleaseGateMatrixSchema.parse(releaseGateMatrixSource);

if (releaseGateMatrix.releaseStatus !== releaseStatus) {
  throw new Error('Campaign release status and release gate matrix status must match.');
}

export function getPreRentreeReleaseGate() {
  const unmetGateIds = releaseGateMatrix.gates
    .filter(({ value }) => !value)
    .map(({ id }) => id);

  return {
    releaseStatus,
    requiredPublicStatus: releaseGateMatrix.requiredPublicStatus,
    gates: releaseGateMatrix.gates,
    unmetGateIds,
    isPublicReady: releaseStatus === 'PUBLIC_READY' && unmetGateIds.length === 0,
  } as const;
}

export function isPreRentreeProtectedPublicPath(pathname: string): boolean {
  return pathname === '/pre-rentree'
    || pathname.startsWith('/pre-rentree/')
    || pathname === '/stages/pre-rentree-2026'
    || pathname.startsWith('/stages/pre-rentree-2026/')
    || pathname === '/api/stages/pre-rentree-2026'
    || pathname === '/api/stages/pre-rentree-2026/inscrire'
    || pathname === '/documents/pre-rentree-2026'
    || pathname.startsWith('/documents/pre-rentree-2026/');
}

export function filterPreRentreeFromPublicStages<T extends { slug: string }>(stages: T[]): T[] {
  if (getPreRentreeReleaseGate().isPublicReady) return stages;
  return stages.filter((stage) => stage.slug !== 'pre-rentree-2026');
}

export function canExposePublicStageSlug(stageSlug: string): boolean {
  return stageSlug !== 'pre-rentree-2026' || getPreRentreeReleaseGate().isPublicReady;
}

/**
 * Inscription en ligne à la campagne Pré-rentrée 2026 : DÉLIBÉRÉMENT
 * désactivée. Ce n'est ni un oubli ni un chantier interrompu.
 *
 * Décision produit assumée par le responsable pédagogique (12/08/2026,
 * documentée dans `onlineRegistrationDecision` de
 * data/campaigns/pre-rentree-2026.json) : les inscriptions aux stages de
 * pré-rentrée se font hors ligne, par WhatsApp ou directement au centre —
 * jamais par soumission en ligne. La page publique
 * (/stages/pre-rentree-2026) reste strictement informative ; toutes ses
 * offres pointent vers WhatsApp, jamais vers un formulaire de réservation.
 * Aucune inscription n'a été perdue par ce garde : il n'existe pas de
 * chemin de soumission fonctionnel à protéger.
 *
 * Ne pas faire passer ce garde à `true` sans nouvelle décision explicite
 * documentée ici et dans le manifeste.
 */
export function canAcceptPreRentreeCampaignSubmission(): boolean {
  return false;
}

/**
 * Whether /bilan-gratuit may read Pré-rentrée query params to prefill the
 * funnel (grade, subjects, pedagogical profile) or attach a campaignContext
 * to the submission. Deliberately independent from `isPublicReady`: the
 * Stage going public must never, by itself, change the standalone Bilan
 * funnel's behaviour (owner decision, 2026-07-27 — Stage/Bilan boundary).
 * Stays fail-closed until the Bilan workstream explicitly re-enables this
 * integration.
 */
export function canPrefillBilanGratuitFromPreRentree(): boolean {
  return false;
}
