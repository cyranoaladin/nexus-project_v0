import { getCourse, isKnownCourseKey } from '@/lib/curriculum/catalog';
import { join } from 'node:path';
import { resolveAriaCourseAccess } from '../../access';
import { getCourseCapabilities } from '../../curriculum';
import { AriaError } from '../../errors';
import { resolveInteractiveStudentActor, resolveStudentSelfSubject } from '../../kernel/actor-subject';
import { buildCanonicalAriaEntitlementContext } from '../../kernel/entitlements';
import { getActiveResourcePlacements, getResourceForCourse, listResourcesForCourse } from '../../resources';
import { openVerifiedAriaResourceFile } from '../../infrastructure/resources/secure-open-linux';
import {
  assertAriaResourceAuthorization,
  isAriaResourceAuthorized,
} from '../../domain/resources/authorization';
import { loadAriaAuthorizationStudent } from '../conversation/load-authorization-student';

interface AriaResourceActorInput {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly now?: Date;
}

async function authorizeResourceCourse(
  input: AriaResourceActorInput & { readonly courseKey: string },
) {
  const actor = resolveInteractiveStudentActor(input.actor);
  if (!isKnownCourseKey(input.courseKey) || !getCourse(input.courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }
  const student = await loadAriaAuthorizationStudent(actor);
  resolveStudentSelfSubject(actor, student);
  const entitlements = buildCanonicalAriaEntitlementContext(
    student.user.entitlements,
    input.now ?? new Date(),
  );
  const access = resolveAriaCourseAccess({
    courseKey: input.courseKey,
    student,
    entitlements,
  });
  if (!access.academicallyRelevant) {
    throw new AriaError('NOT_ENROLLED', 403, 'Ce cours ne fait pas partie du cursus scolaire actif.');
  }
  if (!access.productSupported || !getCourseCapabilities(input.courseKey).hasResources) {
    throw new AriaError('UNSUPPORTED', 422, 'Aucune ressource ARIA n’est disponible pour ce cours.');
  }
  if (!access.commerciallyEntitled) {
    throw new AriaError('NOT_ENTITLED', 403, 'Aucun droit ARIA actif ne couvre ce cours.');
  }
  return { student, access };
}

export async function listAriaResourcesForActor(
  input: AriaResourceActorInput & { readonly courseKey: string },
) {
  const { student } = await authorizeResourceCourse(input);
  return Object.freeze({
    courseKey: input.courseKey,
    resources: Object.freeze(listResourcesForCourse(input.courseKey)
      .filter((resource) => isAriaResourceAuthorized(resource, input.courseKey, student.id))
      .map((resource) => Object.freeze({
        resourceId: resource.id,
        resourceVersionId: resource.resourceVersionId,
        courseKey: resource.courseKey,
        title: resource.title,
        description: resource.description,
        type: resource.type,
        provenance: resource.provenance,
        sourceLabel: resource.sourceLabel,
        sourceReference: resource.sourceReference,
        sourceUri: resource.url,
      }))),
  });
}

/**
 * The content endpoint's URL names only Resource/ResourceVersion, never a
 * course (see `app/api/aria/resources/[resourceId]/versions/[resourceVersionId]/content`)
 * — changing that public URL shape is out of scope for this foundation. For
 * a resource placed in several courses, this evaluates the actor against
 * EVERY placement the resource actually has and accepts the first one that
 * legitimately authorizes them — never an arbitrary placement, and never a
 * placement the resource isn't really in. A resource placed in {A, B} and an
 * actor entitled only to A is authorized THROUGH A; that never implies B.
 */
export async function authorizeAriaResourceForActor(
  input: AriaResourceActorInput & {
    readonly resourceId: string;
    readonly resourceVersionId: string;
  },
) {
  const placements = getActiveResourcePlacements(input.resourceId);
  if (!placements) {
    throw new AriaError('RESOURCE_MISMATCH', 404, 'Ressource ARIA introuvable.');
  }
  let authorized: Readonly<{ courseKey: string; student: { id: string } }> | null = null;
  for (const courseKey of placements) {
    try {
      const { student } = await authorizeResourceCourse({
        actor: input.actor,
        courseKey,
        now: input.now,
      });
      authorized = { courseKey, student };
      break;
    } catch (error) {
      // An expected per-course refusal tries the resource's next placement;
      // anything else (infrastructure failure) must never be swallowed into
      // a misleading 404.
      if (error instanceof AriaError) continue;
      throw error;
    }
  }
  if (!authorized) {
    throw new AriaError('RESOURCE_MISMATCH', 404, 'Ressource ARIA introuvable.');
  }
  const resource = getResourceForCourse(input.resourceId, authorized.courseKey);
  if (!resource || resource.resourceVersionId !== input.resourceVersionId) {
    throw new AriaError('RESOURCE_MISMATCH', 404, 'Ressource ARIA introuvable.');
  }
  assertAriaResourceAuthorization(resource, authorized.courseKey, authorized.student.id);
  return Object.freeze({ resource });
}

export async function openAriaResourceContentForActor(
  input: AriaResourceActorInput & {
    readonly resourceId: string;
    readonly resourceVersionId: string;
  },
) {
  const { resource } = await authorizeAriaResourceForActor(input);
  // Explicit on the storage discriminant, never inferred from `filename`
  // being absent: a RAG-governed ResourceVersion is not a Nexus local file
  // and must fail closed here, before any attempt to open one — never by
  // fetching `source.uri`, contacting RAG, or fabricating a local path.
  if (resource.storageProvider !== 'NEXUS_REPOSITORY'
    || !resource.filename || resource.sizeBytes === undefined
    || !resource.contentSha256 || !resource.mimeType) {
    throw new AriaError('UNSUPPORTED', 422, 'Cette ressource ne possède pas de contenu vérifié disponible.');
  }
  const opened = await openVerifiedAriaResourceFile({
    rootDirectory: join(process.cwd(), 'programmes'),
    relativePath: resource.filename,
    expectedSizeBytes: resource.sizeBytes,
    expectedSha256: resource.contentSha256,
    expectedMimeType: resource.mimeType,
  });
  const filename = resource.filename.split('/').at(-1);
  if (!filename || /[\r\n"\\]/.test(filename)) {
    await opened.close();
    throw new AriaError('INTERNAL_ERROR', 500, 'La ressource ARIA ne peut pas être ouverte.');
  }
  return Object.freeze({
    filename,
    contentType: opened.mimeType,
    sizeBytes: opened.sizeBytes,
    createReadStream: opened.createReadStream,
    close: opened.close,
  });
}
