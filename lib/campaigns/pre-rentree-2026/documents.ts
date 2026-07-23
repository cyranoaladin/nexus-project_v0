import { z } from 'zod';

import documentManifestSource from '@/assets/campaigns/pre-rentree-2026/documents-final/manifest.json';
import { getPreRentreeReleaseGate } from './release-gate';

/**
 * Documents PDF téléchargeables de la campagne pré-rentrée 2026 (servis depuis /public).
 * Les programmes SVT (DRAFT tant que D2 non levée) ne sont volontairement PAS listés ici.
 */
export type PreRentreeDocument = {
  href: string;
  label: string;
  size: string;
  kind: 'planning' | 'programme' | 'tarifs' | 'flyer';
};

const BASE = '/documents/pre-rentree-2026';

const GeneratedDocumentListSchema = z.array(z.object({
  fileName: z.string().endsWith('.pdf'),
  bytes: z.number().int().positive(),
  sizeLabel: z.string().regex(/^\d+ Ko$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  pageCount: z.number().int().positive(),
  publicDownloadCandidate: z.boolean(),
  publicationStatus: z.enum([
    'DRAFT_PENDING_QUALIFIED_TEACHER_VALIDATION',
    'REVIEW_NON_CONTRACTUAL',
  ]),
}).strict());

const generatedDocuments = GeneratedDocumentListSchema.parse(documentManifestSource.documents);
const generatedDocumentByName = new Map(
  generatedDocuments.map((document) => [document.fileName, document]),
);

function generatedSize(fileName: string): string {
  const document = generatedDocumentByName.get(fileName);
  if (!document?.publicDownloadCandidate) {
    throw new Error(`Missing public-candidate document in generated manifest: ${fileName}`);
  }
  return document.sizeLabel;
}

export const PRE_RENTREE_DOCUMENTS: readonly PreRentreeDocument[] = [
  {
    href: `${BASE}/NexusReussite_PreRentree2026_Planning_InfosPratiques.pdf`,
    label: 'Planning et informations pratiques',
    size: generatedSize('NexusReussite_PreRentree2026_Planning_InfosPratiques.pdf'),
    kind: 'planning',
  },
  {
    href: `${BASE}/NexusReussite_PreRentree2026_Programme_Seconde.pdf`,
    label: 'Programme détaillé — Entrée en Seconde',
    size: generatedSize('NexusReussite_PreRentree2026_Programme_Seconde.pdf'),
    kind: 'programme',
  },
  {
    href: `${BASE}/NexusReussite_PreRentree2026_Programme_Premiere.pdf`,
    label: 'Programme détaillé — Entrée en Première',
    size: generatedSize('NexusReussite_PreRentree2026_Programme_Premiere.pdf'),
    kind: 'programme',
  },
  {
    href: `${BASE}/NexusReussite_PreRentree2026_Programme_Terminale.pdf`,
    label: 'Programme détaillé — Entrée en Terminale',
    size: generatedSize('NexusReussite_PreRentree2026_Programme_Terminale.pdf'),
    kind: 'programme',
  },
  {
    href: `${BASE}/NexusReussite_PreRentree2026_Tarifs.pdf`,
    label: 'Tarifs et conditions financières',
    size: generatedSize('NexusReussite_PreRentree2026_Tarifs.pdf'),
    kind: 'tarifs',
  },
  {
    href: `${BASE}/NexusReussite_PreRentree2026_FlyerEssentiel.pdf`,
    label: "L'essentiel (flyer 1 page)",
    size: generatedSize('NexusReussite_PreRentree2026_FlyerEssentiel.pdf'),
    kind: 'flyer',
  },
] as const;

export const PRE_RENTREE_PROGRAMME_DOCUMENTS = PRE_RENTREE_DOCUMENTS.filter((d) => d.kind === 'programme');

export function getPublicPreRentreeDocuments(): readonly PreRentreeDocument[] {
  return getPreRentreeReleaseGate().isPublicReady ? PRE_RENTREE_DOCUMENTS : [];
}
