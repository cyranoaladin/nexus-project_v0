import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  loadBilanPack,
  loadValidatedPack,
  type BilanPack,
} from '@/lib/bilans/catalog/load-pack';
import type { ValidatedPack } from '@/lib/bilans/validators/contracts';
import { loadWaveManifest } from '@/lib/bilans/catalog/wave-manifest';

import { CanonicalApiError } from './errors';

const ACTIVE_PACK_MANIFEST = 'data/bilans/banks/wave1.manifest.json';

export function listResolvablePackSlugs(): readonly string[] {
  return Object.freeze(loadWaveManifest(ACTIVE_PACK_MANIFEST).banks.map(({ slug }) => slug).sort());
}

export function resolveCatalogPackPath(slug: string): string | null {
  return loadWaveManifest(ACTIVE_PACK_MANIFEST).banks.find((entry) => entry.slug === slug)?.output ?? null;
}

type PackActivationCandidate = Readonly<{
  slug: string;
  status: string;
  review: Readonly<{ validatedBy: string | null; validatedAt: string | null }>;
}>;

export type EnabledBilanPack = Readonly<{
  pack: BilanPack;
  validatedPack: ValidatedPack;
  checksum: string;
  path: string;
}>;

export type AttemptPackIdentity = Readonly<{
  assessmentPackId: string;
  assessmentPackVersion?: string | number;
}>;

export type PackResolver = (slug: string, version?: number) => EnabledBilanPack | null;

export function packFeatureFlagName(slug: string): string {
  return `NEXUS_BILAN_PACK_${slug.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_ENABLED`;
}

export function isPackEnabled(
  pack: PackActivationCandidate,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    pack.status === 'VALIDATED'
    && typeof pack.review.validatedBy === 'string'
    && pack.review.validatedBy.trim().length > 0
    && typeof pack.review.validatedAt === 'string'
    && pack.review.validatedAt.trim().length > 0
    && environment[packFeatureFlagName(pack.slug)] === 'true'
  );
}

export function resolveEnabledPack(
  slug: string,
  version?: number,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): EnabledBilanPack | null {
  const packPath = resolveCatalogPackPath(slug);
  if (packPath === null) return null;

  try {
    const pack = loadBilanPack(packPath);
    if (pack.slug !== slug || (version !== undefined && pack.version !== version)) return null;
    if (!isPackEnabled(pack, environment)) return null;
    const validatedPack = loadValidatedPack(packPath);
    const checksum = createHash('sha256').update(readFileSync(packPath)).digest('hex');
    return Object.freeze({ pack, validatedPack, checksum, path: packPath });
  } catch {
    return null;
  }
}

export function listEnabledPacks(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): readonly EnabledBilanPack[] {
  return Object.freeze(listResolvablePackSlugs().flatMap((slug) => {
    const enabled = resolveEnabledPack(slug, undefined, environment);
    return enabled === null ? [] : [enabled];
  }));
}

export function assertAttemptPackEnabled(
  attempt: AttemptPackIdentity,
  resolvePack: PackResolver = resolveEnabledPack,
): EnabledBilanPack {
  let version: number | undefined;
  if (attempt.assessmentPackVersion !== undefined) {
    version = Number(attempt.assessmentPackVersion);
    if (!Number.isSafeInteger(version) || version < 1) throw CanonicalApiError.notFound();
  }

  const enabled = resolvePack(attempt.assessmentPackId, version);
  if (enabled === null) throw CanonicalApiError.notFound();
  return enabled;
}
