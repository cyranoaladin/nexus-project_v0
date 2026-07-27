import { z } from 'zod';

import documentManifestSource from '@/assets/campaigns/pre-rentree-2026/documents-final/manifest.json';
import { getPreRentreeReleaseGate } from './release-gate';

/**
 * Documents PDF téléchargeables de la campagne pré-rentrée 2026 (servis depuis /public).
 * Depuis la refonte éditoriale du 2026-07-25 (tools/pdf-generator/generate_level_dossiers.py),
 * chaque Programme_{niveau}.pdf est un dossier complet parents consolidant planning + programme
 * de chaque matière du niveau (SVT incluse comme chapitre ordinaire en Première/Terminale) — il
 * n'existe plus de PDF SVT autonome (voir l'archive dans documents-final/archive/).
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
    'REVIEW_PENDING_PEDAGOGICAL_VALIDATION',
    'PUBLIC_FINAL',
    'INTERNAL_REVIEW',
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
    href: `${BASE}/NexusReussite_PreRentree2026_Programme_3e.pdf`,
    label: 'Télécharger le dossier complet — Entrée en 3e',
    size: generatedSize('NexusReussite_PreRentree2026_Programme_3e.pdf'),
    kind: 'programme',
  },
  {
    href: `${BASE}/NexusReussite_PreRentree2026_Programme_Seconde.pdf`,
    label: 'Télécharger le dossier complet — Entrée en Seconde',
    size: generatedSize('NexusReussite_PreRentree2026_Programme_Seconde.pdf'),
    kind: 'programme',
  },
  {
    href: `${BASE}/NexusReussite_PreRentree2026_Programme_Premiere.pdf`,
    label: 'Télécharger le dossier complet — Entrée en Première',
    size: generatedSize('NexusReussite_PreRentree2026_Programme_Premiere.pdf'),
    kind: 'programme',
  },
  {
    href: `${BASE}/NexusReussite_PreRentree2026_Programme_Terminale.pdf`,
    label: 'Télécharger le dossier complet — Entrée en Terminale',
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
