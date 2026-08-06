import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { z } from 'zod';

import { repositoryPath } from './wave-manifest';

const nodeRequire = createRequire(__filename);
const { parse: parseYaml, stringify: stringifyYaml } = nodeRequire(path.join(
  path.dirname(nodeRequire.resolve('yaml/package.json')),
  'dist/index.js',
)) as typeof import('yaml');

export const REVIEW_DIRECTORY = 'data/bilans/reviews';
export const REVIEW_PROMPT_FILES = {
  preAnalysis: 'pre-analysis.md',
  eleve: 'eleve.md',
  parents: 'parents.md',
  nexus: 'nexus.md',
  verifier: 'verifier.md',
} as const;

const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/);
const promptChecksumsSchema = z.object({
  preAnalysis: checksumSchema,
  eleve: checksumSchema,
  parents: checksumSchema,
  nexus: checksumSchema,
  verifier: checksumSchema,
}).strict();

export const reviewRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)+$/),
  packVersion: z.number().int().positive(),
  sourceChecksum: checksumSchema,
  promptChecksums: promptChecksumsSchema,
  validatedBy: z.string().trim().min(1),
  validatedAt: z.string().datetime({ offset: true }),
  qualification: z.string().trim().min(1),
}).strict();

export type ReviewRegistry = z.infer<typeof reviewRegistrySchema>;
export type ReviewPromptChecksums = z.infer<typeof promptChecksumsSchema>;

export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function reviewRegistryPath(slug: string, directory = REVIEW_DIRECTORY): string {
  const checkedSlug = reviewRegistrySchema.shape.slug.parse(slug);
  return path.posix.join(directory.replaceAll(path.sep, '/'), `${checkedSlug}.review.yaml`);
}

export function computePromptChecksums(promptDirectory: string): ReviewPromptChecksums {
  return promptChecksumsSchema.parse(Object.fromEntries(
    Object.entries(REVIEW_PROMPT_FILES).map(([role, fileName]) => [
      role,
      sha256(fs.readFileSync(repositoryPath(path.posix.join(
        promptDirectory.replaceAll(path.sep, '/'),
        fileName,
      )), 'utf8')),
    ]),
  ));
}

export function createReviewRegistry(input: Readonly<{
  slug: string;
  packVersion: number;
  sourcePath: string;
  promptDirectory: string;
  validatedBy: string;
  validatedAt: string;
  qualification: string;
}>): ReviewRegistry {
  return reviewRegistrySchema.parse({
    schemaVersion: 1,
    slug: input.slug,
    packVersion: input.packVersion,
    sourceChecksum: sha256(fs.readFileSync(repositoryPath(input.sourcePath), 'utf8')),
    promptChecksums: computePromptChecksums(input.promptDirectory),
    validatedBy: input.validatedBy,
    validatedAt: input.validatedAt,
    qualification: input.qualification,
  });
}

export function loadReviewRegistry(
  slug: string,
  directory = REVIEW_DIRECTORY,
): ReviewRegistry | null {
  const relativePath = reviewRegistryPath(slug, directory);
  const absolutePath = repositoryPath(relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  const registry = reviewRegistrySchema.parse(parseYaml(fs.readFileSync(absolutePath, 'utf8')));
  if (registry.slug !== slug) throw new Error(`REVIEW_REGISTRY_SLUG_MISMATCH:${slug}`);
  return registry;
}

export function writeReviewRegistry(
  registry: ReviewRegistry,
  directory = REVIEW_DIRECTORY,
): string {
  const checked = reviewRegistrySchema.parse(registry);
  const relativePath = reviewRegistryPath(checked.slug, directory);
  const absolutePath = repositoryPath(relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const temporary = `${absolutePath}.tmp`;
  fs.writeFileSync(temporary, stringifyYaml(checked, { lineWidth: 0 }), 'utf8');
  fs.renameSync(temporary, absolutePath);
  return relativePath;
}

export function derivePackApproval(input: Readonly<{
  slug: string;
  packVersion: number;
  sourceChecksum: string;
  promptChecksums: ReviewPromptChecksums;
  registry: ReviewRegistry | null;
  resolvedReviewerIds: ReadonlySet<string>;
}>): Readonly<{
  status: 'DRAFT' | 'VALIDATED';
  review: { validatedBy: string | null; validatedAt: string | null };
}> {
  const registry = input.registry;
  const promptChecksumsMatch = registry !== null
    && Object.entries(input.promptChecksums).every(([role, checksum]) => (
      registry.promptChecksums[role as keyof ReviewPromptChecksums] === checksum
    ));
  const valid = registry !== null
    && registry.slug === input.slug
    && registry.packVersion === input.packVersion
    && registry.sourceChecksum === input.sourceChecksum
    && promptChecksumsMatch
    && input.resolvedReviewerIds.has(registry.validatedBy);
  return valid
    ? Object.freeze({
      status: 'VALIDATED',
      review: Object.freeze({ validatedBy: registry.validatedBy, validatedAt: registry.validatedAt }),
    })
    : Object.freeze({
      status: 'DRAFT',
      review: Object.freeze({ validatedBy: null, validatedAt: null }),
    });
}
