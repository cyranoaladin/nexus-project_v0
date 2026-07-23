import campaignManifest from '@/data/campaigns/pre-rentree-2026.json';
import { CampaignReleaseStatus } from './schema';

export const PRE_RENTREE_RELEASE_STATUSES = [
  'INTERNAL_DRAFT',
  'READY_FOR_REVIEW',
  'READY_FOR_OWNER_GO',
  'PUBLIC_READY',
] as const;

export type PreRentreeReleaseStatus = typeof PRE_RENTREE_RELEASE_STATUSES[number];

const releaseStatus = CampaignReleaseStatus.parse(campaignManifest.releaseStatus);

export function getPreRentreeReleaseGate() {
  return {
    releaseStatus,
    isPublicReady: releaseStatus === 'PUBLIC_READY',
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
