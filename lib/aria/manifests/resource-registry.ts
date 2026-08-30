import { createHash } from 'node:crypto';
import { z } from 'zod';

import registryDocument from '@/data/aria/resources.v1.json';

const uuidSchema = z.string().uuid();
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const relativePathSchema = z.string().min(1).max(500).refine(
  (value) => !value.startsWith('/')
    && !value.includes('\\')
    && value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'),
  'resource storage path must be canonical and relative',
);

const resourceVersionSchema = z.object({
  resourceVersionId: uuidSchema,
  versionLabel: z.string().min(1).max(100),
  status: z.enum(['ACTIVE', 'RETIRED']),
  publishedAt: z.string().datetime({ offset: true }),
  retiredAt: z.string().datetime({ offset: true }).nullable(),
  contentSha256: sha256Schema,
  sizeBytes: z.number().int().min(1),
  mimeType: z.literal('application/pdf'),
  storage: z.object({
    provider: z.literal('NEXUS_REPOSITORY'),
    relativePath: relativePathSchema,
  }).strict(),
}).strict().superRefine((version, context) => {
  if (version.status === 'ACTIVE' && version.retiredAt !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'active version cannot be retired' });
  }
  if (version.status === 'RETIRED' && version.retiredAt === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'retired version needs retiredAt' });
  }
});

const resourceSchema = z.object({
  resourceId: uuidSchema,
  legacyAliases: z.array(z.string().min(1).max(120)).max(10),
  courseKey: z.string().min(1).max(160),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(1_000),
  type: z.enum(['PDF', 'EXERCICE', 'SYNTHESE', 'METHODE', 'FICHE_REVISION', 'ANNALE_BAC']),
  status: z.enum(['ACTIVE', 'RETIRED']),
  activeVersionId: uuidSchema.nullable(),
  visibility: z.enum(['PUBLIC', 'STUDENT_PRIVATE', 'COACH_VISIBLE', 'PARENT_VISIBLE', 'SYSTEM_ONLY']),
  ownerStudentId: z.string().min(1).max(128).nullable(),
  source: z.object({
    label: z.string().min(1).max(300),
    uri: z.string().url().refine((value) => value.startsWith('https://')),
    reference: z.string().min(1).max(500),
    official: z.boolean(),
    rights: z.enum(['OFFICIAL_PUBLIC', 'NEXUS_PROPRIETARY', 'STUDENT_PRIVATE']),
  }).strict(),
  versions: z.array(resourceVersionSchema).min(1),
}).strict().superRefine((resource, context) => {
  const activeVersions = resource.versions.filter((version) => version.status === 'ACTIVE');
  if (resource.status === 'ACTIVE') {
    if (resource.activeVersionId === null
      || activeVersions.length !== 1
      || activeVersions[0]?.resourceVersionId !== resource.activeVersionId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'active resource needs one active version' });
    }
  } else if (resource.activeVersionId !== null || activeVersions.length !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'retired resource cannot expose an active version' });
  }
  if (resource.source.official !== (resource.source.rights === 'OFFICIAL_PUBLIC')) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'official flag and source rights disagree' });
  }
  if (resource.visibility === 'PUBLIC' && resource.ownerStudentId !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'public resource cannot have a student owner' });
  }
  if (resource.visibility === 'STUDENT_PRIVATE' && resource.ownerStudentId === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'private resource needs a student owner' });
  }
  if ((resource.visibility === 'STUDENT_PRIVATE')
    !== (resource.source.rights === 'STUDENT_PRIVATE')) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'private visibility and source rights disagree' });
  }
});

export const ariaResourceRegistrySchema = z.object({
  schemaVersion: z.literal('1'),
  registryVersion: z.string().min(1).max(100).regex(/^[A-Za-z0-9_.:-]+$/),
  idNamespace: uuidSchema,
  resources: z.array(resourceSchema).min(1),
}).strict().superRefine((registry, context) => {
  const resourceIds = registry.resources.map((resource) => resource.resourceId);
  const aliases = registry.resources.flatMap((resource) => resource.legacyAliases);
  const versions = registry.resources.flatMap((resource) => resource.versions);
  const versionIds = versions.map((version) => version.resourceVersionId);
  for (const [values, message] of [
    [resourceIds, 'duplicate resource identity'],
    [aliases, 'duplicate legacy resource alias'],
    [versionIds, 'duplicate resource version identity'],
  ] as const) {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  }
});

export type AriaResourceRecord = z.infer<typeof resourceSchema>;
export type AriaResourceVersionRecord = z.infer<typeof resourceVersionSchema>;

export function isAriaResourceRagCitable(
  visibility: AriaResourceRecord['visibility'],
): boolean {
  return visibility === 'PUBLIC';
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

const registry = ariaResourceRegistrySchema.parse(registryDocument);
const records = Object.freeze(registry.resources.map((resource) => Object.freeze(resource)));
const recordsById = new Map(records.map((resource) => [resource.resourceId, resource]));
const legacyAliases = new Map(records.flatMap((resource) => resource.legacyAliases.map(
  (alias) => [alias, Object.freeze({
    resourceId: resource.resourceId,
    resourceVersionId: resource.versions[0]!.resourceVersionId,
    contentSha256: resource.versions[0]!.contentSha256,
  })] as const,
)));

export const ARIA_RESOURCE_REGISTRY_VERSION = registry.registryVersion;
export const ARIA_RESOURCE_REGISTRY_SHA256 = createHash('sha256')
  .update(JSON.stringify(canonicalize(registry)))
  .digest('hex');

export function listAriaResourceRecords(): readonly AriaResourceRecord[] {
  return records;
}

export function listActiveAriaResourceRecords(): readonly AriaResourceRecord[] {
  return records.filter((resource) => resource.status === 'ACTIVE');
}

export function getAriaResourceRecord(resourceId: string): AriaResourceRecord | null {
  return recordsById.get(resourceId) ?? null;
}

export function getAriaResourceVersion(
  resourceId: string,
  resourceVersionId: string,
): AriaResourceVersionRecord | null {
  return recordsById.get(resourceId)?.versions.find(
    (version) => version.resourceVersionId === resourceVersionId,
  ) ?? null;
}

export function resolveAriaResourceProvenance(
  source: Readonly<{ readonly official: boolean; readonly rights: AriaResourceRecord['source']['rights'] }>,
): 'OFFICIEL_MEN' | 'NEXUS_METHODE' | 'STUDENT_PROVIDED' {
  if (source.rights === 'OFFICIAL_PUBLIC' && source.official) return 'OFFICIEL_MEN';
  if (source.rights === 'NEXUS_PROPRIETARY' && !source.official) return 'NEXUS_METHODE';
  if (source.rights === 'STUDENT_PRIVATE' && !source.official) return 'STUDENT_PROVIDED';
  throw new Error('ARIA_RESOURCE_SOURCE_CONTRACT_INVALID');
}

/** Migration/backfill-only adapter. Runtime routes must require canonical UUIDs. */
export function resolveLegacyAriaResourceAliasForMigration(legacyAlias: string): Readonly<{
  resourceId: string;
  resourceVersionId: string;
  contentSha256: string;
}> | null {
  return legacyAliases.get(legacyAlias) ?? null;
}
