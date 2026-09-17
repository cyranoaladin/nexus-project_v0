/**
 * Staff scheduling of a real ARIA collective workshop (P7d) — the first
 * real ASSISTANTE-administered ARIA capability: no manual SQL/script is
 * needed to run ARIA (mission section 8/9's own requirement). Deliberately
 * a plain courseKey-scoped session, not eligibility-scoped at creation
 * time: "who is eligible" is computed on read (real academic enrollment +
 * real SUIVI-tier entitlement scope for this courseKey), never stored
 * redundantly on the session itself.
 */
import { getCourse, isKnownCourseKey } from '@/lib/curriculum/catalog';
import { prisma } from '@/lib/prisma';
import type { SessionModality } from '@prisma/client';
import { AriaError } from '../../errors';
import { resolveInteractiveStaffActor } from '../../kernel/staff-subject';

export interface AriaWorkshopSessionRecord {
  readonly id: string;
  readonly courseKey: string;
  readonly title: string;
  readonly coachProfileId: string | null;
  readonly scheduledDate: Date;
  readonly startTime: string;
  readonly endTime: string;
  readonly modality: SessionModality;
  readonly location: string | null;
  readonly capacity: number | null;
  readonly status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
}

export interface ScheduleAriaWorkshopInput {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly courseKey: string;
  readonly title: string;
  readonly scheduledDate: Date;
  readonly startTime: string;
  readonly endTime: string;
  readonly modality: SessionModality;
  readonly location?: string | null;
  readonly capacity?: number | null;
  readonly coachProfileId?: string | null;
}

export async function scheduleAriaWorkshopSession(
  input: ScheduleAriaWorkshopInput,
): Promise<AriaWorkshopSessionRecord> {
  const actor = resolveInteractiveStaffActor(input.actor);

  if (!isKnownCourseKey(input.courseKey) || !getCourse(input.courseKey)) {
    throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
  }
  if (!input.title.trim()) {
    throw new AriaError('BAD_REQUEST', 400, 'Le titre de l’atelier est requis.');
  }

  const session = await prisma.ariaWorkshopSession.create({
    data: {
      courseKey: input.courseKey,
      title: input.title,
      coachProfileId: input.coachProfileId ?? null,
      scheduledDate: input.scheduledDate,
      startTime: input.startTime,
      endTime: input.endTime,
      modality: input.modality,
      location: input.location ?? null,
      capacity: input.capacity ?? null,
      createdById: actor.userId,
    },
  });

  return Object.freeze({
    id: session.id,
    courseKey: session.courseKey,
    title: session.title,
    coachProfileId: session.coachProfileId,
    scheduledDate: session.scheduledDate,
    startTime: session.startTime,
    endTime: session.endTime,
    modality: session.modality,
    location: session.location,
    capacity: session.capacity,
    status: session.status,
  });
}
