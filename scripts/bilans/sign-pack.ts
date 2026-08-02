import fs from 'node:fs';
import path from 'node:path';

import {
  createReviewRegistry,
  loadReviewRegistry,
  reviewRegistryPath,
  REVIEW_DIRECTORY,
  writeReviewRegistry,
  type ReviewRegistry,
} from '@/lib/bilans/catalog/review-registry';
import {
  loadWaveManifest,
  repositoryPath,
  type WaveBankEntry,
} from '@/lib/bilans/catalog/wave-manifest';

import { buildPack } from './yaml-bank-to-pack';

const DEFAULT_MANIFEST = 'data/bilans/banks/wave1.manifest.json';
const TEMPLATE_PACK = 'data/bilans/banks/maths-terminale-bilan-v1.json';

export type CoachProfileLookup = Readonly<{
  findByEmail(email: string): Promise<Readonly<{ id: string }> | null>;
}>;

export function createPrismaCoachProfileLookup(client: Readonly<{
  coachProfile: {
    findFirst(args: Readonly<{
      where: { user: { email: string } };
      select: { id: true };
    }>): Promise<Readonly<{ id: string }> | null>;
  };
}>): CoachProfileLookup {
  return Object.freeze({
    findByEmail: (email) => client.coachProfile.findFirst({
      where: { user: { email } },
      select: { id: true },
    }),
  });
}

export type SignPackResult = Readonly<
  | { slug: string; status: 'SIGNED'; validatedBy: string }
  | { slug: string; status: 'REFUSED'; reason: string }
>;

function sameSignatureEvidence(existing: ReviewRegistry, candidate: ReviewRegistry): boolean {
  return existing.schemaVersion === candidate.schemaVersion
    && existing.slug === candidate.slug
    && existing.packVersion === candidate.packVersion
    && existing.sourceChecksum === candidate.sourceChecksum
    && existing.validatedBy === candidate.validatedBy
    && existing.qualification === candidate.qualification
    && JSON.stringify(existing.promptChecksums) === JSON.stringify(candidate.promptChecksums);
}

function writeTextAtomically(relativePath: string, content: string): void {
  const absolutePath = repositoryPath(relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const temporary = `${absolutePath}.sign-pack.tmp`;
  fs.writeFileSync(temporary, content, 'utf8');
  fs.renameSync(temporary, absolutePath);
}

function previousContent(relativePath: string): string | null {
  const absolutePath = repositoryPath(relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : null;
}

function restoreContent(relativePath: string, previous: string | null): void {
  const absolutePath = repositoryPath(relativePath);
  if (previous === null) {
    fs.rmSync(absolutePath, { force: true });
    return;
  }
  writeTextAtomically(relativePath, previous);
}

function signOne(input: Readonly<{
  entry: WaveBankEntry;
  reviewerId: string;
  qualification: string;
  validatedAt: string;
  reviewDirectory: string;
}>): SignPackResult {
  const { entry } = input;
  const registryPath = reviewRegistryPath(entry.slug, input.reviewDirectory);
  const registryBefore = previousContent(registryPath);
  const outputBefore = previousContent(entry.output);
  try {
    // buildPack executes schema validation, V1-V14 and CPS validation before any write.
    const draftPack = buildPack({
      sourcePath: entry.source,
      cpsPath: entry.cps,
      templatePackPath: TEMPLATE_PACK,
      promptDirectory: entry.promptDirectory,
      reviewRegistry: null,
    });
    const candidate = createReviewRegistry({
      slug: entry.slug,
      packVersion: Number(draftPack.version),
      sourcePath: entry.source,
      promptDirectory: entry.promptDirectory,
      validatedBy: input.reviewerId,
      validatedAt: input.validatedAt,
      qualification: input.qualification,
    });
    const existing = loadReviewRegistry(entry.slug, input.reviewDirectory);
    const registry = existing !== null && sameSignatureEvidence(existing, candidate)
      ? existing
      : candidate;
    const pack = buildPack({
      sourcePath: entry.source,
      cpsPath: entry.cps,
      templatePackPath: TEMPLATE_PACK,
      promptDirectory: entry.promptDirectory,
      reviewRegistry: registry,
      resolvedReviewerIds: new Set([input.reviewerId]),
    });
    if (pack.status !== 'VALIDATED' || pack.review.validatedBy !== input.reviewerId) {
      throw new Error('PACK_SIGNATURE_DERIVATION_FAILED');
    }

    writeReviewRegistry(registry, input.reviewDirectory);
    writeTextAtomically(entry.output, `${JSON.stringify(pack, null, 2)}\n`);
    return Object.freeze({ slug: entry.slug, status: 'SIGNED', validatedBy: input.reviewerId });
  } catch (error) {
    restoreContent(registryPath, registryBefore);
    restoreContent(entry.output, outputBefore);
    return Object.freeze({
      slug: entry.slug,
      status: 'REFUSED',
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function signPacks(options: Readonly<{
  slugs: readonly string[];
  email: string;
  qualification: string;
  coachProfiles: CoachProfileLookup;
  manifestPath?: string;
  reviewDirectory?: string;
  now?: () => Date;
}>): Promise<readonly SignPackResult[]> {
  const slugs = [...new Set(options.slugs)];
  if (slugs.length === 0) throw new Error('PACK_SLUG_REQUIRED');
  if (options.email.trim() === '') throw new Error('REVIEWER_EMAIL_REQUIRED');
  if (options.qualification.trim() === '') throw new Error('REVIEWER_QUALIFICATION_REQUIRED');
  const manifest = loadWaveManifest(options.manifestPath ?? DEFAULT_MANIFEST);
  const reviewer = await options.coachProfiles.findByEmail(options.email.trim());
  if (reviewer === null) {
    return Object.freeze(slugs.map((slug) => Object.freeze({
      slug,
      status: 'REFUSED' as const,
      reason: 'COACH_PROFILE_NOT_FOUND',
    })));
  }
  const entryBySlug = new Map(manifest.banks.map((entry) => [entry.slug, entry]));
  const validatedAt = (options.now ?? (() => new Date()))().toISOString();
  const reviewDirectory = options.reviewDirectory ?? REVIEW_DIRECTORY;
  return Object.freeze(slugs.map((slug) => {
    const entry = entryBySlug.get(slug);
    if (entry === undefined) return Object.freeze({ slug, status: 'REFUSED' as const, reason: 'PACK_SLUG_UNKNOWN' });
    return signOne({
      entry,
      reviewerId: reviewer.id,
      qualification: options.qualification.trim(),
      validatedAt,
      reviewDirectory,
    });
  }));
}

function parseArguments(args: string[]): Readonly<{
  slugs: string[];
  email: string;
  qualification: string;
  manifestPath: string;
}> | null {
  const slugs: string[] = [];
  let email: string | undefined;
  let qualification: string | undefined;
  let manifestPath = DEFAULT_MANIFEST;
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (value === undefined) return null;
    if (flag === '--slug') slugs.push(value);
    else if (flag === '--email' && email === undefined) email = value;
    else if (flag === '--qualification' && qualification === undefined) qualification = value;
    else if (flag === '--manifest' && manifestPath === DEFAULT_MANIFEST) manifestPath = value;
    else return null;
  }
  if (slugs.length === 0 || email === undefined || qualification === undefined) return null;
  return { slugs, email, qualification, manifestPath };
}

export async function main(args: string[]): Promise<number> {
  const parsed = parseArguments(args);
  if (parsed === null) {
    console.error('Usage: tsx scripts/bilans/sign-pack.ts --slug <slug> [--slug <slug> ...] --email <email> --qualification <qualification> [--manifest <manifest.json>]');
    return 2;
  }
  const { prisma } = await import('@/lib/prisma');
  try {
    const results = await signPacks({
      ...parsed,
      coachProfiles: createPrismaCoachProfileLookup(prisma),
    });
    for (const result of results) {
      if (result.status === 'SIGNED') console.log(`PACK_SIGNED=${result.slug}:${result.validatedBy}`);
      else console.error(`PACK_REFUSED=${result.slug}:${result.reason.replaceAll('\n', ' | ')}`);
    }
    const signed = results.filter(({ status }) => status === 'SIGNED').length;
    console.log(`PACK_SIGNATURE_BATCH=${signed}:SIGNED:${results.length - signed}:REFUSED`);
    return signed === results.length ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
