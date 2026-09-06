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

/** The codes `authorizeCourseAccessForStudent` throws for an expected per-course refusal — never a wider AriaError catch. */
const RESOURCE_COURSE_REFUSAL_CODES = Object.freeze([
  'COURSE_NOT_FOUND', 'NOT_ENROLLED', 'UNSUPPORTED', 'NOT_ENTITLED',
] as const);

async function loadAuthorizedActorContext(input: AriaResourceActorInput) {
  const actor = resolveInteractiveStudentActor(input.actor);
  const student = await loadAriaAuthorizationStudent(actor);
  resolveStudentSelfSubject(actor, student);
  const entitlements = buildCanonicalAriaEntitlementContext(
    student.user.entitlements,
    input.now ?? new Date(),
  );
  return { student, entitlements };
}

function authorizeCourseAccessForStudent(
  courseKey: string,
  context: Awaited<ReturnType<typeof loadAuthorizedActorContext>>,
) {
  if (!isKnownCourseKey(courseKey) || !getCourse(courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }
  const access = resolveAriaCourseAccess({
    courseKey,
    student: context.student,
    entitlements: context.entitlements,
  });
  if (!access.academicallyRelevant) {
    throw new AriaError('NOT_ENROLLED', 403, 'Ce cours ne fait pas partie du cursus scolaire actif.');
  }
  if (!access.productSupported || !getCourseCapabilities(courseKey).hasResources) {
    throw new AriaError('UNSUPPORTED', 422, 'Aucune ressource ARIA n’est disponible pour ce cours.');
  }
  if (!access.commerciallyEntitled) {
    throw new AriaError('NOT_ENTITLED', 403, 'Aucun droit ARIA actif ne couvre ce cours.');
  }
  return { student: context.student, access };
}

async function authorizeResourceCourse(
  input: AriaResourceActorInput & { readonly courseKey: string },
) {
  const context = await loadAuthorizedActorContext(input);
  return authorizeCourseAccessForStudent(input.courseKey, context);
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
  // Loaded ONCE for the whole request, never per placement: the actor/student
  // snapshot does not depend on which placement is being evaluated.
  const context = await loadAuthorizedActorContext(input);
  let authorized: Readonly<{ courseKey: string; student: { id: string } }> | null = null;
  for (const courseKey of placements) {
    try {
      const { student } = authorizeCourseAccessForStudent(courseKey, context);
      authorized = { courseKey, student };
      break;
    } catch (error) {
      // Only an expected per-course refusal tries the resource's next
      // placement; anything else (an infrastructure failure, or a genuine
      // `INTERNAL_ERROR` from inconsistent enrollment data) must never be
      // swallowed into a misleading 404.
      if (error instanceof AriaError
        && (RESOURCE_COURSE_REFUSAL_CODES as readonly string[]).includes(error.code)) continue;
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
