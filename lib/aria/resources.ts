import { z } from 'zod';
import registryDocument from '@/data/aria/resource-registry.v1.json';
import type { AriaCourseKey, AriaResource } from './contracts';
import { openVerifiedAriaResourceFile } from './infrastructure/resources/secure-open-linux';

const resourceSchema = z.object({
  id: z.string().min(1).max(120),
  courseKey: z.string().min(1).max(160),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(1_000).optional(),
  type: z.enum(['PDF', 'EXERCICE', 'SYNTHESE', 'METHODE', 'FICHE_REVISION', 'ANNALE_BAC']),
  provenance: z.enum(['OFFICIEL_MEN', 'NEXUS_METHODE', 'ANNALE_BAC', 'EXAM_POLICY']),
  sourceLabel: z.string().min(1).max(300),
  url: z.string().url().optional(),
  filename: z.string().min(1).max(500)
    .refine((value) => !value.startsWith('/') && !value.includes('\\')
      && value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')),
  sizeBytes: z.number().int().positive(),
  contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  mimeType: z.literal('application/pdf'),
}).strict();

const registrySchema = z.object({
  schemaVersion: z.literal(1),
  registryVersion: z.string().min(1).max(100),
  resources: z.array(resourceSchema).min(1),
}).strict();

const parsedRegistry = registrySchema.parse(registryDocument);
const duplicateIds = parsedRegistry.resources.filter((resource, index, all) =>
  all.findIndex((candidate) => candidate.id === resource.id) !== index);
if (duplicateIds.length > 0) throw new Error('ARIA resource registry contains duplicate identities');

const resources = Object.freeze(parsedRegistry.resources.map((resource) => Object.freeze(resource)));
const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));
const resourcesByCourse = new Map<string, readonly AriaResource[]>();
for (const courseKey of new Set(resources.map((resource) => resource.courseKey))) {
  resourcesByCourse.set(
    courseKey,
    Object.freeze(resources.filter((resource) => resource.courseKey === courseKey)),
  );
}

export const ARIA_RESOURCE_REGISTRY_VERSION = parsedRegistry.registryVersion;

export function listResourcesForCourse(courseKey: AriaCourseKey): readonly AriaResource[] {
  return resourcesByCourse.get(courseKey) ?? [];
}

export function getResource(resourceId: string): AriaResource | null {
  return resourcesById.get(resourceId) ?? null;
}

export function listResourcesForStudentCourses(
  courseKeys: readonly AriaCourseKey[],
): readonly AriaResource[] {
  return Object.freeze(courseKeys.flatMap((courseKey) => resourcesByCourse.get(courseKey) ?? []));
}

export async function verifyResourceOnDisk(
  resourceId: string,
  rootDirectory: string = process.cwd(),
): Promise<boolean> {
  const resource = getResource(resourceId);
  if (!resource?.filename || resource.sizeBytes === undefined || !resource.contentSha256) return false;
  try {
    const opened = await openVerifiedAriaResourceFile({
      rootDirectory,
      relativePath: resource.filename,
      expectedSizeBytes: resource.sizeBytes,
      expectedSha256: resource.contentSha256,
    });
    await opened.close();
    return true;
  } catch {
    return false;
  }
}

export async function assertResourcesIntegrity(rootDirectory: string = process.cwd()): Promise<void> {
  for (const resource of resources) {
    if (!await verifyResourceOnDisk(resource.id, rootDirectory)) {
      throw new Error(`ARIA resource registry integrity failed for ${resource.id}`);
    }
  }
}
