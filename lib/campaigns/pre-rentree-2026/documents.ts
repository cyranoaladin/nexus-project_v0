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

export const PRE_RENTREE_DOCUMENTS: readonly PreRentreeDocument[] = [
  { href: `${BASE}/NexusReussite_PreRentree2026_Planning_InfosPratiques.pdf`, label: 'Planning et informations pratiques', size: '444 Ko', kind: 'planning' },
  { href: `${BASE}/NexusReussite_PreRentree2026_Programme_Seconde.pdf`, label: 'Programme détaillé — Entrée en Seconde', size: '426 Ko', kind: 'programme' },
  { href: `${BASE}/NexusReussite_PreRentree2026_Programme_Premiere.pdf`, label: 'Programme détaillé — Entrée en Première', size: '427 Ko', kind: 'programme' },
  { href: `${BASE}/NexusReussite_PreRentree2026_Programme_Terminale.pdf`, label: 'Programme détaillé — Entrée en Terminale', size: '427 Ko', kind: 'programme' },
  { href: `${BASE}/NexusReussite_PreRentree2026_Tarifs.pdf`, label: 'Tarifs et conditions financières', size: '426 Ko', kind: 'tarifs' },
  { href: `${BASE}/NexusReussite_PreRentree2026_FlyerEssentiel.pdf`, label: "L'essentiel (flyer 1 page)", size: '76 Ko', kind: 'flyer' },
] as const;

export const PRE_RENTREE_PROGRAMME_DOCUMENTS = PRE_RENTREE_DOCUMENTS.filter((d) => d.kind === 'programme');

export function getPublicPreRentreeDocuments(): readonly PreRentreeDocument[] {
  return getPreRentreeReleaseGate().isPublicReady ? PRE_RENTREE_DOCUMENTS : [];
}
import { getPreRentreeReleaseGate } from './release-gate';
