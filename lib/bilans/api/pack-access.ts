import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  loadBilanPack,
  loadValidatedPack,
  type BilanPack,
} from '@/lib/bilans/catalog/load-pack';
import type { ValidatedPack } from '@/lib/bilans/validators/contracts';
import { loadWaveManifest, type WaveBankEntry } from '@/lib/bilans/catalog/wave-manifest';

import { CanonicalApiError } from './errors';

const STABLE_PACK_MANIFEST = 'data/bilans/banks/wave1.manifest.json';

/**
 * Les vagues additionnelles sont découvertes uniquement quand le pack qui les
 * porte est explicitement activé. Cela permet d'ajouter une matière sans
 * rouvrir ni réécrire la vague 1 déjà qualifiée et ses preuves versionnées.
 */
const OPTIONAL_PACK_MANIFESTS = Object.freeze([
  Object.freeze({
    manifest: 'data/bilans/banks/wave2.manifest.json',
    activationSlug: 'entree-terminale-maths-complementaires-v1',
  }),
] as const);

function catalogEntries(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): readonly WaveBankEntry[] {
  const stable = loadWaveManifest(STABLE_PACK_MANIFEST).banks;
  const optional = OPTIONAL_PACK_MANIFESTS.flatMap(({ manifest, activationSlug }) => (
    environment[packFeatureFlagName(activationSlug)] === 'true'
      ? loadWaveManifest(manifest).banks
      : []
  ));
  const entries = [...stable, ...optional];
  const slugs = entries.map(({ slug }) => slug);
  if (new Set(slugs).size !== slugs.length) throw new Error('PACK_CATALOG_DUPLICATE_SLUG');
  return Object.freeze(entries);
}

export function listResolvablePackSlugs(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): readonly string[] {
  return Object.freeze(catalogEntries(environment).map(({ slug }) => slug).sort());
}

export function resolveCatalogPackPath(
  slug: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  return catalogEntries(environment).find((entry) => entry.slug === slug)?.output ?? null;
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
  const packPath = resolveCatalogPackPath(slug, environment);
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
  return Object.freeze(listResolvablePackSlugs(environment).flatMap((slug) => {
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
