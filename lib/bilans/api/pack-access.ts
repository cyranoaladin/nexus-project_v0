import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  loadBilanPack,
  loadValidatedPack,
  type BilanPack,
} from '@/lib/bilans/catalog/load-pack';
import type { ValidatedPack } from '@/lib/bilans/validators/contracts';

import { CanonicalApiError } from './errors';

const PACK_PATHS = Object.freeze<Record<string, string>>({
  'entree-seconde-maths-v1': 'data/bilans/banks/entree-seconde-maths-v1.json',
  'entree-premiere-maths-v1': 'data/bilans/banks/entree-premiere-maths-v1.json',
  'entree-terminale-maths-v1': 'data/bilans/banks/entree-terminale-maths-v1.json',
  'maths-terminale-bilan-v1': 'data/bilans/banks/maths-terminale-bilan-v1.json',
});

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
  const packPath = PACK_PATHS[slug];
  if (packPath === undefined) return null;

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
