import type { AriaCourseKey, AriaResource } from './contracts';
import { join } from 'node:path';
import { openVerifiedAriaResourceFile } from './infrastructure/resources/secure-open-linux';
import {
  ARIA_RESOURCE_REGISTRY_VERSION,
  getAriaResourceRecord,
  getAriaResourceVersion,
  listActiveAriaResourceRecords,
  listAriaResourceRecords,
  resolveAriaResourceProvenance,
} from './manifests/resource-registry';

function activeResourceProjection(resourceId: string): AriaResource | null {
  const record = getAriaResourceRecord(resourceId);
  if (!record || record.status !== 'ACTIVE' || !record.activeVersionId) return null;
  const version = getAriaResourceVersion(record.resourceId, record.activeVersionId);
  if (!version || version.status !== 'ACTIVE') return null;
  return Object.freeze({
    id: record.resourceId,
    resourceVersionId: version.resourceVersionId,
    courseKey: record.courseKey as AriaCourseKey,
    title: record.title,
    description: record.description,
    type: record.type,
    provenance: resolveAriaResourceProvenance(record.source),
    sourceLabel: record.source.label,
    sourceReference: record.source.reference,
    visibility: record.visibility,
    ownerStudentId: record.ownerStudentId,
    url: record.source.uri,
    filename: version.storage.relativePath,
    sizeBytes: version.sizeBytes,
    contentSha256: version.contentSha256,
    mimeType: version.mimeType,
  });
}

const resources = Object.freeze(listActiveAriaResourceRecords().map((record) => {
  const projection = activeResourceProjection(record.resourceId);
  if (!projection) throw new Error('ARIA active resource projection is invalid');
  return projection;
}));
const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));
const resourcesByCourse = new Map<string, readonly AriaResource[]>();
for (const courseKey of new Set(resources.map((resource) => resource.courseKey))) {
  resourcesByCourse.set(
    courseKey,
    Object.freeze(resources.filter((resource) => resource.courseKey === courseKey)),
  );
}

export { ARIA_RESOURCE_REGISTRY_VERSION };

export function listResourcesForCourse(courseKey: AriaCourseKey): readonly AriaResource[] {
  return resourcesByCourse.get(courseKey) ?? [];
}

export function getResource(resourceId: string): AriaResource | null {
  return resourcesById.get(resourceId) ?? null;
}

async function verifyPhysicalVersion(
  relativePath: string,
  sizeBytes: number,
  contentSha256: string,
  rootDirectory: string,
): Promise<boolean> {
  try {
    const opened = await openVerifiedAriaResourceFile({
      rootDirectory,
      relativePath,
      expectedSizeBytes: sizeBytes,
      expectedSha256: contentSha256,
      expectedMimeType: 'application/pdf',
    });
    await opened.close();
    return true;
  } catch {
    return false;
  }
}

export async function assertResourcesIntegrity(
  rootDirectory: string = join(process.cwd(), 'programmes'),
): Promise<void> {
  for (const resource of listAriaResourceRecords()) {
    for (const version of resource.versions) {
      if (!await verifyPhysicalVersion(
        version.storage.relativePath,
        version.sizeBytes,
        version.contentSha256,
        rootDirectory,
      )) {
        throw new Error(`ARIA resource registry integrity failed for ${resource.resourceId}`);
      }
    }
  }
}
