import type { AriaCourseKey, AriaResource } from './contracts';
import { join } from 'node:path';
import { AriaError } from './errors';
import { openVerifiedAriaResourceFile } from './infrastructure/resources/secure-open-linux';
import {
  type AriaResourceRecord,
  type AriaResourceVersionRecord,
  getAriaResourceRecord,
  getAriaResourceVersion,
  listActiveAriaResourceRecords,
  listAriaResourceRecords,
  resolveAriaResourceProvenance,
} from './manifests/resource-registry';

/**
 * Builds the wire-level projection for ONE (record, version) pair, in the
 * context of ONE specific course. `courseKey` here is always the CONTEXT the
 * caller asked for — the requested/listed course — never a canonical
 * per-resource truth: a resource with several placements has no single
 * canonical courseKey, only the one the caller is currently viewing it
 * through (Nexus Resource Registry v2, multi-placement).
 */
function projectResourceForCourse(
  record: AriaResourceRecord,
  version: AriaResourceVersionRecord,
  courseKey: AriaCourseKey,
): AriaResource {
  return Object.freeze({
    id: record.resourceId,
    resourceVersionId: version.resourceVersionId,
    courseKey,
    title: record.title,
    description: record.description,
    type: record.type,
    provenance: resolveAriaResourceProvenance(record.source),
    sourceLabel: record.source.label,
    sourceReference: record.source.reference,
    visibility: record.visibility,
    ownerStudentId: record.ownerStudentId,
    url: record.source.uri,
    filename: version.storage.provider === 'NEXUS_REPOSITORY'
      ? version.storage.relativePath
      : undefined,
    sizeBytes: version.sizeBytes,
    contentSha256: version.contentSha256,
    mimeType: version.mimeType,
  });
}

function activeRecordAndVersion(resourceId: string): Readonly<{
  record: AriaResourceRecord;
  version: AriaResourceVersionRecord;
}> | null {
  const record = getAriaResourceRecord(resourceId);
  if (!record || record.status !== 'ACTIVE' || !record.activeVersionId) return null;
  const version = getAriaResourceVersion(record.resourceId, record.activeVersionId);
  if (!version || version.status !== 'ACTIVE') return null;
  return Object.freeze({ record, version });
}

// One contextual projection PER PLACEMENT: a resource shared by two courses
// (Nexus Resource Registry v2) appears once per course it is placed in,
// carrying the SAME id/resourceVersionId/contentSha256 in both — never two
// canonical resources (Nexus Resource Registry v2, multi-placement).
const resources = Object.freeze(listActiveAriaResourceRecords().flatMap((record) => {
  const found = activeRecordAndVersion(record.resourceId);
  if (!found) throw new Error('ARIA active resource projection is invalid');
  return record.placements.map(
    (placement) => projectResourceForCourse(found.record, found.version, placement.courseKey),
  );
}));
const resourcesByCourse = new Map<string, readonly AriaResource[]>();
for (const courseKey of new Set(resources.map((resource) => resource.courseKey))) {
  resourcesByCourse.set(
    courseKey,
    Object.freeze(resources.filter((resource) => resource.courseKey === courseKey)),
  );
}

export function listResourcesForCourse(courseKey: AriaCourseKey): readonly AriaResource[] {
  return resourcesByCourse.get(courseKey) ?? [];
}

/**
 * Course-context-free lookup. Refuses (never guesses `placements[0]`) when
 * the resource has more than one placement: this path has no course in its
 * caller's request to disambiguate with (Nexus Resource Registry v2,
 * multi-placement) — every real resource today has exactly one placement, so
 * this refusal is currently unreachable, not a live limitation.
 */
export function getResource(resourceId: string): AriaResource | null {
  const found = activeRecordAndVersion(resourceId);
  if (!found) return null;
  if (found.record.placements.length !== 1) {
    throw new AriaError(
      'RESOURCE_COURSE_CONTEXT_REQUIRED',
      400,
      'Cette ressource est rattachée à plusieurs cours ; un contexte de cours explicite est requis.',
      { reasonCode: 'RESOURCE_COURSE_CONTEXT_REQUIRED' },
    );
  }
  return projectResourceForCourse(found.record, found.version, found.record.placements[0]!.courseKey);
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

/**
 * Verifies physical bytes ONLY for local (`NEXUS_REPOSITORY`) ResourceVersions.
 * A RAG-governed ResourceVersion has no local artifact to check here by
 * design — its physical integrity is established through the RAG manifest /
 * contentSha256 / runtime compatibility gate, never a fabricated local file
 * (Nexus Resource Registry v2, storage-aware). Renamed from
 * `assertResourcesIntegrity`: that name promised registry-wide coverage this
 * function has never given a RAG-governed entry, and never should.
 */
export async function assertLocalResourceArtifactsIntegrity(
  rootDirectory: string = join(process.cwd(), 'programmes'),
): Promise<void> {
  for (const resource of listAriaResourceRecords()) {
    for (const version of resource.versions) {
      if (version.storage.provider !== 'NEXUS_REPOSITORY') continue;
      if (!await verifyPhysicalVersion(
        version.storage.relativePath,
        version.sizeBytes,
        version.contentSha256,
        rootDirectory,
      )) {
        throw new Error(`ARIA local resource artifact integrity failed for ${resource.resourceId}`);
      }
    }
  }
}
